import {
  Controller, Post, Req, UseGuards,
  BadRequestException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StorageService } from './storage.service';
import { ProductImageProcessingError } from './image-processor';
import { MAX_UPLOAD_IMAGE_BYTES, uploadImageKind, uploadImageRejection } from './upload-image-policy';

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

    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of data.file) {
        size += chunk.length;
        if (size > MAX_UPLOAD_IMAGE_BYTES) {
          throw new BadRequestException('حجم عکس بیشتر از ۲۰ مگابایت است.');
        }
        chunks.push(chunk);
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (fileTooLarge(error)) throw new BadRequestException('حجم عکس بیشتر از ۲۰ مگابایت است.');
      throw error;
    }

    try {
      return await this.storage.uploadBuffer(
        Buffer.concat(chunks),
        data.mimetype,
        uploadImageKind(data.filename, data.mimetype),
      );
    } catch (error) {
      if (error instanceof ProductImageProcessingError) {
        throw new BadRequestException('این فایل به‌عنوان تصویر خوانده نشد. jpg، png یا webp سالم بفرستید.');
      }
      throw error;
    }
  }
}
