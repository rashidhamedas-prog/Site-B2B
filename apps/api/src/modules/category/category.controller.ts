import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CategoryService } from './category.service';

@ApiTags('categories')
@Controller({ path: 'categories', version: '1' })
export class CategoryController {
  constructor(private readonly svc: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'لیست دسته‌بندی‌ها' })
  findAll(@Res({ passthrough: true }) res?: FastifyReply) {
    res?.header(
      'Cache-Control',
      'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
    );
    return this.svc.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ایجاد دسته‌بندی (ادمین)' })
  create(@Body() body: { name: string; skuPrefix?: string; bannerUrl?: string | null }) {
    return this.svc.create(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ویرایش دسته‌بندی (ادمین)' })
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; skuPrefix?: string; nextSequence?: number; bannerUrl?: string | null },
  ) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'حذف دسته‌بندی (ادمین)' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

