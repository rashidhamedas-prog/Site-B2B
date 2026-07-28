import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WarehouseService } from './warehouse.service';

@ApiTags('warehouses')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller({ path: 'warehouses', version: '1' })
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  @ApiOperation({ summary: 'لیست انبارها' })
  findAll() {
    return this.warehouseService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات انبار' })
  findOne(@Param('id') id: string) {
    return this.warehouseService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'ایجاد انبار' })
  create(
    @Body()
    body: { code: string; name: string; address?: string; isActive?: boolean; isDefault?: boolean },
  ) {
    return this.warehouseService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش انبار' })
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{ code: string; name: string; address: string; isActive: boolean; isDefault: boolean }>,
  ) {
    return this.warehouseService.update(id, body ?? {});
  }
}
