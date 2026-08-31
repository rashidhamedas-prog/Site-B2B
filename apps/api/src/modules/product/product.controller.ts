import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe, Res, BadRequestException, Inject, forwardRef, Req } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductService } from './product.service';
import { InventoryService } from '../inventory/inventory.service';
import { contentDispositionUtf8 } from '../../common/xlsx-builder';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { resolvePublicProductStatus } from './public-product-status';
import { parseColorStockPlan, pickVariantStocks } from './color-stock-plan';
import { OptionalJwtAuthGuard, isAdminActor } from './optional-jwt.guard';

type AuthedReq = { user?: { id?: string; role?: string } };

@ApiTags('products')
@Controller({ path: 'products', version: '1' })
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'کاتالوگ محصولات (عمومی)' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('q') q?: string,
    @Query('fabric') fabric?: string,
    @Query('color') color?: string,
    @Query('size') size?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('collectionId') collectionId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('collar') collar?: string,
    @Query('relatedTo') relatedTo?: string,
    @Query('channel') channel?: string,
    @Query('sort') sort?: string,
    @Query('includeVariants') includeVariants?: string,
    @Res({ passthrough: true }) res?: FastifyReply,
  ) {
    let publicStatus: 'ACTIVE';
    try {
      publicStatus = resolvePublicProductStatus(status);
    } catch {
      throw new BadRequestException('وضعیت نامعتبر است');
    }
    res?.header(
      'Cache-Control',
      'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
    );
    const wantVariants = includeVariants === '1' || includeVariants === 'true';
    return this.productService.findAll(page, limit, search || q, fabric, publicStatus, color, size, {
      categoryId,
      categorySlug,
      collectionId,
      minPrice: minPrice != null ? Number(minPrice) : undefined,
      maxPrice: maxPrice != null ? Number(maxPrice) : undefined,
      collar,
      relatedTo,
      channel,
      sort,
      includeVariants: wantVariants,
    });
  }

  @Post('content-preview')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'پیش‌نمایش متن تخصصی تک/عمده بدون ذخیره' })
  previewContent(
    @Body()
    body: {
      channel: 'RETAIL' | 'WHOLESALE';
      productId?: string;
      name?: string;
      description?: string | null;
      fabric?: string | null;
      specs?: Record<string, unknown> | null;
      sizeType?: string | null;
      colors?: string[];
      minOrderQty?: number;
      careInstructions?: Record<string, unknown> | null;
      categoryName?: string | null;
    },
  ) {
    return this.productService.previewGeneratedContent(body);
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

  @Get('admin')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'کاتالوگ محصولات (ادمین، شامل ALL)' })
  async findAllAdmin(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('q') q?: string,
    @Query('fabric') fabric?: string,
    @Query('color') color?: string,
    @Query('size') size?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('collectionId') collectionId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('collar') collar?: string,
    @Query('relatedTo') relatedTo?: string,
    @Query('channel') channel?: string,
    @Query('sort') sort?: string,
    @Query('includeVariants') includeVariants?: string,
    @Res({ passthrough: true }) res?: FastifyReply,
  ) {
    res?.header('Cache-Control', 'private, no-store');
    const wantVariants =
      includeVariants === '1' ||
      includeVariants === 'true' ||
      String(status || '').toUpperCase() === 'ALL';
    return this.productService.findAll(page, limit, search || q, fabric, status, color, size, {
      categoryId,
      categorySlug,
      collectionId,
      minPrice: minPrice != null ? Number(minPrice) : undefined,
      maxPrice: maxPrice != null ? Number(maxPrice) : undefined,
      collar,
      relatedTo,
      channel,
      sort,
      includeVariants: wantVariants,
    });
  }

  @Get('admin/export.xlsx')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'خروجی اکسل محصولات عمده/تکی (ادمین)' })
  async exportExcel(@Query('channel') channel: string | undefined, @Res() res: FastifyReply) {
    const { buffer, filename } = await this.productService.exportExcel(channel);
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', contentDispositionUtf8(filename));
    res.header('Cache-Control', 'private, no-store');
    return res.send(buffer);
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'جزئیات محصول با slug' })
  findBySlug(@Param('slug') slug: string, @Query('channel') channel?: string, @Req() req?: AuthedReq) {
    return this.productService.findBySlug(slug, channel, { allowNonActive: isAdminActor(req?.user) });
  }

  @Post(':id/view')
  @ApiOperation({ summary: 'افزایش شمارنده بازدید محصول (عمومی)' })
  incrementView(@Param('id') id: string) {
    return this.productService.incrementView(id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'جزئیات محصول' })
  findOne(@Param('id') id: string, @Query('channel') channel?: string, @Req() req?: AuthedReq) {
    return this.productService.findOne(id, channel, { allowNonActive: isAdminActor(req?.user) });
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
  @ApiOperation({ summary: 'تنظیم موجودی محصول از مسیر انبار (با حرکت)' })
  setStock(@Param('id') id: string, @Body() body: { stock: number; channel?: string }) {
    return this.inventoryService.setProductStock(
      id,
      body.stock,
      'تنظیم موجودی از محصول',
      'admin',
      body.channel || 'WHOLESALE',
    );
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
  async createVariant(@Param('id') id: string, @Body() body: CreateVariantDto, @Req() req: AuthedReq) {
    const created = await this.productService.createVariant(id, body);
    const stocks = pickVariantStocks(body);
    const explicit = String(body.size || '').trim();
    const plan = new Map<string, { wholesale?: number; retail?: number }>();
    if (explicit && created[0]) {
      plan.set(String(created[0].size || explicit), stocks);
    } else {
      created.forEach((row, i) => {
        plan.set(String(row.size || ''), {
          wholesale: stocks.wholesale === undefined ? undefined : i === 0 ? stocks.wholesale : 0,
          retail: stocks.retail === undefined ? undefined : i === 0 ? stocks.retail : 0,
        });
      });
    }
    await this.inventoryService.applyPlanToVariants(created, plan, 'ایجاد رنگ', req.user?.id);
    return Promise.all(created.map((row) => this.productService.getVariant(row.id)));
  }

  @Put(':id/variants/color-stock')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'تنظیم موجودی یک رنگ به‌ازای هر سایز (یا یک‌بار روی سایز اول — legacy)' })
  async setColorStock(
    @Param('id') id: string,
    @Req() req: AuthedReq,
    @Body()
    body: {
      color: string;
      colorHex?: string;
      barcode?: string;
      imageUrl?: string | null;
      wholesaleStock?: number;
      retailStock?: number;
      stock?: number;
      sizes?: Array<{
        size: string;
        wholesaleStock?: number;
        retailStock?: number;
        stock?: number;
      }>;
    },
  ) {
    const product = await this.productService.findOne(id, undefined, { allowNonActive: true });
    const plan = parseColorStockPlan(body, this.productService.sizesForProduct(product.sizeType));
    const updated = await this.productService.setColorStock(id, body);
    await this.inventoryService.applyPlanToVariants(updated, plan, 'تنظیم موجودی رنگ', req.user?.id);
    return Promise.all(updated.map((row) => this.productService.getVariant(row.id)));
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
  async updateVariant(
    @Param('id') _id: string,
    @Param('variantId') variantId: string,
    @Body() body: { wholesaleStock?: number; retailStock?: number; stock?: number },
    @Req() req: AuthedReq,
  ) {
    await this.productService.updateVariant(variantId, body);
    const stocks = pickVariantStocks(body);
    await this.inventoryService.applyVariantStocks(variantId, stocks, 'ویرایش واریانت', req.user?.id);
    return this.productService.getVariant(variantId);
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
