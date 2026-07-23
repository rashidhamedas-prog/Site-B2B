import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReturnRequestEntity } from './entities/return-request.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { OrderItemEntity } from '../order/entities/order-item.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';

@Injectable()
export class RmaService {
  constructor(
    @InjectRepository(ReturnRequestEntity)
    private readonly repo: Repository<ReturnRequestEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
  ) {}

  async create(dto: {
    customerId: string;
    orderItemId: string;
    reason: string;
    requestType?: string;
    requestedSize?: string;
    refundType?: string;
  }) {
    const item = await this.itemRepo.findOne({ where: { id: dto.orderItemId } });
    if (!item) throw new NotFoundException('قلم سفارش یافت نشد');

    const order = await this.orderRepo.findOne({ where: { id: item.orderId } });
    if (!order) throw new NotFoundException('سفارش یافت نشد');
    if (order.customerId !== dto.customerId) {
      throw new ForbiddenException('این سفارش متعلق به شما نیست');
    }
    if (!['DELIVERED', 'COMPLETED', 'SHIPPED'].includes(order.status)) {
      throw new BadRequestException('فقط پس از ارسال/تحویل می‌توان مرجوعی ثبت کرد');
    }

    const existing = await this.repo.findOne({
      where: { orderItemId: dto.orderItemId, status: 'PENDING' },
    });
    if (existing) throw new BadRequestException('درخواست باز برای این قلم وجود دارد');

    const row = this.repo.create({
      orderId: order.id,
      orderItemId: item.id,
      customerId: dto.customerId,
      reason: dto.reason,
      requestType: dto.requestType === 'EXCHANGE' ? 'EXCHANGE' : 'RETURN',
      requestedSize: dto.requestedSize,
      refundType: dto.refundType === 'BANK' ? 'BANK' : 'WALLET',
      status: 'PENDING',
    });
    return this.repo.save(row);
  }

  async mine(customerId: string) {
    return this.repo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(status?: string) {
    const where: any = {};
    if (status) where.status = status;
    return this.repo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }

  async updateStatus(id: string, status: string, adminNote?: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('درخواست یافت نشد');
    if (!['APPROVED', 'REJECTED', 'COMPLETED', 'PENDING'].includes(status)) {
      throw new BadRequestException('وضعیت نامعتبر');
    }

    row.status = status;
    if (adminNote !== undefined) row.adminNote = adminNote;

    // Credit wallet on APPROVED return (not exchange)
    if (status === 'APPROVED' && row.requestType === 'RETURN' && row.refundType === 'WALLET') {
      const item = await this.itemRepo.findOne({ where: { id: row.orderItemId } });
      if (item) {
        const bonusPercent = 5; // encourage wallet refund
        const credit = Math.round(Number(item.totalPrice) * (1 + bonusPercent / 100));
        await this.customerRepo.increment({ id: row.customerId }, 'balance', credit);
        row.adminNote = `${row.adminNote || ''}\nWALLET_CREDIT=${credit} (+${bonusPercent}%)`.trim();
      }
    }

    return this.repo.save(row);
  }
}
