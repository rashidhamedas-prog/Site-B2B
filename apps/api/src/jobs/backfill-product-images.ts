import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Readable } from 'node:stream';
import { DataSource } from 'typeorm';
import {
  processProductImage,
  ProductImageProcessingError,
} from '../modules/upload/image-processor';
import { isMissingObjectError, sanitizeObjectKey } from '../modules/upload/storage-delete';

const OWNED_MEDIA_HOSTS = new Set([
  'poshaktaranom.com',
  'www.poshaktaranom.com',
  'poshaktaranom.ir',
  'www.poshaktaranom.ir',
  'api.poshaktaranom.com',
  'storage.poshaktaranom.com',
  'minio',
  'localhost',
  '127.0.0.1',
]);
const ADVISORY_LOCK_KEY = 20260903004;

const DEFAULT_THRESHOLD_BYTES = 500 * 1024;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 4;
const MAX_INPUT_BYTES = 50 * 1024 * 1024;
const MANIFEST_SCHEMA_VERSION = 1;

type BackfillMode = 'dry-run' | 'apply' | 'rollback';

export interface BackfillCliOptions {
  mode: BackfillMode;
  thresholdBytes: number;
  concurrency: number;
  limit: number | null;
  manifestPath: string;
  rollbackPath?: string;
}

export type BackfillReference =
  | { kind: 'product'; id: string; index: number }
  | { kind: 'variant'; id: string; productId: string };

export interface BackfillReplacement {
  oldUrl: string;
  newUrl: string;
  oldKey: string;
  newKey: string;
  oldSize: number;
  newSize: number;
  sha256: string;
  references: BackfillReference[];
}

interface BackfillManifest {
  schemaVersion: 1;
  createdAt: string;
  status: 'dry-run' | 'prepared' | 'applied' | 'failed' | 'rolled-back';
  config: {
    activeProductsOnly: true;
    thresholdBytes: number;
    concurrency: number;
    limit: number | null;
    originalsDeleted: false;
    outboxEventsWritten: false;
  };
  scope: {
    products: number;
    references: number;
    uniqueUrls: number;
    eligibleUrls: number;
    selectedUrls: number;
  };
  replacements: BackfillReplacement[];
  skipped: Array<{
    url: string;
    key?: string;
    size?: number;
    reason: string;
  }>;
  errors: Array<{ url: string; message: string }>;
  apply?: {
    at: string;
    changedReferences: number;
    alreadyDesiredReferences: number;
  };
  rollback?: {
    at: string;
    changedReferences: number;
    alreadyDesiredReferences: number;
  };
}

interface MinioClientLike {
  statObject(bucket: string, key: string): Promise<{ size: number }>;
  getObject(bucket: string, key: string): Promise<Readable>;
  putObject(
    bucket: string,
    key: string,
    value: Buffer,
    size: number,
    metadata: Record<string, string>
  ): Promise<unknown>;
}

interface SourceGroup {
  url: string;
  key: string;
  references: BackfillReference[];
}

function positiveInteger(raw: string, flag: string): number {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
}

function defaultManifestPath(now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `/tmp/taranom-product-image-backfill-${stamp}.json`;
}

export function isDurableManifestPath(path: string): boolean {
  const normalized = path.trim().replace(/\\/g, '/');
  if (!normalized.startsWith('/') || normalized.includes('..')) return false;
  if (normalized === '/tmp' || normalized.startsWith('/tmp/') || normalized.startsWith('/var/tmp/')) {
    return false;
  }
  return true;
}

