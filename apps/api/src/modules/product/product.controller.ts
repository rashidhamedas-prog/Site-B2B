import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';

@ApiTags('products')
@Controller({ path: 'products', version: '1' })
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'کاتالوگ محصولات (عمومی)' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('fabric') fabric?: string,
    @Query('status') status?: string,
  ) {
    return this.productService.findAll(page, limit, search, fabric, status);
  }

  @Get('coming-soon')
  @ApiOperation({ summary: 'محصولات به‌زودی (پیش‌خرید)' })
  comingSoon(@Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number) {
    return this.productService.findComingSoon(limit);
  }

  @Get('meta/spec-memory')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'حافظه مقادیر توضیحات محصول' })
  specMemory(@Query('fieldKey') fieldKey?: string) {
    return this.productService.listSpecMemory(fieldKey);
  }

  @Get('meta/colors')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'تاریخچه رنگ‌های ثبت‌شده' })
  listColors() {
    return this.productService.listColors();
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'جزئیات محصول با slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات محصول' })
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'ایجاد محصول جدید (ادمین)' })
  create(@Body() body: CreateProductDto) {
    return this.productService.create(body);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'ویرایش محصول (ادمین)' })
  update(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.productService.update(id, body);
  }

  @Patch(':id/stock')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'تنظیم موجودی محصول (جدا از رنگ‌ها — مضرب حداقل سفارش)' })
  setStock(@Param('id') id: string, @Body() body: { stock: number }) {
    return this.productService.setProductStock(id, body.stock);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'حذف محصول (ادمین)' })
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }

  // ── Variant endpoints ─────────────────────────────────────
  @Post(':id/variants')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'افزودن واریانت (رنگ/سایز) به محصول' })
  createVariant(@Param('id') id: string, @Body() body: CreateVariantDto) {
    return this.productService.createVariant(id, body);
  }

  @Patch(':id/variants/:variantId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'ویرایش واریانت' })
  updateVariant(@Param('id') _id: string, @Param('variantId') variantId: string, @Body() body: any) {
    return this.productService.updateVariant(variantId, body);
  }

  @Delete(':id/variants/:variantId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'حذف واریانت' })
  removeVariant(@Param('id') _id: string, @Param('variantId') variantId: string) {
    return this.productService.removeVariant(variantId);
  }
}
