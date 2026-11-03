import { randomUUID } from 'crypto';
import { VIDEO_SRC_BUCKET } from './video-policy';

async function main() {
  const endpointValue = process.env.MINIO_TEST_ENDPOINT;
  if (!endpointValue) {
    console.log('video private bucket integration: skipped (MINIO_TEST_ENDPOINT unset)');
    return;
  }
  const endpoint = new URL(endpointValue);
  const Minio = require('minio');
  const client = new Minio.Client({
    endPoint: endpoint.hostname,
    port: Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80)),
    useSSL: endpoint.protocol === 'https:',
    accessKey: process.env.MINIO_TEST_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_TEST_SECRET_KEY || 'minioadmin',
  });
  if (!(await client.bucketExists(VIDEO_SRC_BUCKET))) {
    await client.makeBucket(VIDEO_SRC_BUCKET);
  }
  const key = `integration/${randomUUID()}.mp4`;
  try {
    await client.putObject(VIDEO_SRC_BUCKET, key, Buffer.from('private-video-test'));
    const rawUrl = `${endpoint.origin}/${VIDEO_SRC_BUCKET}/${key}`;
    const response = await fetch(rawUrl, { redirect: 'manual' });
    if (response.status !== 403) {
      throw new Error(`expected unauthenticated raw GET 403, got ${response.status}`);
    }
  } finally {
    await client.removeObject(VIDEO_SRC_BUCKET, key).catch(() => undefined);
  }
  console.log('video private bucket integration: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
