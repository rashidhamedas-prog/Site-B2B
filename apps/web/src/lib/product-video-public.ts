import { cache } from 'react';
import type { SalesChannel } from '@/lib/channel';
import { getServerApiBase } from '@/lib/server-api-base';

export const VIDEO_JSONLD_ENABLED = false;

export type PublicProductVideo = {
  mp4_720: string;
  mp4_480?: string | null;
  webm_720?: string | null;
  poster: string | null;
  duration_sec: number;
  width: number;
  height: number;
  sort_order?: number;
  upload_date?: string | null;
};

export function normalizePublicProductVideo(
  value: PublicProductVideo | null | undefined,
): PublicProductVideo | null {
  if (!value || !isAllowedPublicMediaUrl(value.poster) || !isAllowedPublicMediaUrl(value.mp4_720)) {
    return null;
  }
  return {
    ...value,
    poster: value.poster,
    mp4_720: value.mp4_720,
    mp4_480: isAllowedPublicMediaUrl(value.mp4_480) ? value.mp4_480 : undefined,
    webm_720: isAllowedPublicMediaUrl(value.webm_720) ? value.webm_720 : undefined,
    sort_order: Math.max(2, Math.trunc(Number(value.sort_order) || 2)),
  };
}

function isAllowedPublicMediaUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('/media/'))
  );
}

/** Public PDP video metadata. React cache dedupes route/metadata reads; Next keeps parity with PDP ISR. */
export const fetchPublicProductVideo = cache(async function fetchPublicProductVideo(
  productId: string,
  channel: SalesChannel,
): Promise<PublicProductVideo | null> {
  if (!productId) return null;
  try {
    const response = await fetch(
      `${getServerApiBase()}/products/${encodeURIComponent(productId)}/video/public?channel=${channel}`,
      {
        signal: AbortSignal.timeout(1_500),
        next: {
          revalidate: 60,
          tags: ['catalog', `catalog:${channel}`, `product-video:${productId}`],
        },
      },
    );
    if (!response.ok) return null;
    return normalizePublicProductVideo(
      (await response.json()) as PublicProductVideo | null,
    );
  } catch {
    return null;
  }
});

export function videoDurationIso(seconds: number): string {
  return `PT${Math.max(0, Math.round(Number(seconds) || 0))}S`;
}

export function buildProductVideoJsonLd(
  video: PublicProductVideo | null | undefined,
  name: string,
  description?: string,
  enabled = VIDEO_JSONLD_ENABLED,
): Record<string, unknown> | null {
  if (!enabled || !video?.poster || !video.upload_date || !video.mp4_720) return null;
  return {
    '@type': 'VideoObject',
    name,
    description: description || name,
    thumbnailUrl: video.poster,
    uploadDate: video.upload_date,
    duration: videoDurationIso(video.duration_sec),
    contentUrl: video.mp4_720,
  };
}
