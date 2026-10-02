import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicketEntity } from './entities/support-ticket.entity';
import { SupportTicketMessageEntity } from './entities/support-ticket-message.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { RedisService } from '../redis/redis.module';
import { shopperCanReadOrderType, shopperOrderScope } from '../auth/shopper-channel';
import {
  canTransitionSupportStatus,
  isSupportStatus,
  normalizeCategory,
  normalizePriority,
  statusAfterCustomerReply,
  statusAfterStaffReply,
  type SupportTicketStatus,
} from './support-ticket.fsm';

const MAX_SUBJECT = 200;
const MAX_BODY = 4000;
const CREATE_RL_MAX = 8;
const CREATE_RL_WINDOW_SEC = 3600;
const REPLY_RL_MAX = 30;
const REPLY_RL_WINDOW_SEC = 3600;

export type SupportChannel = 'RETAIL' | 'WHOLESALE';

@Injectable()
export class SupportTicketService {
  constructor(
    @InjectRepository(SupportTicketEntity)
    private readonly tickets: Repository<SupportTicketEntity>,
    @InjectRepository(SupportTicketMessageEntity)
    private readonly messages: Repository<SupportTicketMessageEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    private readonly redis: RedisService,
  ) {}

  channelFromPurpose(purpose?: string | null): SupportChannel | null {
    const scope = shopperOrderScope(purpose);
    return scope?.channel ?? null;
  }

