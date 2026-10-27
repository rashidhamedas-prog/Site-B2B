import { MAX_INPUT_PIXELS, ProductImageProcessingError, type SharpFactory } from './image-processor';

/**
 * Busboy / @fastify/multipart ends the file stream at `limits.fileSize` and sets
 * `truncated` without rejecting the `for await` consumer. The old 5 MiB cap
 * therefore stored a buffer of exactly 5_242_880 bytes (JPEG with no EOI).
 * `size > limit` does not catch that case, because size === limit.
 */
export class UploadTooLargeError extends Error {
  constructor() {
    super('upload exceeds size limit');
    this.name = 'UploadTooLargeError';
  }
}

export type UploadByteStream = AsyncIterable<Buffer | Uint8Array> & {
  truncated?: boolean;
  destroy?: (error?: Error) => void;
};

export async function readUploadFile(file: UploadByteStream, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  const tooBig = (): never => {
    try {
      file.destroy?.(new UploadTooLargeError());
    } catch {
      // The parser may already have closed the stream.
    }
    throw new UploadTooLargeError();
  };
  try {
    for await (const chunk of file) {
      if (file.truncated) tooBig();
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (size + buf.length > maxBytes) tooBig();
      chunks.push(buf);
      size += buf.length;
      if (file.truncated) tooBig();
    }
  } catch (err) {
    if (err instanceof UploadTooLargeError) throw err;
    if (file.truncated) tooBig();
    throw err;
  }
  if (file.truncated) tooBig();
  return Buffer.concat(chunks);
}

/** A JPEG cut at a body-size cap still starts with SOI and does not end with EOI. */
export function jpegEndsWithEoi(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  return buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
}

export function rejectTruncatedJpeg(buffer: Buffer): void {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8 && !jpegEndsWithEoi(buffer)) {
    throw new ProductImageProcessingError(new Error('jpeg truncated before EOI'));
  }
}

export async function assertDecodableImage(
  buffer: Buffer,
): Promise<{ format: string; width: number; height: number }> {
  if (!buffer.length) throw new ProductImageProcessingError(new Error('empty image'));
  rejectTruncatedJpeg(buffer);
  const sharp = ((require('sharp') as any).default ?? require('sharp')) as SharpFactory;
  let meta: { format?: string; width?: number; height?: number };
  try {
    meta = await sharp(buffer, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch (err) {
    throw new ProductImageProcessingError(err);
  }
  if (!meta.format || !meta.width || !meta.height) {
    throw new ProductImageProcessingError(new Error('undecodable image'));
  }
  return { format: meta.format, width: meta.width, height: meta.height };
}

/** Bytes read back from storage must match what we wrote and still decode. */
export async function confirmStoredImage(stored: Buffer, expectedLength: number): Promise<void> {
  if (stored.length !== expectedLength) {
    throw new ProductImageProcessingError(new Error('stored image length mismatch'));
  }
  await assertDecodableImage(stored);
}
