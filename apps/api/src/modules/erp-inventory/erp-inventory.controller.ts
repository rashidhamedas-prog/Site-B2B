import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ErpInventoryApiKeyGuard } from './erp-inventory-api-key.guard';
import { ErpInventoryService } from './erp-inventory.service';
import { ErpMatrixBulkDto, ErpMatrixUpsertDto } from './dto/erp-matrix.dto';

@ApiTags('erp-inventory')
@ApiHeader({ name: 'x-api-key', description: 'ERP_INVENTORY_API_KEY' })
@UseGuards(ErpInventoryApiKeyGuard)
@Controller({ path: 'erp/inventory', version: '1' })
export class ErpInventoryController {
  constructor(private readonly erpInventory: ErpInventoryService) {}

  @Get('ping')
  @ApiOperation({ summary: 'آزمایش اتصال ERP → سایت' })
  ping() {
    return this.erpInventory.ping();
  }

  @Put('matrix')
  @ApiOperation({ summary: 'آپدیت موجودی ماتریس رنگ×سایز از ERP (یک محصول)' })
  upsertMatrix(@Body() body: ErpMatrixUpsertDto) {
    return this.erpInventory.upsertMatrix(body);
  }

  @Put('matrix/bulk')
  @ApiOperation({ summary: 'آپدیت دسته‌ای ماتریس موجودی از ERP' })
  upsertBulk(@Body() body: ErpMatrixBulkDto) {
    return this.erpInventory.upsertBulk(body.items ?? []);
  }
}
