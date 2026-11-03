import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { validate as isUuid } from 'uuid';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProductVideoService } from './product-video.service';

@Controller({ path: 'products', version: '1' })
export class ProductVideoController {
  constructor(private readonly videos: ProductVideoService) {}

  @Get(':id/video')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  getAdmin(@Param('id') id: string) {
    this.assertUuid(id);
    return this.videos.getAdmin(id);
  }

  @Get(':id/video/public')
  getPublic(@Param('id') id: string, @Query('channel') channel?: string) {
    if (!isUuid(id)) return null;
    const normalized = String(channel || '').toUpperCase();
    if (normalized && normalized !== 'RETAIL' && normalized !== 'WHOLESALE') return null;
    return this.videos.getPublic(
      id,
      normalized ? (normalized as 'RETAIL' | 'WHOLESALE') : undefined,
    );
  }

  @Delete(':id/video')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    this.assertUuid(id);
    return this.videos.remove(id);
  }

  @Post(':id/video/retry')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  retry(@Param('id') id: string) {
    this.assertUuid(id);
    return this.videos.retry(id);
  }

  @Patch(':id/video/poster')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  selectPoster(
    @Param('id') id: string,
    @Body() body: { key?: unknown; url?: unknown },
  ) {
    this.assertUuid(id);
    return this.videos.selectPoster(id, body);
  }

  private assertUuid(id: string): void {
    if (!isUuid(id)) throw new BadRequestException('شناسه محصول معتبر نیست.');
  }
}
