import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ParseIntPipe, DefaultValuePipe, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock')
  @ApiOperation({ summary: 'گزارش موجودی انبار — موجودی سطح محصول' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'filter', required: false, enum: ['ALL', 'LOW', 'ZERO'] })
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  getStock(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('filter') filter?: string,
    @Query('channel') channel?: string,
  ) {
    return this.inventoryService.getStock(page, limit, search, filter, channel);
  }

  @Get('summary')
  @ApiOperation({ summary: 'خلاصه وضعیت انبار' })
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  getSummary(@Query('channel') channel?: string) {
    return this.inventoryService.getSummary(channel);
  }

  @Get('movements')
  @ApiOperation({ summary: 'تاریخچه تمام تحرکات انبار' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  getAllMovements(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('channel') channel?: string,
  ) {
    return this.inventoryService.getAllMovements(page, limit, channel);
  }

  @Delete('movements/:id')
  @ApiOperation({ summary: 'برگشت حرکت انبار با ردیف REVERSAL (تاریخچه حذف نمی‌شود)' })
  deleteMovement(@Param('id') id: string) {
    return this.inventoryService.reverseMovement(id);
  }

  @Get('movements/:variantId')
  @ApiOperation({ summary: 'تاریخچه موجودی یک واریانت' })
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  getMovements(
    @Param('variantId') variantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('channel') channel?: string,
  ) {
    return this.inventoryService.getMovements(variantId, page, 30, channel);
  }

  @Post('set')
  @ApiOperation({ summary: 'تنظیم موجودی محصول (productId یا productVariantId)' })
  setStock(
    @Body() body: {
      productId?: string;
      productVariantId?: string;
      stock: number;
      notes?: string;
      createdBy?: string;
      channel?: string;
      warehouseId?: string;
    },
  ) {
    if (body.productId) {
      return this.inventoryService.setProductStock(
        body.productId,
        body.stock,
        body.notes,
        body.createdBy,
        body.channel,
        body.warehouseId,
      );
    }
    if (body.productVariantId) {
      return this.inventoryService.setStock(
        body.productVariantId,
        body.stock,
        body.notes,
        body.createdBy,
        body.channel,
        body.warehouseId,
      );
    }
    throw new BadRequestException('productId یا productVariantId الزامی است');
  }

  @Post('product/set')
  @ApiOperation({ summary: 'تنظیم موجودی سطح محصول (بدون وابستگی به رنگ)' })
  setProductStock(
    @Body() body: {
      productId: string;
      stock: number;
      notes?: string;
      createdBy?: string;
      channel?: string;
      warehouseId?: string;
    },
  ) {
    if (!body.productId) throw new BadRequestException('productId الزامی است');
    return this.inventoryService.setProductStock(
      body.productId,
      body.stock,
      body.notes,
      body.createdBy,
      body.channel,
      body.warehouseId,
    );
  }

  @Post('adjust')
  @ApiOperation({ summary: 'تعدیل موجودی (روی موجودی کانال اعمال می‌شود)' })
  adjust(
    @Body() body: {
      productVariantId: string;
      quantity: number;
      type: 'IN' | 'OUT' | 'ADJUST' | 'RETURN' | 'DAMAGE';
      notes?: string;
      createdBy?: string;
      channel?: string;
      warehouseId?: string;
    },
  ) {
    return this.inventoryService.adjust(
      body.productVariantId,
      body.quantity,
      body.type,
      body.notes,
      body.createdBy,
      undefined,
      body.channel,
      body.warehouseId,
    );
  }

  // ── Warehouses ─────────────────────────────────────────────

  @Get('warehouses')
  @ApiOperation({ summary: 'لیست انبارها (با ایجاد پیش‌فرض در صورت نیاز)' })
  @ApiQuery({ name: 'channel', required: false, enum: ['WHOLESALE', 'RETAIL'] })
  listWarehouses(@Query('channel') channel?: string) {
    return this.inventoryService.listWarehouses(channel);
  }

  @Post('warehouses')
  @ApiOperation({ summary: 'ایجاد انبار' })
  createWarehouse(
    @Body() body: {
      name: string;
      code?: string;
      channel?: string;
      address?: string;
      notes?: string;
      isActive?: boolean;
      isDefault?: boolean;
    },
  ) {
    return this.inventoryService.createWarehouse(body);
  }

  @Put('warehouses/:id')
  @ApiOperation({ summary: 'ویرایش انبار' })
  updateWarehouse(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.inventoryService.updateWarehouse(id, body as any);
  }

  @Delete('warehouses/:id')
  @ApiOperation({ summary: 'حذف انبار' })
  deleteWarehouse(@Param('id') id: string) {
    return this.inventoryService.deleteWarehouse(id);
  }
}
