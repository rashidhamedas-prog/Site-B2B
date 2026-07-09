import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly svc: NotificationService) {}

  @Get('status')
  status() {
    return this.svc.status();
  }

  // Admin: manual/ad-hoc SMS (e.g. marketing blast to a single number).
  @Post('sms')
  async send(@Body() body: { receptor: string; message: string }) {
    const sent = await this.svc.sendSms(body.receptor, body.message);
    return { sent };
  }
}
