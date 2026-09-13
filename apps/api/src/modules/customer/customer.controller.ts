import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
  ParseIntPipe, DefaultValuePipe, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CustomerService } from './customer.service';
import { UpsertCustomerDto } from './dto/upsert-customer.dto';
import { AdminWalletAdjustDto } from './dto/wallet.dto';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller({ path: 'customers', version: '1' })
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @ApiOperation({ summary: 'لیست مشتریان' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('segment') segment?: string,
    @Query('status') status?: string,
    @Query('businessType') businessType?: string,
    @Query('channel') channel?: string,
    @Query('type') type?: string,
  ) {
    return this.customerService.findAll(page, limit, search, segment, {
      status,
      businessType,
      channel,
      type,
    });
  }

  @Get(':id/wallet')
  @ApiOperation({ summary: 'دفتر کیف پول مشتری' })
  listWallet(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.customerService.listWallet(id, page, limit);
  }

  @Post(':id/wallet')
  @ApiOperation({ summary: 'افزایش یا کاهش اعتبار کیف پول' })
  applyWallet(
    @Param('id') id: string,
    @Body() body: AdminWalletAdjustDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.customerService.applyAdminWallet(id, body, req.user?.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات مشتری' })
  findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'ثبت مشتری جدید' })
  create(@Body() body: UpsertCustomerDto) {
    return this.customerService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش مشتری' })
  update(@Param('id') id: string, @Body() body: UpsertCustomerDto) {
    return this.customerService.update(id, body);
  }

  @Patch(':id/segment')
  @ApiOperation({ summary: 'تغییر سگمنت مشتری' })
  updateSegment(@Param('id') id: string, @Body('segment') segment: string) {
    return this.customerService.updateSegment(id, segment);
  }

  @Delete(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'حذف مشتری' })
  remove(@Param('id') id: string) {
    return this.customerService.remove(id);
  }
}
