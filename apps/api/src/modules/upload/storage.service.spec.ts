/**
 * npx ts-node --transpile-only src/modules/upload/storage.service.spec.ts
 *
 * In-memory MinIO fake — no network, no binaries committed.
 */
import { Readable } from 'node:stream';
import * as assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { StorageService } from './storage.service';
import { ProductImageProcessingError } from './image-processor';
import { CHANNEL_PHOTO_MAX_BYTES, isCompleteJpeg } from './channel-image';
import {
  CHANNEL_JPEG_SUFFIX,
  channelDerivativeKey,
  originalUploadKey,
} from './storage-delete';

function assertFn(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function fakeMinio(opts?: { corruptMain?: boolean }) {
  const objects = new Map<string, Buffer>();
  const removed: string[] = [];
  return {
    objects,
    removed,
    client: {
      async putObject(_bucket: string, key: string, stream: Readable, _size: number) {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        objects.set(key, Buffer.concat(chunks));
      },
      async getObject(_bucket: string, key: string) {
        if (opts?.corruptMain && !key.endsWith(CHANNEL_JPEG_SUFFIX) && !key.startsWith('originals/')) {
          return Readable.from([Buffer.from('not-an-image')]);
        }
        const body = objects.get(key);
        if (!body) {
          const err = new Error('NoSuchKey');
          (err as { code?: string }).code = 'NoSuchKey';
          throw err;
        }
        return Readable.from([body]);
      },
      async statObject(_bucket: string, key: string) {
        const body = objects.get(key);
        if (!body) {
          const err = new Error('NoSuchKey');
          (err as { code?: string }).code = 'NoSuchKey';
          throw err;
        }
        return { size: body.length };
      },
      async removeObject(_bucket: string, key: string) {
        removed.push(key);
        objects.delete(key);
      },
    },
  };
}

function buildService(minio: ReturnType<typeof fakeMinio>['client']) {
  const config = {
    get: (key: string, fallback?: unknown) => {
      if (key === 'MINIO_BUCKET') return 'taranom-products';
      if (key === 'MINIO_PUBLIC_URL') return 'http://localhost:9000/taranom-products';
      return fallback;
    },
  } as unknown as ConfigService;
  const repo = {
    upsert: async () => undefined,
    find: async () => [],
    createQueryBuilder: () => {
      const qb: any = {
        delete: () => qb,
        where: () => qb,
        orWhere: () => qb,
        execute: async () => undefined,
      };
      return qb;
    },
  };
  const dataSource = {
    getRepository: () => repo,
  } as unknown as DataSource;
  const svc = new StorageService(config, dataSource);
  (svc as any).ready = true;
  (svc as any).minioClient = minio;
  (svc as any).bucket = 'taranom-products';
  return svc;
}

async function main() {
  const sharp = require('sharp');
  const png = await sharp({
    create: { width: 800, height: 1000, channels: 3, background: { r: 40, g: 90, b: 130 } },
  })
    .png()
    .toBuffer();

  // Happy path: webp + channel.jpg; no originals by default
  {
    const prev = process.env.KEEP_ORIGINAL_UPLOADS;
    delete process.env.KEEP_ORIGINAL_UPLOADS;
    const fake = fakeMinio();
    const svc = buildService(fake.client);
    const result = await svc.uploadBuffer(png, 'image/png', 'png', 'products', 'product');
    assertFn(result.key.endsWith('.webp'), 'main key is webp');
    const channelKey = channelDerivativeKey(result.key);
    assertFn(!!channelKey && fake.objects.has(result.key), 'main object stored');
    assertFn(!!channelKey && fake.objects.has(channelKey!), 'channel derivative stored');
    const channelBytes = fake.objects.get(channelKey!)!;
    assertFn(isCompleteJpeg(channelBytes), 'channel is complete JPEG');
    assertFn(channelBytes.length <= CHANNEL_PHOTO_MAX_BYTES, 'channel under 1.8MB');
    assertFn([...fake.objects.keys()].every((k) => !k.startsWith('originals/')), 'no originals when flag unset');
    if (prev === undefined) delete process.env.KEEP_ORIGINAL_UPLOADS;
    else process.env.KEEP_ORIGINAL_UPLOADS = prev;
  }

  // KEEP_ORIGINAL_UPLOADS=true stores raw bytes
  {
    const prev = process.env.KEEP_ORIGINAL_UPLOADS;
    process.env.KEEP_ORIGINAL_UPLOADS = 'true';
    const fake = fakeMinio();
    const svc = buildService(fake.client);
    const result = await svc.uploadBuffer(png, 'image/png', 'png', 'products', 'product');
    const originalKey = originalUploadKey(result.key);
    assertFn(!!originalKey && fake.objects.has(originalKey!), 'originals/<key> written');
    assert.deepEqual(fake.objects.get(originalKey!), png);
    if (prev === undefined) delete process.env.KEEP_ORIGINAL_UPLOADS;
    else process.env.KEEP_ORIGINAL_UPLOADS = prev;
  }

  // Undecodable stored bytes → ProductImageProcessingError + rollback all keys
  {
    const fake = fakeMinio({ corruptMain: true });
    const svc = buildService(fake.client);
    await assert.rejects(
      () => svc.uploadBuffer(png, 'image/png', 'png', 'products', 'product'),
      (err: unknown) => err instanceof ProductImageProcessingError,
    );
    assertFn(fake.objects.size === 0, 'rollback cleared written objects');
    assertFn(fake.removed.length >= 1, 'removeObject called during rollback');
  }

  // deleteByUrls removes main + channel + originals; missing derivative is ok
  {
    const fake = fakeMinio();
    const mainKey = 'products/delete-me.webp';
    const channelKey = `${mainKey}${CHANNEL_JPEG_SUFFIX}`;
    const originalKey = `originals/${mainKey}`;
    fake.objects.set(mainKey, Buffer.from('webp'));
    fake.objects.set(originalKey, Buffer.from('raw'));
    // intentionally no channelKey — missing derivative must not fail
    const svc = buildService(fake.client);
    await svc.deleteByUrls([`http://localhost:9000/taranom-products/${mainKey}`]);
    assertFn(fake.removed.includes(mainKey), 'main removed');
    assertFn(fake.removed.includes(channelKey), 'channel key remove attempted');
    assertFn(fake.removed.includes(originalKey), 'original removed');
    assertFn(!fake.objects.has(mainKey) && !fake.objects.has(originalKey), 'objects gone');
  }

  console.log('storage.service.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