  private async assertCreateRateLimit(customerId: string) {
    const key = `support:create:rl:${customerId}`;
    if (!this.redis.isReady) return;
    const count = await this.redis.incrWithTtl(key, CREATE_RL_WINDOW_SEC);
    if (count !== null && count > CREATE_RL_MAX) {
      throw new HttpException('تعداد تیکت‌های جدید زیاد است؛ کمی بعد دوباره تلاش کنید', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async assertReplyRateLimit(customerId: string) {
    const key = `support:reply:rl:${customerId}`;
    if (!this.redis.isReady) return;
    const count = await this.redis.incrWithTtl(key, REPLY_RL_WINDOW_SEC);
    if (count !== null && count > REPLY_RL_MAX) {
      throw new HttpException('تعداد پیام‌ها زیاد است؛ کمی بعد دوباره تلاش کنید', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private newPublicNumber(): string {
    const d = new Date();
    const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    const suffix = randomBytes(2).toString('hex').toUpperCase();
    return `SUP-${ymd}-${suffix}`;
  }

  private sanitizeBody(raw: string): string {
    const body = String(raw || '').trim();
    if (body.length < 3) throw new BadRequestException('متن پیام کوتاه است');
    if (body.length > MAX_BODY) throw new BadRequestException(`متن پیام حداکثر ${MAX_BODY} کاراکتر است`);
    return body;
  }

  private sanitizeSubject(raw: string): string {
    const subject = String(raw || '').trim().replace(/\s+/g, ' ');
    if (subject.length < 3) throw new BadRequestException('موضوع کوتاه است');
    if (subject.length > MAX_SUBJECT) throw new BadRequestException(`موضوع حداکثر ${MAX_SUBJECT} کاراکتر است`);
    return subject;
  }

  private async assertOrderLink(
    customerId: string,
    channel: SupportChannel,
    orderId?: string | null,
  ): Promise<string | null> {
    if (!orderId) return null;
    const id = String(orderId).trim();
    if (!id) return null;
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('سفارش یافت نشد');
    if (order.customerId !== customerId) {
      throw new ForbiddenException('این سفارش متعلق به شما نیست');
    }
    if (!shopperCanReadOrderType(channel === 'RETAIL' ? 'retail' : 'wholesale', order.type)) {
      throw new ForbiddenException('سفارش متعلق به این کانال نیست');
    }
    return order.id;
  }

  async createForCustomer(input: {
    customerId: string;
    channel: SupportChannel;
    subject: string;
    body: string;
    category?: string;
    priority?: string;
    orderId?: string | null;
  }) {
    await this.assertCreateRateLimit(input.customerId);
    const subject = this.sanitizeSubject(input.subject);
    const body = this.sanitizeBody(input.body);
    const orderId = await this.assertOrderLink(input.customerId, input.channel, input.orderId);
    const now = new Date();

    let publicNumber = this.newPublicNumber();
    for (let i = 0; i < 5; i++) {
      const clash = await this.tickets.exist({ where: { publicNumber } });
      if (!clash) break;
      publicNumber = this.newPublicNumber();
    }

    const ticket = this.tickets.create({
      publicNumber,
      customerId: input.customerId,
      channel: input.channel,
      subject,
      category: normalizeCategory(input.category),
      priority: normalizePriority(input.priority),
      status: 'OPEN',
      orderId,
      assigneeUserId: null,
      lastCustomerMessageAt: now,
      lastStaffMessageAt: null,
      closedAt: null,
    });
    const saved = await this.tickets.save(ticket);
    await this.messages.save(
      this.messages.create({
        ticketId: saved.id,
        authorType: 'CUSTOMER',
        authorUserId: null,
        body,
        isInternal: false,
      }),
    );
    return this.getForCustomer(saved.id, input.customerId, input.channel);
  }

  async listMine(customerId: string, channel: SupportChannel) {
    return this.tickets.find({
      where: { customerId, channel },
      order: { updatedAt: 'DESC' },
      take: 100,
    });
  }

  async getForCustomer(id: string, customerId: string, channel: SupportChannel) {
    const ticket = await this.tickets.findOne({ where: { id } });
    if (!ticket || ticket.customerId !== customerId || ticket.channel !== channel) {
      throw new NotFoundException('تیکت یافت نشد');
    }
    const messages = await this.messages.find({
      where: { ticketId: id, isInternal: false },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    return { ...ticket, messages };
  }

  async replyAsCustomer(input: {
    ticketId: string;
    customerId: string;
    channel: SupportChannel;
    body: string;
  }) {
    await this.assertReplyRateLimit(input.customerId);
    const body = this.sanitizeBody(input.body);
    const ticket = await this.tickets.findOne({ where: { id: input.ticketId } });
    if (!ticket || ticket.customerId !== input.customerId || ticket.channel !== input.channel) {
      throw new NotFoundException('تیکت یافت نشد');
    }
    if (ticket.status === 'CLOSED') {
      throw new BadRequestException('تیکت بسته است؛ تیکت جدید باز کنید');
    }
    const nextStatus = statusAfterCustomerReply(ticket.status);
    ticket.status = nextStatus;
    ticket.lastCustomerMessageAt = new Date();
    if (nextStatus !== 'CLOSED') ticket.closedAt = null;
    await this.tickets.save(ticket);
    await this.messages.save(
      this.messages.create({
        ticketId: ticket.id,
        authorType: 'CUSTOMER',
        authorUserId: null,
        body,
        isInternal: false,
      }),
    );
    return this.getForCustomer(ticket.id, input.customerId, input.channel);
  }

  async adminList(filters: {
    status?: string;
    channel?: string;
    category?: string;
    assigneeUserId?: string;
    q?: string;
  }) {
    const qb = this.tickets
      .createQueryBuilder('t')
      .orderBy('t.updatedAt', 'DESC')
      .take(150);
    if (filters.status) qb.andWhere('t.status = :status', { status: filters.status });
    if (filters.channel) qb.andWhere('t.channel = :channel', { channel: String(filters.channel).toUpperCase() });
    if (filters.category) qb.andWhere('t.category = :category', { category: String(filters.category).toUpperCase() });
    if (filters.assigneeUserId === 'unassigned') {
      qb.andWhere('t.assigneeUserId IS NULL');
    } else if (filters.assigneeUserId) {
      qb.andWhere('t.assigneeUserId = :assignee', { assignee: filters.assigneeUserId });
    }
    const q = String(filters.q || '').trim();
    if (q) {
      qb.andWhere('(t.publicNumber ILIKE :q OR t.subject ILIKE :q)', { q: `%${q}%` });
    }
    return qb.getMany();
  }

  async adminGet(id: string) {
    const ticket = await this.tickets.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');
    const messages = await this.messages.find({
      where: { ticketId: id },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    return { ...ticket, messages };
  }

  async adminReply(input: {
    ticketId: string;
    staffUserId: string;
    body: string;
    isInternal?: boolean;
    status?: string;
    assigneeUserId?: string | null;
  }) {
    const body = this.sanitizeBody(input.body);
    const ticket = await this.tickets.findOne({ where: { id: input.ticketId } });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');

    const isInternal = Boolean(input.isInternal);
    if (!isInternal) {
      ticket.lastStaffMessageAt = new Date();
      if (!input.status) {
        ticket.status = statusAfterStaffReply(ticket.status);
      }
    }

    if (input.status) {
      this.applyStatus(ticket, input.status);
    }
    if (input.assigneeUserId !== undefined) {
      ticket.assigneeUserId = input.assigneeUserId || null;
    } else if (!ticket.assigneeUserId && !isInternal) {
      ticket.assigneeUserId = input.staffUserId;
    }

    await this.tickets.save(ticket);
    await this.messages.save(
      this.messages.create({
        ticketId: ticket.id,
        authorType: 'STAFF',
        authorUserId: input.staffUserId,
        body,
        isInternal,
      }),
    );
    return this.adminGet(ticket.id);
  }

  async adminPatch(input: {
    ticketId: string;
    status?: string;
    priority?: string;
    assigneeUserId?: string | null;
  }) {
    const ticket = await this.tickets.findOne({ where: { id: input.ticketId } });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');
    if (input.status) this.applyStatus(ticket, input.status);
    if (input.priority) ticket.priority = normalizePriority(input.priority);
    if (input.assigneeUserId !== undefined) {
      ticket.assigneeUserId = input.assigneeUserId || null;
    }
    await this.tickets.save(ticket);
    return this.adminGet(ticket.id);
  }

  private applyStatus(ticket: SupportTicketEntity, statusRaw: string) {
    const status = String(statusRaw || '').toUpperCase();
    if (!isSupportStatus(status)) throw new BadRequestException('وضعیت نامعتبر');
    if (!canTransitionSupportStatus(ticket.status, status)) {
      throw new BadRequestException(`انتقال از ${ticket.status} به ${status} مجاز نیست`);
    }
    ticket.status = status as SupportTicketStatus;
    if (status === 'CLOSED' || status === 'RESOLVED') {
      ticket.closedAt = new Date();
    } else {
      ticket.closedAt = null;
    }
  }
}
