import {
  Controller, Post, Req, UseGuards,
  BadRequestException, HttpCode, HttpStatus, PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { validate as isUuid } from 'uuid';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StorageService } from './storage.service';
import {
  isProductImageTimeout,
  parseImageProcessProfile,
  ProductImageProcessingError,
} from './image-processor';
import { MAX_UPLOAD_IMAGE_BYTES, uploadImageKind, uploadImageRejection } from './upload-image-policy';
import { readUploadFile, UploadTooLargeError } from './upload-bytes';
import {
  VIDEO_ERROR_MESSAGES,
  VIDEO_MAX_BYTES,
  videoUploadRejection,
} from './video-policy';
import { ProductVideoService } from './product-video.service';

function imageFailureMessage(error: ProductImageProcessingError): string {
  const cause = error.cause instanceof Error ? error.cause.message : String(error.cause ?? '');
  if (/length mismatch/i.test(cause)) {
    return 'فایل ذخیره‌شده ناقص بود و کنار گذاشته شد. دوباره آپلود کنید.';
  }
  if (/EOI|truncated/i.test(cause)) {
    return 'فایل JPEG ناقص است و ذخیره نشد. عکس را دوباره بفرستید.';
  }
  if (/channel jpeg too large|photo_too_large/i.test(cause)) {
    return 'عکس پس از فشرده‌سازی هنوز برای کانال‌ها بزرگ است. فایل کوچک‌تری بفرستید.';
  }
  if (/undecodable|photo_unreadable|channel jpeg key/i.test(cause)) {
    return 'این فایل به‌عنوان تصویر خوانده نشد. jpg، png یا webp سالم بفرستید.';
  }
  return 'این فایل به‌عنوان تصویر خوانده نشد. jpg، png یا webp سالم بفرستید.';
}

function fileTooLarge(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE';
}

@Controller({ path: 'upload', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UploadController {
  constructor(
    private readonly storage: StorageService,
    private readonly productVideos: ProductVideoService,
  ) {}

  @Post('image')
  @HttpCode(HttpStatus.OK)
  async uploadImage(@Req() req: any) {
    if (!this.storage.ready) {
      throw new BadRequestException('سرویس آپلود در دسترس نیست — MinIO را اجرا کنید');
    }

    let data: { filename: string; mimetype: string; file: AsyncIterable<Buffer> };
    try {
      data = await req.file();
    } catch (error) {
      if (fileTooLarge(error)) throw new BadRequestException('حجم عکس بیشتر از ۲۰ مگابایت است.');
      throw error;
    }
    if (!data) throw new BadRequestException('فایلی ارسال نشده');

    const early = uploadImageRejection(data.filename, data.mimetype, 0);
    if (early) throw new BadRequestException(early);

    const file = data.file as AsyncIterable<Buffer> & { truncated?: boolean };
    let buffer: Buffer;
    try {
      // Reject when the parser stops at fileSize (`truncated`) instead of keeping a cut file.
      buffer = await readUploadFile(file, MAX_UPLOAD_IMAGE_BYTES);
    } catch (error) {
      if (error instanceof UploadTooLargeError || fileTooLarge(error)) {
        throw new BadRequestException('حجم عکس بیشتر از ۲۰ مگابایت است.');
      }
      throw error;
    }

    const profile = parseImageProcessProfile(
      typeof req?.query?.profile === 'string' ? req.query.profile : undefined,
    );

    try {
      return await this.storage.uploadBuffer(
        buffer,
        data.mimetype,
        uploadImageKind(data.filename, data.mimetype),
        'products',
        profile,
      );
    } catch (error) {
      if (error instanceof ProductImageProcessingError) {
        if (isProductImageTimeout(error)) {
          throw new BadRequestException('پردازش عکس بیش از حد طول کشید. فایل کوچک‌تری بفرستید.');
        }
        throw new BadRequestException(imageFailureMessage(error));
      }
      throw error;
    }
  }

  @Post('video')
  @HttpCode(HttpStatus.OK)
  async uploadVideo(@Req() req: any) {
    const productId = typeof req?.query?.productId === 'string' ? req.query.productId.trim() : '';
    if (!isUuid(productId)) throw new BadRequestException('شناسه محصول معتبر نیست.');
    if (!this.storage.ready) {
      throw new BadRequestException('سرویس آپلود در دسترس نیست — MinIO را اجرا کنید');
    }
    await this.productVideos.assertProductExists(productId);

    let data: {
      filename: string;
      mimetype: string;
      file: AsyncIterable<Buffer | Uint8Array> & { truncated?: boolean; destroy?: (error?: Error) => void };
    };
    try {
      data = await req.file({ limits: { fileSize: VIDEO_MAX_BYTES, files: 1 } });
    } catch (error) {
      if (fileTooLarge(error)) throw new PayloadTooLargeException(VIDEO_ERROR_MESSAGES.TOO_BIG);
      throw error;
    }
    if (!data) throw new BadRequestException('فایلی ارسال نشده');

    const iterator = data.file[Symbol.asyncIterator]();
    const prefetched: Buffer[] = [];
    let headLength = 0;
    while (headLength < 12) {
      const next = await iterator.next();
      if (next.done) break;
      const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
      prefetched.push(chunk);
      headLength += chunk.length;
    }
    const head = Buffer.concat(prefetched).subarray(0, 12);
    const rejection = videoUploadRejection(data.filename, data.mimetype, 0, head);
    if (rejection) {
      try {
        data.file.destroy?.();
      } catch {
        // Parser may already be closed.
      }
      throw new BadRequestException(rejection);
    }

    const videoId = randomUUID();
    const ext = data.filename.toLowerCase().endsWith('.webm')
      ? 'webm'
      : data.filename.toLowerCase().endsWith('.mov')
        ? 'mov'
        : 'mp4';
    const srcKey = `videos/${productId}/${videoId}/source.${ext}`;
    const file = data.file;
    const stream = Readable.from((async function* () {
      let size = 0;
      const yieldChecked = function* (chunk: Buffer) {
        if (size + chunk.length > VIDEO_MAX_BYTES || file.truncated) {
          throw new UploadTooLargeError();
        }
        size += chunk.length;
        yield chunk;
      };
      for (const chunk of prefetched) yield* yieldChecked(chunk);
      while (true) {
        const next = await iterator.next();
        if (next.done) break;
        const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
        yield* yieldChecked(chunk);
      }
      if (file.truncated) throw new UploadTooLargeError();
    })());

    try {
      await this.storage.putPrivateVideo(srcKey, stream, data.mimetype);
      if (file.truncated) throw new UploadTooLargeError();
      const row = await this.productVideos.queueUploaded(productId, videoId, srcKey);
      return {
        id: row.id,
        product_id: row.productId,
        status: row.status,
        sort_order: row.sortOrder,
      };
    } catch (error) {
      await this.storage.removePrivateVideoKeys([srcKey]).catch(() => undefined);
      if (error instanceof UploadTooLargeError || fileTooLarge(error)) {
        throw new PayloadTooLargeException(VIDEO_ERROR_MESSAGES.TOO_BIG);
      }
      throw error;
    }
  }
}
