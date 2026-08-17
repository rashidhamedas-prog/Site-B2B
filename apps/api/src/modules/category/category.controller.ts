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
    return this.svc.findAll({ includeHidden: false });
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'لیست کامل دسته‌بندی‌ها (ادمین، شامل مخفی)' })
  findAllAdmin() {
    return this.svc.findAll({ includeHidden: true });
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'جزئیات دسته‌بندی با slug' })
  findBySlug(@Param('slug') slug: string, @Res({ passthrough: true }) res?: FastifyReply) {
    res?.header(
      'Cache-Control',
      'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
    );
    return this.svc.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ایجاد دسته‌بندی (ادمین)' })
  create(@Body() body: Record<string, unknown>) {
    return this.svc.create(body as { name: string });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ویرایش دسته‌بندی (ادمین)' })
  update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
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

