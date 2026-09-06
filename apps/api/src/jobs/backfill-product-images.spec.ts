import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  contentHashedObjectKey,
  extractProductObjectKey,
  isDurableManifestPath,
  parseBackfillCliArgs,
  replacementUrl,
} from './backfill-product-images';

function main() {
  const fixed = new Date('2026-09-06T12:00:00.000Z');
  const defaults = parseBackfillCliArgs([], fixed);
  assert.equal(defaults.mode, 'dry-run');
  assert.equal(defaults.thresholdBytes, 500 * 1024);
  assert.equal(defaults.concurrency, 2);
  assert.equal(defaults.limit, null);
  assert.match(defaults.manifestPath, /^\/tmp\/taranom-product-image-backfill-/);

  const apply = parseBackfillCliArgs(
    [
      '--apply',
      '--threshold-bytes=600000',
      '--concurrency=1',
      '--limit=5',
      '--manifest=/var/lib/taranom/backfills/batch-1.json',
    ],
    fixed
  );
  assert.deepEqual(apply, {
    mode: 'apply',
    thresholdBytes: 600000,
    concurrency: 1,
    limit: 5,
    manifestPath: '/var/lib/taranom/backfills/batch-1.json',
    rollbackPath: undefined,
  });

  const rollback = parseBackfillCliArgs(['--rollback=/tmp/batch-1.json'], fixed);
  assert.equal(rollback.mode, 'rollback');
  assert.equal(rollback.rollbackPath, '/tmp/batch-1.json');
  assert.throws(() => parseBackfillCliArgs(['--concurrency=5'], fixed));
  assert.throws(() => parseBackfillCliArgs(['--apply', '--rollback=x'], fixed));
  assert.throws(() => parseBackfillCliArgs(['--typo'], fixed));
  assert.throws(() => parseBackfillCliArgs(['--apply'], fixed));
  assert.throws(() => parseBackfillCliArgs(['--apply', '--manifest=/tmp/batch-1.json'], fixed));
  assert.equal(isDurableManifestPath('/var/lib/taranom/backfills/batch-1.json'), true);
  assert.equal(isDurableManifestPath('/tmp/batch-1.json'), false);

  const source = readFileSync(join(__dirname, 'backfill-product-images.ts'), 'utf8');
  assert.equal(source.includes('AppModule'), false);
  assert.equal(source.includes('createApplicationContext'), false);

  const bucket = 'taranom-products';
  const key = 'products/1787994011222-f508abcb99eb3.jpg';
  assert.equal(extractProductObjectKey(`https://poshaktaranom.com/media/${key}`, bucket), key);
  assert.equal(extractProductObjectKey(`http://minio:9000/${bucket}/${key}`, bucket), key);
  assert.equal(extractProductObjectKey(key, bucket), key);
  assert.equal(extractProductObjectKey('https://example.com/external/photo.jpg', bucket), null);
  assert.equal(extractProductObjectKey('https://external.example/products/a.jpg', bucket), null);
  assert.equal(extractProductObjectKey('https://external.example/media/products/a.jpg', bucket), null);
  assert.equal(extractProductObjectKey('//evil.com/media/products/a.jpg', bucket), null);
  assert.equal(extractProductObjectKey('evil.com/media/products/a.jpg', bucket), null);
  assert.equal(extractProductObjectKey('/media/products/%2e%2e/secret.jpg', bucket), null);

  const hashed = contentHashedObjectKey(Buffer.from('optimized-image'));
  assert.match(hashed.sha256, /^[a-f0-9]{64}$/);
  assert.equal(hashed.key, `products/optimized/${hashed.sha256.slice(0, 24)}.webp`);
  assert.deepEqual(contentHashedObjectKey(Buffer.from('optimized-image')), hashed);
  assert.equal(
    replacementUrl(`https://poshaktaranom.com/media/${key}?v=old`, key, hashed.key),
    `https://poshaktaranom.com/media/${hashed.key}`
  );

  console.log('backfill-product-images.spec.ts: ok');
}

main();
