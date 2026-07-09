import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DiscountService } from './discount.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('discount-codes')
@Controller('discount-codes')
export class DiscountController {
  constructor(private readonly svc: DiscountService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  findAll() {
    return this.svc.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  create(@Body() body: any) {
    return this.svc.create({
      code: (body.code as string).toUpperCase(),
      type: body.type ?? 'PERCENT',
      value: Number(body.value),
      minOrder: Number(body.minOrder ?? 0),
      maxUses: body.maxUses ? Number(body.maxUses) : undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      isActive: body.isActive ?? true,
      notes: body.notes,
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post('validate')
  validate(@Body() body: { code: string; orderTotal: number }) {
    return this.svc.validate(body.code, body.orderTotal);
  }
}
