import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CustomerService } from './customer.service';

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
  ) {
    return this.customerService.findAll(page, limit, search, segment);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات مشتری' })
  findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'ثبت مشتری جدید' })
  create(@Body() body: any) {
    return this.customerService.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش مشتری' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.customerService.update(id, body);
  }

  @Patch(':id/segment')
  @ApiOperation({ summary: 'تغییر سگمنت مشتری' })
  updateSegment(@Param('id') id: string, @Body('segment') segment: string) {
    return this.customerService.updateSegment(id, segment);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف مشتری' })
  remove(@Param('id') id: string) {
    return this.customerService.remove(id);
  }
}