export function parseBackfillCliArgs(argv: string[], now = new Date()): BackfillCliOptions {
  let mode: BackfillMode = 'dry-run';
  let requestedApply = false;
  let rollbackPath: string | undefined;
  let thresholdBytes = DEFAULT_THRESHOLD_BYTES;
  let concurrency = DEFAULT_CONCURRENCY;
  let limit: number | null = null;
  let manifestPath = defaultManifestPath(now);
  let explicitManifest = false;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      mode = 'dry-run';
    } else if (arg === '--apply') {
      mode = 'apply';
      requestedApply = true;
    } else if (arg.startsWith('--rollback=')) {
      rollbackPath = arg.slice('--rollback='.length).trim();
      mode = 'rollback';
    } else if (arg.startsWith('--manifest=')) {
      manifestPath = arg.slice('--manifest='.length).trim();
      explicitManifest = true;
    } else if (arg.startsWith('--threshold-bytes=')) {
      thresholdBytes = positiveInteger(arg.slice('--threshold-bytes='.length), '--threshold-bytes');
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = positiveInteger(arg.slice('--concurrency='.length), '--concurrency');
    } else if (arg.startsWith('--limit=')) {
      limit = positiveInteger(arg.slice('--limit='.length), '--limit');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (requestedApply && rollbackPath) {
    throw new Error('--apply and --rollback cannot be combined');
  }
  if (mode === 'rollback' && !rollbackPath) {
    throw new Error('--rollback requires a manifest path');
  }
  if (mode === 'apply' && !explicitManifest) {
    throw new Error('--apply requires --manifest with a durable absolute path');
  }
  if (mode === 'apply' && !isDurableManifestPath(manifestPath)) {
    throw new Error('--apply --manifest must be an absolute path outside /tmp');
  }
  if (!manifestPath) {
    throw new Error('--manifest cannot be empty');
  }
  if (concurrency > MAX_CONCURRENCY) {
    throw new Error(`--concurrency cannot exceed ${MAX_CONCURRENCY}`);
  }

  return {
    mode,
    thresholdBytes,
    concurrency,
    limit,
    manifestPath,
    rollbackPath,
  };
}

export function extractProductObjectKey(rawUrl: string, bucket: string): string | null {
  const clean = String(rawUrl || '')
    .trim()
    .split('#')[0]
    .split('?')[0];
  if (!clean) return null;

  if (clean.startsWith('//') || /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}\//.test(clean)) {
    return null;
  }

  let pathname = clean;
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) {
    try {
      const parsed = new URL(clean);
      if (!OWNED_MEDIA_HOSTS.has(parsed.hostname.toLowerCase())) return null;
      pathname = parsed.pathname;
    } catch {
      return null;
    }
  }

  let candidate = pathname;
  const mediaIndex = pathname.indexOf('/media/');
  const bucketToken = `/${bucket}/`;
  const bucketIndex = pathname.indexOf(bucketToken);
  if (mediaIndex >= 0) {
    candidate = pathname.slice(mediaIndex + '/media/'.length);
  } else if (bucketIndex >= 0) {
    candidate = pathname.slice(bucketIndex + bucketToken.length);
  } else {
    candidate = pathname.replace(/^\/+/, '');
  }

  const key = sanitizeObjectKey(candidate);
  return key?.startsWith('products/') ? key : null;
}

export function replacementUrl(oldUrl: string, oldKey: string, newKey: string): string {
  const clean = oldUrl.trim().split('#')[0].split('?')[0];
  const keyIndex = clean.lastIndexOf(oldKey);
  if (keyIndex < 0) {
    throw new Error('Image URL does not contain its storage key');
  }
  return `${clean.slice(0, keyIndex)}${newKey}`;
}

export function contentHashedObjectKey(buffer: Buffer): {
  key: string;
  sha256: string;
} {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  return {
    key: `products/optimized/${sha256.slice(0, 24)}.webp`,
    sha256,
  };
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown error');
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')
    .replace(/password=\S+/gi, 'password=[redacted]')
    .replace(/secretKey=\S+/gi, 'secretKey=[redacted]');
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  work: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  async function consume() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await work(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => consume()));
  return output;
}

async function streamToBuffer(stream: Readable, expectedBytes: number): Promise<Buffer> {
  if (expectedBytes > MAX_INPUT_BYTES) {
    throw new Error(`Image exceeds ${MAX_INPUT_BYTES} byte safety limit`);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_INPUT_BYTES) {
      stream.destroy();
      throw new Error(`Image exceeds ${MAX_INPUT_BYTES} byte safety limit`);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

function createMinioClient(): {
  client: MinioClientLike;
  bucket: string;
} {
  const Minio = require('minio') as {
    Client: new (options: Record<string, unknown>) => MinioClientLike;
  };
  const bucket = process.env.MINIO_BUCKET || 'taranom-products';
  const client = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number(process.env.MINIO_PORT || 9000),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_USER || 'taranom_minio',
    secretKey: process.env.MINIO_PASS || '',
  });
  return { client, bucket };
}

