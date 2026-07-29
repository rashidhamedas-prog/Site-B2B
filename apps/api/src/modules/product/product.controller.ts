import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
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
    @Query('q') q?: string,
    @Query('fabric') fabric?: string,
    @Query('color') color?: string,
    @Query('size') size?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('collectionId') collectionId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('collar') collar?: string,
    @Query('relatedTo') relatedTo?: string,
    @Query('channel') channel?: string,
  ) {
    return this.productService.findAll(page, limit, search || q, fabric, status, color, size, {
      categoryId,
      collectionId,
      minPrice: minPrice != null ? Number(minPrice) : undefined,
      maxPrice: maxPrice != null ? Number(maxPrice) : undefined,
      collar,
      relatedTo,
      channel,
    });
  }

  @Get('coming-soon')
  @ApiOperation({ summary: 'محصولات به‌زودی (پیش‌خرید)' })
  comingSoon(
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('channel') channel?: string,
  ) {
    return this.productService.findComingSoon(limit, channel);
  }

  @Get('meta/spec-memory')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'حافظه مقادیر توضیحات محصول' })
  specMemory(@Query('fieldKey') fieldKey?: string) {
    return this.productService.listSpecMemory(fieldKey);
  }

  @Delete('meta/spec-memory')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'حذف یک مقدار از حافظه توضیحات محصول' })
  deleteSpecMemory(
    @Query('fieldKey') fieldKey?: string,
    @Query('value') value?: string,
    @Query('id') id?: string,
  ) {
    return this.productService.deleteSpecMemory({ fieldKey, value, id });
  }

  @Get('meta/colors')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'لیست رنگ‌های ذخیره‌شده برای انتخاب سریع' })
  listColors() {
    return this.productService.listColors();
  }

  @Post('meta/colors')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'افزودن رنگ به لیست ذخیره‌شده' })
  createColor(@Body() body: { name: string; hex?: string }) {
    return this.productService.createColor(body);
  }

  @Patch('meta/colors/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'ویرایش رنگ ذخیره‌شده' })
  updateColor(@Param('id') id: string, @Body() body: { name?: string; hex?: string }) {
    return this.productService.updateColor(id, body);
  }

  @Delete('meta/colors/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'حذف رنگ از لیست ذخیره‌شده' })
  deleteColor(@Param('id') id: string) {
    return this.productService.deleteColor(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'جزئیات محصول با slug' })
  findBySlug(@Param('slug') slug: string, @Query('channel') channel?: string) {
    return this.productService.findBySlug(slug, channel);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات محصول' })
  findOne(@Param('id') id: string, @Query('channel') channel?: string) {
    return this.productService.findOne(id, channel);
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
  @ApiOperation({ summary: 'افزودن رنگ (بدون سایز = همه سایزها با موجودی یک‌بار)' })
  createVariant(@Param('id') id: string, @Body() body: CreateVariantDto) {
    return this.productService.createVariant(id, body);
  }

  @Put(':id/variants/color-stock')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'تنظیم موجودی یک رنگ روی همه سایزهای محصول (بدون تکرار در جمع)' })
  setColorStock(
    @Param('id') id: string,
    @Body()
    body: {
      color: string;
      colorHex?: string;
      barcode?: string;
      imageUrl?: string | null;
      wholesaleStock?: number;
      retailStock?: number;
      stock?: number;
    },
  ) {
    return this.productService.setColorStock(id, body);
  }

  @Delete(':id/variants/by-color')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'حذف همه سایزهای یک رنگ' })
  removeColorVariants(@Param('id') id: string, @Query('color') color: string) {
    return this.productService.removeColorVariants(id, color);
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
