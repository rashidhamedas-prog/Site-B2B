import { Body, Controller, Get, Param, Put, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrmApiKeyGuard } from './crm-api-key.guard';
import { InventoryService } from '../inventory/inventory.service';
import { ProductService } from '../product/product.service';

/**
 * CRM integration endpoints — authenticated with CRM_API_KEY.
 * Calling these APIs updates inventory immediately (real-time DB write).
 */
@ApiTags('crm')
@ApiHeader({ name: 'x-api-key', description: 'CRM_API_KEY' })
@UseGuards(CrmApiKeyGuard)
@Controller({ path: 'crm', version: '1' })
export class CrmController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly productService: ProductService,
  ) {}

  @Get('inventory')
  @ApiOperation({ summary: 'لیست لحظه‌ای موجودی همه محصولات برای CRM' })
  listInventory(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('filter') filter?: string,
  ) {
    return this.inventoryService.getStock(page, limit, search, filter);
  }

  @Get('inventory/:sku')
  @ApiOperation({ summary: 'موجودی لحظه‌ای یک محصول با SKU' })
  async getOne(@Param('sku') sku: string) {
    const product = await this.productService.findBySku(sku);
    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      stock: product.stock ?? product.totalStock ?? 0,
      minOrderQty: product.minOrderQty,
      status: product.status,
      syncedAt: new Date().toISOString(),
    };
  }

  @Put('inventory/:sku')
  @ApiOperation({ summary: 'به‌روزرسانی لحظه‌ای موجودی یک محصول (مضرب حداقل سفارش)' })
  setOne(
    @Param('sku') sku: string,
    @Body() body: { stock: number; notes?: string },
  ) {
    return this.inventoryService.setProductStockBySku(
      sku,
      body.stock,
      body.notes ?? 'CRM sync',
      'crm',
    );
  }

  @Put('inventory')
  @ApiOperation({ summary: 'به‌روزرسانی دسته‌ای و لحظه‌ای موجودی‌ها از CRM' })
  bulkSet(
    @Body() body: {
      items: Array<{ sku: string; stock: number }>;
      notes?: string;
    },
  ) {
    return this.inventoryService.bulkSetBySku(
      body.items ?? [],
      body.notes ?? 'CRM bulk sync',
      'crm',
    );
  }
}
