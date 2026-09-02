import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OptionalJwtAuthGuard, isAdminActor } from '../product/optional-jwt.guard';
import { resolvePublicProductChannel } from '../product/public-product-channel';
import { CollectionService } from './collection.service';

function mapPublicCollectionChannelError(err: unknown): never {
  if (err instanceof Error && err.message === 'PUBLIC_CHANNEL_REQUIRED') {
    throw new BadRequestException('کانال نامعتبر است');
  }
  throw err;
}

type AuthedReq = { user?: { role?: string } };

@ApiTags('collections')
@Controller({ path: 'collections', version: '1' })
export class CollectionController {
  constructor(private readonly svc: CollectionService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'لیست کالکشن‌ها' })
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  findAll(
    @Query('active') active?: string,
    @Query('channel') channel?: string,
    @Req() req?: AuthedReq,
  ) {
    try {
      const publicChannel = resolvePublicProductChannel(channel, isAdminActor(req?.user));
      return this.svc.findAll(active === '1' || active === 'true', publicChannel);
    } catch (err) {
      mapPublicCollectionChannelError(err);
    }
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  findBySlug(@Param('slug') slug: string, @Query('channel') channel?: string, @Req() req?: AuthedReq) {
    try {
      const publicChannel = resolvePublicProductChannel(channel, isAdminActor(req?.user));
      return this.svc.findBySlug(slug, publicChannel);
    } catch (err) {
      mapPublicCollectionChannelError(err);
    }
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  findOne(@Param('id') id: string, @Query('channel') channel?: string, @Req() req?: AuthedReq) {
    try {
      const publicChannel = resolvePublicProductChannel(channel, isAdminActor(req?.user));
      return this.svc.findOne(id, publicChannel);
    } catch (err) {
      mapPublicCollectionChannelError(err);
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  create(@Body() body: Partial<{ name: string; season: string; description: string; imageUrl: string; slug: string }>) {
    return this.svc.create(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
