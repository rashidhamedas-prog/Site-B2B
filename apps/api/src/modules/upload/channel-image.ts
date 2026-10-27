import { withSharpSlot, type SharpFactory } from './image-processor';

/** Default site→messenger derivative: under Bale’s practical 2 MB photo cap. */
export const CHANNEL_PHOTO_MAX_BYTES = Math.floor(1.8 * 1024 * 1024);
export const CHANNEL_PHOTO_LONG_EDGE = 1600;
export const CHANNEL_JPEG_QUALITY = 82;
export const CHANNEL_JPEG_MIN_QUALITY = 55;
/** Long-edge steps after quality has already bottomed out (or when starting below the top). */
export const CHANNEL_EDGE_LADDER = [2560, 1600, 1280, 1024] as const;

export type PrepareChannelJpegOptions = {
  maxBytes: number;
  longEdge: number;
  minQuality?: number;
};

export type PreparedChannelJpeg = {
  bytes: Buffer;
  contentType: 'image/jpeg';
  filename: string;
};

function loadSharp(): SharpFactory | null {
  try {
    return require('sharp') as SharpFactory;
  } catch {
    return null;
  }
}

export function isCompleteJpeg(bytes: Buffer): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return false;
  return bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

/** Descending unique edges: requested longEdge first, then smaller ladder steps. */
export function channelEdgeSteps(longEdge: number): number[] {
  const start = Math.max(1, Math.floor(longEdge));
  const steps = [start, ...CHANNEL_EDGE_LADDER.filter((edge) => edge < start)];
  return [...new Set(steps)].sort((a, b) => b - a);
}

/**
 * Any readable buffer → JPEG under `maxBytes`.
 * Quality steps 82→minQuality first at each long edge, then the next smaller edge.
 * Uses the shared Sharp concurrency slot from image-processor.
 */
export async function prepareChannelJpeg(
  input: Buffer,
  options: PrepareChannelJpegOptions,
): Promise<PreparedChannelJpeg> {
  if (!input.length) throw new Error('photo_unreadable');
  const maxBytes = Math.max(1, Math.floor(options.maxBytes));
  const minQuality = Math.max(1, Math.min(CHANNEL_JPEG_QUALITY, options.minQuality ?? CHANNEL_JPEG_MIN_QUALITY));
  const sharp = loadSharp();
  if (!sharp) {
    if (!isCompleteJpeg(input)) throw new Error('photo_unreadable');
    if (input.length > maxBytes) throw new Error('photo_too_large');
    return { bytes: input, contentType: 'image/jpeg', filename: 'photo.jpg' };
  }

  return withSharpSlot(async () => {
    const edges = channelEdgeSteps(options.longEdge);
    let lastError: 'photo_unreadable' | 'photo_too_large' | null = null;
    for (const edge of edges) {
      for (let quality = CHANNEL_JPEG_QUALITY; quality >= minQuality; quality -= 10) {
        let bytes: Buffer;
        try {
          bytes = await sharp(input, { failOn: 'warning', limitInputPixels: 60_000_000 })
            .rotate()
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality, mozjpeg: true })
            .timeout({ seconds: 15 })
            .toBuffer();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (/timeout/i.test(message)) {
            const timeout = new Error('timeout');
            timeout.name = 'TimeoutError';
            throw timeout;
          }
          throw new Error('photo_unreadable');
        }
        if (!bytes.length || !isCompleteJpeg(bytes)) {
          lastError = 'photo_unreadable';
          continue;
        }
        if (bytes.length > maxBytes) {
          lastError = 'photo_too_large';
          continue;
        }
        try {
          const meta = await sharp(bytes, { failOn: 'warning', limitInputPixels: 60_000_000 }).metadata();
          if (!meta.width || !meta.height) {
            lastError = 'photo_unreadable';
            continue;
          }
        } catch {
          lastError = 'photo_unreadable';
          continue;
        }
        return { bytes, contentType: 'image/jpeg', filename: 'photo.jpg' };
      }
    }
    throw new Error(lastError === 'photo_unreadable' ? 'photo_unreadable' : 'photo_too_large');
  });
}
