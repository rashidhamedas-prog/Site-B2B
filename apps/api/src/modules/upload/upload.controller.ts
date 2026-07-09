import {
  Controller, Post, Req, UseGuards,
  BadRequestException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StorageService } from './storage.service';

const ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const MAX_SIZE = 5 * 1024 * 1024;

function ext(filename: string) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
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

    const data = await req.file();
    if (!data) throw new BadRequestException('فایلی ارسال نشده');

    const extension = ext(data.filename);
    if (!ALLOWED.includes(extension)) {
      throw new BadRequestException('فرمت فایل مجاز نیست (jpg, png, webp)');
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of data.file) {
      size += chunk.length;
      if (size > MAX_SIZE) throw new BadRequestException('حجم فایل بیش از ۵ مگابایت است');
      chunks.push(chunk);
    }

    return this.storage.uploadBuffer(Buffer.concat(chunks), data.mimetype, extension);
  }
}
