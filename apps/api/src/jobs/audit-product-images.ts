/**
 * Read-only audit: product gallery objects that are undecodable or too large for channel JPEG.
 * No writes. Requires AUDIT_PRODUCT_IMAGES_DRY_RUN=1 and DATABASE_URL.
 *
 * Ops: re-upload gallery images for product 5047 (known truncated JPEG on Bale).
 *
 * npx ts-node --transpile-only src/jobs/audit-product-images.ts
 */
import { DataSource } from 'typeorm';
import { extractProductObjectKey } from './backfill-product-images';
import {
  CHANNEL_PHOTO_MAX_BYTES,
  isCompleteJpeg,
  prepareChannelJpeg,
} from '../modules/upload/channel-image';
import { channelDerivativeKey } from '../modules/upload/storage-delete';

type MinioClientLike = {
  statObject(bucket: string, key: string): Promise<{ size: number }>;
  getObject(bucket: string, key: string): Promise<NodeJS.ReadableStream>;
};

type AuditIssue = {
  productId: string;
  sku: string;
  url: string;
  key: string | null;
  kind: 'undecodable' | 'oversize' | 'missing_object' | 'unsupported_url';
  detail: string;
};

function redact(value: string): string {
  return value.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]');
}

async function readObject(client: MinioClientLike, bucket: string, key: string, maxBytes: number): Promise<Buffer> {
  const stream = await client.getObject(bucket, key);
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw new Error('object_too_large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

function createMinioClient(): { client: MinioClientLike; bucket: string } | null {
  try {
    const Minio = require('minio') as { Client: new (options: Record<string, unknown>) => MinioClientLike };
    const bucket = process.env.MINIO_BUCKET || 'taranom-products';
    const client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_USER || 'taranom_minio',
      secretKey: process.env.MINIO_PASS || '',
    });
    return { client, bucket };
  } catch {
    return null;
  }
}

async function auditKey(
  client: MinioClientLike,
  bucket: string,
  key: string,
): Promise<{ kind: AuditIssue['kind']; detail: string } | null> {
  const channelKey = channelDerivativeKey(key);
  let bytes: Buffer | null = null;
  try {
    if (channelKey) {
      try {
        const stat = await client.statObject(bucket, channelKey);
        if (stat.size > CHANNEL_PHOTO_MAX_BYTES) {
          return { kind: 'oversize', detail: `channel derivative ${stat.size} bytes` };
        }
        bytes = await readObject(client, bucket, channelKey, CHANNEL_PHOTO_MAX_BYTES + 1);
        if (!isCompleteJpeg(bytes)) {
          return { kind: 'undecodable', detail: 'channel derivative is not a complete JPEG' };
        }
        return null;
      } catch {
        // No derivative — audit the main object.
      }
    }
    const stat = await client.statObject(bucket, key);
    bytes = await readObject(client, bucket, key, 25 * 1024 * 1024);
    if (channelKey) {
      try {
        await prepareChannelJpeg(bytes, { maxBytes: CHANNEL_PHOTO_MAX_BYTES, longEdge: 1600, minQuality: 55 });
        return null;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'photo_too_large') return { kind: 'oversize', detail: `main ${stat.size} bytes cannot fit channel cap` };
        return { kind: 'undecodable', detail: message };
      }
    }
    return null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found|NoSuchKey/i.test(message)) return { kind: 'missing_object', detail: message };
    return { kind: 'undecodable', detail: message };
  }
}

async function main() {
  if (process.env.AUDIT_PRODUCT_IMAGES_DRY_RUN !== '1' || !process.env.DATABASE_URL) {
    console.log(JSON.stringify({
      dryRun: true,
      connected: false,
      reason: 'Set AUDIT_PRODUCT_IMAGES_DRY_RUN=1 and DATABASE_URL. No database was opened.',
      opsNote: 'Re-upload gallery for product 5047 if channel posts still fail.',
    }, null, 2));
    return;
  }

  const minio = createMinioClient();
  if (!minio) {
    console.log(JSON.stringify({ dryRun: true, connected: false, reason: 'MinIO client unavailable' }, null, 2));
    return;
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
    logging: false,
  });
  await dataSource.initialize();
  try {
    const rows: Array<{ id: string; sku: string; images: unknown }> = await dataSource.query(
      `SELECT id, sku, images FROM products WHERE status = $1 AND "deletedAt" IS NULL ORDER BY sku ASC`,
      ['ACTIVE'],
    );
    const issues: AuditIssue[] = [];
    for (const row of rows) {
      const urls = Array.isArray(row.images) ? row.images.filter((u) => typeof u === 'string') as string[] : [];
      for (const url of urls) {
        const key = extractProductObjectKey(url, minio.bucket);
        if (!key) {
          issues.push({
            productId: row.id,
            sku: row.sku,
            url,
            key: null,
            kind: 'unsupported_url',
            detail: 'not a products/ object on this bucket',
          });
          continue;
        }
        const finding = await auditKey(minio.client, minio.bucket, key);
        if (finding) {
          issues.push({
            productId: row.id,
            sku: row.sku,
            url,
            key,
            kind: finding.kind,
            detail: finding.detail,
          });
        }
      }
    }
    console.log(JSON.stringify({
      dryRun: true,
      connected: true,
      productsScanned: rows.length,
      issueCount: issues.length,
      opsNote: 'Product 5047: re-upload gallery if listed below.',
      issues,
    }, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(redact(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
