import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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
    return this.videos.getAdmin(id);
  }

  @Get(':id/video/public')
  getPublic(@Param('id') id: string) {
    return this.videos.getPublic(id);
  }

  @Delete(':id/video')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.videos.remove(id);
  }

  @Post(':id/video/retry')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  retry(@Param('id') id: string) {
    return this.videos.retry(id);
  }

  @Patch(':id/video/poster')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  selectPoster(
    @Param('id') id: string,
    @Body() body: { key?: unknown; url?: unknown },
  ) {
    return this.videos.selectPoster(id, body);
  }
}
