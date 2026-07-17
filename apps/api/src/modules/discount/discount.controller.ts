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
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
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
    const patch: any = { ...body };
    if (body.startsAt !== undefined) patch.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (body.expiresAt !== undefined) patch.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    return this.svc.update(id, patch);
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

  // ── Tiered ─────────────────────────────────────────────────

  @Get('tiered/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  listTiered() {
    return this.svc.listTiered();
  }

  @Post('tiered')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  createTiered(@Body() body: any) {
    return this.svc.createTiered(body);
  }

  @Put('tiered/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  updateTiered(@Param('id') id: string, @Body() body: any) {
    if (body.expiresAt !== undefined) body.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    return this.svc.updateTiered(id, body);
  }

  @Delete('tiered/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  removeTiered(@Param('id') id: string) {
    return this.svc.removeTiered(id);
  }

  // ── Side ───────────────────────────────────────────────────

  @Get('side/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  listSide() {
    return this.svc.listSide();
  }

  @Post('side')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  createSide(@Body() body: any) {
    return this.svc.createSide(body);
  }

  @Put('side/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  updateSide(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateSide(id, body);
  }

  @Delete('side/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  removeSide(@Param('id') id: string) {
    return this.svc.removeSide(id);
  }
}
