import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InstallmentService } from './installment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

type JwtUser = { sub: string; id: string; role: string; phone: string; customerId?: string };

@ApiTags('installments')
@Controller('installments')
@ApiBearerAuth()
export class InstallmentController {
  constructor(private readonly svc: InstallmentService) {}

  private isStaff(role: string) {
    return role === 'ADMIN' || role === 'STAFF' || role === 'SUPER_ADMIN';
  }

  private actorId(user: JwtUser) {
    return user.id || user.sub;
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  mine(@Request() req: { user: JwtUser }) {
    const customerId = req.user.customerId;
    if (!customerId) {
      throw new ForbiddenException('حساب مشتری به این کاربر متصل نیست');
    }
    return this.svc.listForCustomer(customerId);
  }

  @Get('aging')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  aging() {
    return this.svc.agingReport();
  }

  @Get('statement/:customerId')
  @UseGuards(JwtAuthGuard)
  statement(
    @Param('customerId') customerId: string,
    @Request() req: { user: JwtUser },
  ) {
    if (!this.isStaff(req.user.role) && req.user.customerId !== customerId) {
      throw new ForbiddenException('دسترسی به صورت‌حساب این مشتری مجاز نیست');
    }
    return this.svc.statement(customerId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOne(@Param('id') id: string, @Request() req: { user: JwtUser }) {
    if (this.isStaff(req.user.role)) {
      return this.svc.getContract(id);
    }
    const customerId = req.user.customerId;
    if (!customerId) {
      throw new ForbiddenException('حساب مشتری به این کاربر متصل نیست');
    }
    return this.svc.getContract(id, customerId);
  }

  @Post('schedules/:id/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  recordPayment(
    @Param('id') scheduleId: string,
    @Body()
    body: {
      amount?: number;
      reason?: string;
      idempotencyKey?: string;
    },
    @Request() req: { user: JwtUser },
  ) {
    if (body?.amount == null) {
      throw new BadRequestException('amount الزامی است');
    }
    return this.svc.recordSchedulePayment(
      scheduleId,
      body.amount,
      this.actorId(req.user),
      body.reason,
      body.idempotencyKey,
    );
  }

  @Post('contracts/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: { user: JwtUser },
  ) {
    if (!body?.reason?.trim()) {
      throw new BadRequestException('reason الزامی است');
    }
    return this.svc.cancelContract(id, this.actorId(req.user), body.reason);
  }
}