async function collectSourceGroups(
  dataSource: DataSource,
  bucket: string
): Promise<{
  productCount: number;
  referenceCount: number;
  groups: SourceGroup[];
  unsupported: BackfillManifest['skipped'];
}> {
  const products: Array<{ id: string; images: unknown }> = await dataSource.query(
    `SELECT id, images FROM products WHERE status = $1 AND "deletedAt" IS NULL ORDER BY id ASC`,
    ['ACTIVE'],
  );
  const variants: Array<{ id: string; productId: string; imageUrl: string | null }> =
    products.length === 0
      ? []
      : await dataSource.query(
          `SELECT id, "productId", "imageUrl"
           FROM product_variants
           WHERE "productId" = ANY($1::uuid[])
           ORDER BY id ASC`,
          [products.map((product) => product.id)],
        );
  const variantsByProduct = new Map<string, typeof variants>();
  for (const variant of variants) {
    const rows = variantsByProduct.get(variant.productId) ?? [];
    rows.push(variant);
    variantsByProduct.set(variant.productId, rows);
  }

  const byUrl = new Map<string, BackfillReference[]>();
  const unsupported: BackfillManifest['skipped'] = [];
  let referenceCount = 0;

  const add = (url: string, reference: BackfillReference) => {
    const normalized = String(url || '').trim();
    if (!normalized) return;
    referenceCount += 1;
    if (!extractProductObjectKey(normalized, bucket)) {
      unsupported.push({ url: normalized, reason: 'unsupported-storage-url' });
      return;
    }
    const refs = byUrl.get(normalized) ?? [];
    refs.push(reference);
    byUrl.set(normalized, refs);
  };

  for (const product of products) {
    (Array.isArray(product.images) ? product.images : []).forEach((url, index) => {
      add(url, { kind: 'product', id: product.id, index });
    });
    for (const variant of variantsByProduct.get(product.id) ?? []) {
      if (variant.imageUrl) {
        add(variant.imageUrl, {
          kind: 'variant',
          id: variant.id,
          productId: product.id,
        });
      }
    }
  }

  const groups = [...byUrl.entries()]
    .map(([url, references]) => ({
      url,
      key: extractProductObjectKey(url, bucket) as string,
      references,
    }))
    .sort((a, b) => a.url.localeCompare(b.url));

  return { productCount: products.length, referenceCount, groups, unsupported };
}

async function ensureTargetObject(
  client: MinioClientLike,
  bucket: string,
  key: string,
  buffer: Buffer
): Promise<void> {
  try {
    const existing = await client.statObject(bucket, key);
    if (Number(existing.size) !== buffer.length) {
      throw new Error('Content-hashed object exists with an unexpected size');
    }
    return;
  } catch (error) {
    if (!isMissingObjectError(error)) throw error;
  }

  await client.putObject(bucket, key, buffer, buffer.length, {
    'Content-Type': 'image/webp',
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
}

async function writeNewManifest(path: string, manifest: BackfillManifest): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
}

async function replaceManifest(path: string, manifest: BackfillManifest): Promise<void> {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'w',
    mode: 0o600,
  });
  await rename(temporary, path);
}

function desiredUrls(
  replacement: BackfillReplacement,
  direction: 'apply' | 'rollback'
): { expected: string; desired: string } {
  return direction === 'apply'
    ? { expected: replacement.oldUrl, desired: replacement.newUrl }
    : { expected: replacement.newUrl, desired: replacement.oldUrl };
}

