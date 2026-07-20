import {
  Controller, Get, Post, Body, Param, Query,
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
  getStock(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('filter') filter?: string,
  ) {
    return this.inventoryService.getStock(page, limit, search, filter);
  }

  @Get('summary')
  @ApiOperation({ summary: 'خلاصه وضعیت انبار' })
  getSummary() {
    return this.inventoryService.getSummary();
  }

  @Get('movements')
  @ApiOperation({ summary: 'تاریخچه تمام تحرکات انبار' })
  @ApiQuery({ name: 'page', required: false })
  getAllMovements(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
  ) {
    return this.inventoryService.getAllMovements(page, limit);
  }

  @Get('movements/:variantId')
  @ApiOperation({ summary: 'تاریخچه موجودی یک واریانت' })
  getMovements(
    @Param('variantId') variantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return this.inventoryService.getMovements(variantId, page);
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
    },
  ) {
    if (body.productId) {
      return this.inventoryService.setProductStock(
        body.productId,
        body.stock,
        body.notes,
        body.createdBy,
      );
    }
    if (body.productVariantId) {
      return this.inventoryService.setStock(
        body.productVariantId,
        body.stock,
        body.notes,
        body.createdBy,
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
    },
  ) {
    if (!body.productId) throw new BadRequestException('productId الزامی است');
    return this.inventoryService.setProductStock(
      body.productId,
      body.stock,
      body.notes,
      body.createdBy,
    );
  }

  @Post('adjust')
  @ApiOperation({ summary: 'تعدیل موجودی (روی موجودی محصول اعمال می‌شود)' })
  adjust(
    @Body() body: {
      productVariantId: string;
      quantity: number;
      type: 'IN' | 'OUT' | 'ADJUST' | 'RETURN' | 'DAMAGE';
      notes?: string;
      createdBy?: string;
    },
  ) {
    return this.inventoryService.adjust(
      body.productVariantId,
      body.quantity,
      body.type,
      body.notes,
      body.createdBy,
    );
  }
}
