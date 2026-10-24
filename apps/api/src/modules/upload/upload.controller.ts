import {
  Controller, Post, Req, UseGuards,
  BadRequestException, HttpCode, HttpStatus,
} from '@nestjs/common';
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

function imageFailureMessage(error: ProductImageProcessingError): string {
  const cause = error.cause instanceof Error ? error.cause.message : String(error.cause ?? '');
  if (/length mismatch/i.test(cause)) {
    return 'فایل ذخیره‌شده ناقص بود و کنار گذاشته شد. دوباره آپلود کنید.';
  }
  if (/EOI|truncated/i.test(cause)) {
    return 'فایل JPEG ناقص است و ذخیره نشد. عکس را دوباره بفرستید.';
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
  constructor(private readonly storage: StorageService) {}

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
}