async function persistManifestRow(dataSource: DataSource, path: string, manifest: BackfillManifest) {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "product_image_backfill_manifests" (
      "path" text PRIMARY KEY,
      "payload" jsonb NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await dataSource.query(
    `
      INSERT INTO "product_image_backfill_manifests" ("path", "payload")
      VALUES ($1, $2::jsonb)
      ON CONFLICT ("path") DO UPDATE
      SET "payload" = EXCLUDED."payload", "updatedAt" = now()
    `,
    [path, JSON.stringify(manifest)],
  );
}

async function mutateReferences(
  dataSource: DataSource,
  manifest: BackfillManifest,
  direction: 'apply' | 'rollback'
): Promise<{ changedReferences: number; alreadyDesiredReferences: number }> {
  return dataSource.transaction(async (manager) => {
    await manager.query('SELECT pg_advisory_xact_lock($1)', [ADVISORY_LOCK_KEY]);
    let changedReferences = 0;
    let alreadyDesiredReferences = 0;
    const productChanges = new Map<
      string,
      Array<{
        reference: Extract<BackfillReference, { kind: 'product' }>;
        replacement: BackfillReplacement;
      }>
    >();
    const variantChanges = new Map<
      string,
      Array<{
        reference: Extract<BackfillReference, { kind: 'variant' }>;
        replacement: BackfillReplacement;
      }>
    >();

    for (const replacement of manifest.replacements) {
      for (const reference of replacement.references) {
        if (reference.kind === 'product') {
          const rows = productChanges.get(reference.id) ?? [];
          rows.push({ reference, replacement });
          productChanges.set(reference.id, rows);
        } else {
          const rows = variantChanges.get(reference.id) ?? [];
          rows.push({ reference, replacement });
          variantChanges.set(reference.id, rows);
        }
      }
    }

    for (const [id, changes] of productChanges) {
      const locked: Array<{ id: string; images: unknown }> = await manager.query(
        `SELECT id, images FROM products WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const product = locked[0];
      if (!product) throw new Error(`Product reference disappeared: ${id}`);
      const images = [...(Array.isArray(product.images) ? product.images : [])];
      let changed = false;
      for (const { reference, replacement } of changes) {
        const { expected, desired } = desiredUrls(replacement, direction);
        const current = images[reference.index];
        if (current === desired) {
          alreadyDesiredReferences += 1;
          continue;
        }
        if (current !== expected) {
          throw new Error(`Concurrent product image change detected for ${id}[${reference.index}]`);
        }
        images[reference.index] = desired;
        changedReferences += 1;
        changed = true;
      }
      if (changed) {
        await manager.query(
          `UPDATE products SET images = $1::jsonb, "updatedAt" = now() WHERE id = $2`,
          [JSON.stringify(images), id],
        );
      }
    }

    for (const [id, changes] of variantChanges) {
      if (changes.length !== 1) {
        throw new Error(`Duplicate variant reference in manifest: ${id}`);
      }
      const { replacement } = changes[0];
      const locked: Array<{ id: string; imageUrl: string | null }> = await manager.query(
        `SELECT id, "imageUrl" FROM product_variants WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const variant = locked[0];
      if (!variant) throw new Error(`Variant reference disappeared: ${id}`);
      const { expected, desired } = desiredUrls(replacement, direction);
      if (variant.imageUrl === desired) {
        alreadyDesiredReferences += 1;
      } else {
        if (variant.imageUrl !== expected) {
          throw new Error(`Concurrent variant image change detected for ${id}`);
        }
        await manager.query(
          `UPDATE product_variants SET "imageUrl" = $1, "updatedAt" = now() WHERE id = $2`,
          [desired, id],
        );
        changedReferences += 1;
      }
    }

    if (direction === 'apply' && manifest.replacements.length) {
      for (const replacement of manifest.replacements) {
        await manager.query(
          `
            INSERT INTO "omnichannel_media_assets"
              ("publicUrl", "storageKey", "altText", "ownerType", "ownerId", "createdBy")
            VALUES ($1, $2, '', 'PRODUCT_BACKFILL', NULL, NULL)
            ON CONFLICT ("publicUrl") DO NOTHING
          `,
          [replacement.newUrl, replacement.newKey],
        );
      }
    }

    return { changedReferences, alreadyDesiredReferences };
  });
}

function validateRollbackManifest(value: unknown): BackfillManifest {
  if (!value || typeof value !== 'object') throw new Error('Manifest must be an object');
  const manifest = value as Partial<BackfillManifest>;
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error('Unsupported manifest schema');
  }
  if (!Array.isArray(manifest.replacements) || manifest.replacements.length > 10_000) {
    throw new Error('Manifest replacements are invalid');
  }

  for (const replacement of manifest.replacements) {
    if (
      !replacement ||
      typeof replacement.oldUrl !== 'string' ||
      typeof replacement.newUrl !== 'string' ||
      replacement.oldUrl.length > 2048 ||
      replacement.newUrl.length > 2048 ||
      !sanitizeObjectKey(replacement.oldKey) ||
      !sanitizeObjectKey(replacement.newKey) ||
      !replacement.newKey.startsWith('products/optimized/') ||
      !Array.isArray(replacement.references)
    ) {
      throw new Error('Manifest replacement is invalid');
    }
    for (const reference of replacement.references) {
      if (
        !reference ||
        typeof reference.id !== 'string' ||
        !reference.id ||
        (reference.kind === 'product' &&
          (!Number.isSafeInteger(reference.index) || reference.index < 0)) ||
        (reference.kind !== 'product' && reference.kind !== 'variant')
      ) {
        throw new Error('Manifest reference is invalid');
      }
    }
  }
  return manifest as BackfillManifest;
}

async function readRollbackManifestFile(path: string): Promise<BackfillManifest> {
  const raw = await readFile(path, 'utf8');
  if (raw.length > 10 * 1024 * 1024) throw new Error('Manifest is too large');
  return validateRollbackManifest(JSON.parse(raw) as unknown);
}

async function readRollbackManifest(
  dataSource: DataSource,
  path: string,
): Promise<BackfillManifest> {
  try {
    return await readRollbackManifestFile(path);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code !== 'ENOENT') throw error;
  }
  const rows: Array<{ payload: unknown }> = await dataSource.query(
    `SELECT payload FROM "product_image_backfill_manifests" WHERE path = $1`,
    [path],
  );
  if (!rows[0]) throw new Error(`Manifest not found: ${path}`);
  return validateRollbackManifest(rows[0].payload);
}

