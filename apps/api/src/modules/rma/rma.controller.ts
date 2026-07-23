import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RmaService } from './rma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserEntity } from '../auth/entities/user.entity';

type JwtUser = { sub: string; role: string; customerId?: string };

@ApiTags('rma')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'rma', version: '1' })
export class RmaController {
  constructor(
    private readonly rma: RmaService,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'ثبت درخواست مرجوعی/تعویض' })
  async create(@Request() req: Express.Request & { user: JwtUser }, @Body() body: any) {
    const customerId =
      req.user.role === 'ADMIN'
        ? body.customerId
        : req.user.customerId ?? (await this.userRepo.findOne({ where: { id: req.user.sub } }))?.customerId;
    if (!customerId) throw new ForbiddenException('حساب مشتری یافت نشد');
    return this.rma.create({ ...body, customerId });
  }

  @Get('mine')
  @ApiOperation({ summary: 'درخواست‌های مرجوعی من' })
  async mine(@Request() req: Express.Request & { user: JwtUser }) {
    const customerId =
      req.user.customerId ?? (await this.userRepo.findOne({ where: { id: req.user.sub } }))?.customerId;
    if (!customerId) return [];
    return this.rma.mine(customerId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'لیست RMA ادمین' })
  findAll(@Query('status') status?: string) {
    return this.rma.findAll(status);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'تغییر وضعیت RMA' })
  updateStatus(@Param('id') id: string, @Body() body: { status: string; adminNote?: string }) {
    return this.rma.updateStatus(id, body.status, body.adminNote);
  }
}
