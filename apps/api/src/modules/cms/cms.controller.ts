import {
  BadRequestException,
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CmsService } from './cms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

function mapPublicCmsChannelError(err: unknown): never {
  if (err instanceof Error && err.message === 'PUBLIC_CHANNEL_REQUIRED') {
    throw new BadRequestException('کانال نامعتبر است');
  }
  throw err;
}

@ApiTags('cms')
@Controller('cms')
export class CmsController {
  constructor(private readonly svc: CmsService) {}

  // ── Public ────────────────────────────────────────────────

  @Get('pages/:slug')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  findBySlug(@Param('slug') slug: string, @Query('channel') channel?: string) {
    return this.svc.findBySlug(slug, channel).catch(mapPublicCmsChannelError);
  }

  @Get('kind/:kind')
  @ApiQuery({ name: 'channel', required: true, enum: ['WHOLESALE', 'RETAIL'] })
  findByKind(@Param('kind') kind: string, @Query('channel') channel?: string) {
    return this.svc.findByKind(kind, channel).catch(mapPublicCmsChannelError);
  }

  @Get('site-content/:channel/:pageKey')
  getPublicSiteContent(
    @Param('channel') channel: string,
    @Param('pageKey') pageKey: string,
  ) {
    return this.svc.getPublicSiteContent(channel, pageKey).catch(mapPublicCmsChannelError);
  }

  // ── Admin ─────────────────────────────────────────────────

  @Get('admin/pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  findAllAdmin(@Query('channel') channel?: string) {
    return this.svc.findAllAdmin(channel);
  }

  @Post('admin/pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Put('admin/pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete('admin/pages/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Get('admin/site-content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  listSiteContent(@Query('channel') channel?: string) {
    return this.svc.listSiteContent(channel);
  }

  @Get('admin/site-content/:channel/:pageKey')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  getSiteContent(
    @Param('channel') channel: string,
    @Param('pageKey') pageKey: string,
  ) {
    return this.svc.getSiteContent(channel, pageKey);
  }

  @Post('admin/site-content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  upsertSiteContent(@Body() body: any) {
    return this.svc.upsertSiteContent(body);
  }

  @Put('admin/site-content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  upsertSiteContentPut(@Body() body: any) {
    return this.svc.upsertSiteContent(body);
  }

  @Delete('admin/site-content/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  deleteSiteContent(@Param('id') id: string) {
    return this.svc.deleteSiteContent(id);
  }
}
