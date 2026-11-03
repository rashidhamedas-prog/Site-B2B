import assert from 'node:assert/strict';
import {
  buildProductVideoJsonLd,
  normalizePublicProductVideo,
  videoDurationIso,
  VIDEO_JSONLD_ENABLED,
  type PublicProductVideo,
} from './product-video-public';

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

assert.equal(VIDEO_JSONLD_ENABLED, false);
assert.equal(videoDurationIso(12.4), 'PT12S');
assert.equal(normalizePublicProductVideo({ ...video, sort_order: undefined })?.sort_order, 2);
assert.equal(normalizePublicProductVideo({ ...video, poster: null }), null);
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

console.log('product-video-public.spec.ts: ok');
