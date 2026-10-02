import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicketService, type SupportChannel } from './support-ticket.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserEntity } from '../auth/entities/user.entity';
import { isStaffRole } from '../auth/staff-access';

type JwtUser = { sub: string; role: string; customerId?: string; purpose?: string };

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'support/tickets', version: '1' })
export class SupportTicketController {
  constructor(
    private readonly support: SupportTicketService,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
  ) {}

  private async resolveCustomerId(user: JwtUser): Promise<string> {
    if (user.customerId) return user.customerId;
    const row = await this.userRepo.findOne({ where: { id: user.sub } });
    if (!row?.customerId) throw new ForbiddenException('حساب مشتری یافت نشد');
    return row.customerId;
  }

  private requireShopperChannel(user: JwtUser): SupportChannel {
    if (isStaffRole(user.role) && !user.purpose) {
      throw new ForbiddenException('از حساب مشتری وارد شوید');
    }
    const channel = this.support.channelFromPurpose(user.purpose);
    if (!channel) throw new ForbiddenException('کانال پشتیبانی نامعتبر است');
    return channel;
  }

  @Post()
  @ApiOperation({ summary: 'ثبت تیکت پشتیبانی (مشتری)' })
  async create(
    @Request() req: Express.Request & { user: JwtUser },
    @Body()
    body: {
      subject?: string;
      body?: string;
      category?: string;
      priority?: string;
      orderId?: string;
    },
  ) {
    const customerId = await this.resolveCustomerId(req.user);
    const channel = this.requireShopperChannel(req.user);
    return this.support.createForCustomer({
      customerId,
      channel,
      subject: body.subject || '',
      body: body.body || '',
      category: body.category,
      priority: body.priority,
      orderId: body.orderId,
    });
  }

  @Get('mine')
  @ApiOperation({ summary: 'تیکت‌های من' })
  async mine(@Request() req: Express.Request & { user: JwtUser }) {
    const customerId = await this.resolveCustomerId(req.user);
    const channel = this.requireShopperChannel(req.user);
    return this.support.listMine(customerId, channel);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'لیست تیکت‌ها (ادمین)' })
  adminList(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('category') category?: string,
    @Query('assigneeUserId') assigneeUserId?: string,
    @Query('q') q?: string,
  ) {
    return this.support.adminList({ status, channel, category, assigneeUserId, q });
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات تیکت' })
  async getOne(@Request() req: Express.Request & { user: JwtUser }, @Param('id') id: string) {
    if (isStaffRole(req.user.role) && !this.support.channelFromPurpose(req.user.purpose)) {
      return this.support.adminGet(id);
    }
    const customerId = await this.resolveCustomerId(req.user);
    const channel = this.requireShopperChannel(req.user);
    return this.support.getForCustomer(id, customerId, channel);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'پاسخ به تیکت' })
  async reply(
    @Request() req: Express.Request & { user: JwtUser },
    @Param('id') id: string,
    @Body()
    body: {
      body?: string;
      isInternal?: boolean;
      status?: string;
      assigneeUserId?: string | null;
    },
  ) {
    if (!body?.body) throw new BadRequestException('متن پیام الزامی است');
    if (isStaffRole(req.user.role) && !this.support.channelFromPurpose(req.user.purpose)) {
      return this.support.adminReply({
        ticketId: id,
        staffUserId: req.user.sub,
        body: body.body,
        isInternal: body.isInternal,
        status: body.status,
        assigneeUserId: body.assigneeUserId,
      });
    }
    const customerId = await this.resolveCustomerId(req.user);
    const channel = this.requireShopperChannel(req.user);
    if (body.isInternal) throw new ForbiddenException('دسترسی غیرمجاز');
    return this.support.replyAsCustomer({
      ticketId: id,
      customerId,
      channel,
      body: body.body,
    });
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'به‌روزرسانی وضعیت/اولویت/ارجاع' })
  adminPatch(
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      priority?: string;
      assigneeUserId?: string | null;
    },
  ) {
    return this.support.adminPatch({
      ticketId: id,
      status: body.status,
      priority: body.priority,
      assigneeUserId: body.assigneeUserId,
    });
  }
}