async function runRollback(dataSource: DataSource, path: string): Promise<void> {
  const manifest = await readRollbackManifest(dataSource, path);
  const result = await mutateReferences(dataSource, manifest, 'rollback');
  manifest.status = 'rolled-back';
  manifest.rollback = { at: new Date().toISOString(), ...result };
  await replaceManifest(path, manifest);
  await persistManifestRow(dataSource, path, manifest);
  console.log(
    JSON.stringify({
      type: 'rollback-complete',
      manifest: path,
      ...result,
      originalsDeleted: false,
      outboxEventsWritten: false,
    })
  );
}

async function runBackfill(
  dataSource: DataSource,
  options: BackfillCliOptions
): Promise<void> {
  const { client, bucket } = createMinioClient();
  const collected = await collectSourceGroups(dataSource, bucket);
  const skipped: BackfillManifest['skipped'] = [...collected.unsupported];
  const errors: BackfillManifest['errors'] = [];

  const inspected = await mapWithConcurrency(
    collected.groups,
    options.concurrency,
    async (group) => {
      try {
        const stat = await client.statObject(bucket, group.key);
        return {
          group,
          size: Number(stat.size),
          error: null as string | null,
          missing: false,
        };
      } catch (error) {
        if (isMissingObjectError(error)) {
          return { group, size: 0, error: null as string | null, missing: true };
        }
        return {
          group,
          size: 0,
          error: safeErrorMessage(error),
          missing: false,
        };
      }
    }
  );

  const eligible: Array<SourceGroup & { size: number }> = [];
  for (const row of inspected) {
    if (row.missing) {
      skipped.push({
        url: row.group.url,
        key: row.group.key,
        reason: 'source-missing',
      });
    } else if (row.error) {
      errors.push({ url: row.group.url, message: row.error });
    } else if (row.size <= options.thresholdBytes) {
      skipped.push({
        url: row.group.url,
        key: row.group.key,
        size: row.size,
        reason: 'at-or-below-threshold',
      });
    } else if (row.size > MAX_INPUT_BYTES) {
      errors.push({
        url: row.group.url,
        message: `Image exceeds ${MAX_INPUT_BYTES} byte safety limit`,
      });
    } else {
      eligible.push({ ...row.group, size: row.size });
    }
  }

  const selected = options.limit == null ? eligible : eligible.slice(0, options.limit);
  const processingByKey = new Map<
    string,
    Promise<
      | { status: 'ready'; buffer: Buffer; key: string; sha256: string }
      | { status: 'skip'; reason: string; outputSize: number }
    >
  >();

  const prepareKey = (row: SourceGroup & { size: number }) => {
    const cached = processingByKey.get(row.key);
    if (cached) return cached;
    const pending = (async () => {
      const source = await client.getObject(bucket, row.key);
      const input = await streamToBuffer(source, row.size);
      const processed = await processProductImage(input, 'application/octet-stream');
      if (processed.buffer.length >= row.size) {
        return {
          status: 'skip' as const,
          reason: 'optimized-output-not-smaller',
          outputSize: processed.buffer.length,
        };
      }
      const hashed = contentHashedObjectKey(processed.buffer);
      if (options.mode === 'apply') {
        await ensureTargetObject(client, bucket, hashed.key, processed.buffer);
      }
      return {
        status: 'ready' as const,
        buffer: processed.buffer,
        key: hashed.key,
        sha256: hashed.sha256,
      };
    })();
    processingByKey.set(row.key, pending);
    return pending;
  };

  const prepared = await mapWithConcurrency(selected, options.concurrency, async (row) => {
    try {
      const result = await prepareKey(row);
      if (result.status === 'skip') {
        skipped.push({
          url: row.url,
          key: row.key,
          size: row.size,
          reason: `${result.reason}:${result.outputSize}`,
        });
        return null;
      }
      return {
        oldUrl: row.url,
        newUrl: replacementUrl(row.url, row.key, result.key),
        oldKey: row.key,
        newKey: result.key,
        oldSize: row.size,
        newSize: result.buffer.length,
        sha256: result.sha256,
        references: row.references,
      } satisfies BackfillReplacement;
    } catch (error) {
      if (isMissingObjectError(error)) {
        skipped.push({
          url: row.url,
          key: row.key,
          size: row.size,
          reason: 'source-missing',
        });
        return null;
      }
      if (error instanceof ProductImageProcessingError) {
        skipped.push({
          url: row.url,
          key: row.key,
          size: row.size,
          reason: 'source-unprocessable',
        });
        return null;
      }
      errors.push({ url: row.url, message: safeErrorMessage(error) });
      return null;
    }
  });

  const manifest: BackfillManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    status: options.mode === 'apply' ? 'prepared' : 'dry-run',
    config: {
      activeProductsOnly: true,
      thresholdBytes: options.thresholdBytes,
      concurrency: options.concurrency,
      limit: options.limit,
      originalsDeleted: false,
      outboxEventsWritten: false,
    },
    scope: {
      products: collected.productCount,
      references: collected.referenceCount,
      uniqueUrls: collected.groups.length,
      eligibleUrls: eligible.length,
      selectedUrls: selected.length,
    },
    replacements: prepared.filter((row): row is BackfillReplacement => row !== null),
    skipped,
    errors,
  };

  if (errors.length) manifest.status = 'failed';
  await writeNewManifest(options.manifestPath, manifest);

  if (errors.length) {
    throw new Error(
      `Backfill stopped before DB mutation with ${errors.length} error(s); see ${options.manifestPath}`
    );
  }

  if (options.mode === 'apply') {
    const result = await mutateReferences(dataSource, manifest, 'apply');
    manifest.status = 'applied';
    manifest.apply = { at: new Date().toISOString(), ...result };
    await replaceManifest(options.manifestPath, manifest);
    await persistManifestRow(dataSource, options.manifestPath, manifest);
  }

  console.log(
    JSON.stringify({
      type: 'backfill-complete',
      mode: options.mode,
      manifest: options.manifestPath,
      scope: manifest.scope,
      replacements: manifest.replacements.length,
      skipped: manifest.skipped.length,
      apply: manifest.apply,
      originalsDeleted: false,
      outboxEventsWritten: false,
    })
  );
}

async function createStandaloneDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || 'taranom',
    password: process.env.DB_PASS || 'taranom_pass',
    database: process.env.DB_NAME || 'taranom_db',
    entities: [],
    migrationsRun: false,
    synchronize: false,
    logging: false,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await dataSource.initialize();
  return dataSource;
}

async function main() {
  const options = parseBackfillCliArgs(process.argv.slice(2));
  const dataSource = await createStandaloneDataSource();
  try {
    if (options.mode === 'rollback') {
      await runRollback(dataSource, options.rollbackPath as string);
      return;
    }
    await runBackfill(dataSource, options);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ type: 'fatal', message: safeErrorMessage(error) }));
    process.exit(1);
  });
}
