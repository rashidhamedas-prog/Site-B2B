import assert from 'node:assert/strict';
import {
  buildProductVideoJsonLd,
  fetchPublicProductVideo,
  normalizePublicProductVideo,
  videoDurationIso,
  VIDEO_JSONLD_ENABLED,
  type PublicProductVideo,
} from './product-video-public';
import { serializeJsonLd } from '../components/shared/JsonLd';

const video: PublicProductVideo = {
  mp4_720: 'https://poshaktaranom.com/media/video/720.mp4',
  mp4_480: 'https://poshaktaranom.com/media/video/480.mp4',
  webm_720: 'https://poshaktaranom.com/media/video/720.webm',
  poster: 'https://poshaktaranom.com/media/video/poster.webp',
  duration_sec: 12,
  width: 720,
  height: 960,
  upload_date: '2026-11-03T08:00:00.000Z',
};

async function run() {
  assert.equal(VIDEO_JSONLD_ENABLED, false);
  assert.equal(videoDurationIso(12.4), 'PT12S');
  assert.equal(normalizePublicProductVideo({ ...video, sort_order: undefined })?.sort_order, 2);
  assert.equal(normalizePublicProductVideo({ ...video, poster: null }), null);
  assert.equal(normalizePublicProductVideo({ ...video, poster: 'javascript:alert(1)' }), null);
  assert.equal(normalizePublicProductVideo({ ...video, mp4_720: 'data:video/mp4,unsafe' }), null);
  assert.equal(
    normalizePublicProductVideo({
      ...video,
      poster: '/media/video/poster.webp',
      mp4_720: '/media/video/720.mp4',
      mp4_480: 'javascript:alert(1)',
      webm_720: 'blob:unsafe',
    })?.mp4_480,
    undefined,
  );
  assert.equal(
    normalizePublicProductVideo({
      ...video,
      mp4_480: 'javascript:alert(1)',
      webm_720: 'blob:unsafe',
    })?.webm_720,
    undefined,
  );
  assert.equal(buildProductVideoJsonLd(video, 'مانتو تست'), null);
  assert.deepEqual(buildProductVideoJsonLd(video, 'مانتو تست', 'توضیح', true), {
    '@type': 'VideoObject',
    name: 'مانتو تست',
    description: 'توضیح',
    thumbnailUrl: video.poster,
    uploadDate: video.upload_date,
    duration: 'PT12S',
    contentUrl: video.mp4_720,
  });
  assert.equal(buildProductVideoJsonLd({ ...video, upload_date: null }, 'مانتو تست', '', true), null);

  const dangerousName = '</script><script>alert(1)</script>';
  const serialized = serializeJsonLd({ name: dangerousName });
  assert.equal(serialized.includes('<'), false);
  assert.deepEqual(JSON.parse(serialized), { name: dangerousName });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })) as typeof fetch;
  const startedAt = Date.now();
  const keepProcessAlive = setTimeout(() => undefined, 2_000);
  try {
    assert.equal(await fetchPublicProductVideo('hung-product', 'RETAIL'), null);
    assert(Date.now() - startedAt < 2_000, 'hung video fetch must stop near the 1.5s timeout');
  } finally {
    clearTimeout(keepProcessAlive);
    globalThis.fetch = originalFetch;
  }

  console.log('product-video-public.spec.ts: ok');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
