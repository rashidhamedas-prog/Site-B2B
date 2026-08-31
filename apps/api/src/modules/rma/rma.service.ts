import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ReturnRequestEntity } from './entities/return-request.entity';
import { ReturnRequestAuditEntity } from './entities/return-request-audit.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { OrderItemEntity } from '../order/entities/order-item.entity';
import { ProductService } from '../product/product.service';
import { channelUnitStock } from '../product/channel-product-projection';
import { InventoryService } from '../inventory/inventory.service';
import { rmaStockChannel } from './rma-channel';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['COMPLETED'],
  REJECTED: [],
  COMPLETED: [],
};

@Injectable()
export class RmaService {
  constructor(
    @InjectRepository(ReturnRequestEntity)
    private readonly repo: Repository<ReturnRequestEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    private readonly dataSource: DataSource,
    private readonly productService: ProductService,
    private readonly inventoryService: InventoryService,
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

    const prior = await this.repo
      .createQueryBuilder('r')
      .where('r.orderItemId = :oid', { oid: dto.orderItemId })
      .andWhere("r.status IN ('APPROVED','COMPLETED')")
      .getOne();
    if (prior) {
      throw new BadRequestException('برای این قلم قبلاً مرجوعی تأیید/تکمیل شده است');
    }

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
    const where: { status?: string } = {};
    if (status) where.status = status;
    return this.repo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }

  /**
   * Transactional approval with row lock + CAS via processingMarker.
   * Append-only audit row is written in the same transaction (not adminNote).
   * EXCHANGE is not silently completed.
   */
  async updateStatus(
    id: string,
    status: string,
    adminNote?: string,
    actorUserId?: string,
    correlationId?: string
  ) {
    if (!['APPROVED', 'REJECTED', 'COMPLETED', 'PENDING'].includes(status)) {
      throw new BadRequestException('وضعیت نامعتبر');
    }

    return this.dataSource.transaction(async (manager) => {
      const row = await manager
        .getRepository(ReturnRequestEntity)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id })
        .getOne();
      if (!row) throw new NotFoundException('درخواست یافت نشد');

      const fromStatus = row.status;
      const allowed = ALLOWED_TRANSITIONS[row.status] || [];
      if (!allowed.includes(status) && status !== row.status) {
        throw new BadRequestException(`انتقال وضعیت از ${row.status} به ${status} مجاز نیست`);
      }
      if (status === row.status) {
        return row; // idempotent no-op — no second wallet/stock/audit
      }

      if (adminNote !== undefined) {
        row.adminNote = adminNote;
      }

      if (status === 'APPROVED') {
        if (row.processingMarker) {
          throw new BadRequestException('این درخواست قبلاً پردازش شده است');
        }
        if (row.requestType !== 'RETURN') {
          // Only RETURN may restore stock / credit wallet. EXCHANGE and unknown types fail closed.
          throw new BadRequestException(
            row.requestType === 'EXCHANGE'
              ? 'تعویض هنوز به‌صورت اتمیک پیاده نشده؛ وضعیت را APPROVED نکنید. از گردش کار جداگانه استفاده کنید.'
              : `تأیید مالی فقط برای RETURN مجاز است (requestType=${row.requestType})`,
          );
        }

        const item = await manager.getRepository(OrderItemEntity).findOne({
          where: { id: row.orderItemId },
        });
        if (!item) throw new NotFoundException('قلم سفارش یافت نشد');

        const marker = `RMA_APPROVE:${row.id}`;
        row.processingMarker = marker;
        row.processedAt = new Date();
        row.processedByUserId = actorUserId || null;
        row.status = 'APPROVED';

        let stockBefore: number | null = null;
        let stockAfter: number | null = null;
        let variantId: string | null = item.productVariantId || null;

        if (item.productVariantId) {
          const qty = Math.trunc(Number(item.quantity) || 0);
          const order = await manager.getRepository(OrderEntity).findOne({
            where: { id: row.orderId },
          });
          if (!order) throw new NotFoundException('سفارش یافت نشد');
          const channel = rmaStockChannel(order.type);
          const before = await this.productService.getVariant(item.productVariantId);
          stockBefore = channelUnitStock(before, channel);
          const updated = await this.productService.updateVariantStock(
            item.productVariantId,
            qty,
            channel,
            manager,
          );
          stockAfter = channelUnitStock(updated, channel);
          await this.inventoryService.recordMovement(
            {
              productVariantId: item.productVariantId,
              productId: updated.productId,
              type: 'RETURN',
              quantity: qty,
              balanceAfter: stockAfter,
              referenceId: row.id,
              referenceType: 'RMA',
              channel,
              notes: `مرجوعی تأییدشده ${row.id}`,
            },
            manager,
          );
        }

        let credit: number | null = null;
        if (row.refundType === 'WALLET') {
          const bonusPercent = 5;
          credit = Math.round(Number(item.totalPrice) * (1 + bonusPercent / 100));
          const cust = await manager.query(
            `UPDATE customers SET balance = balance + $1 WHERE id = $2 RETURNING id`,
            [credit, row.customerId]
          );
          if (!cust?.length) {
            throw new BadRequestException('اعتبار کیف پول ثبت نشد');
          }
          row.walletCreditAmount = credit;
          // adminNote is mutable operator text — NOT the audit record.
        }

        await manager.getRepository(ReturnRequestAuditEntity).insert({
          returnRequestId: row.id,
          actorUserId: actorUserId || null,
          fromStatus,
          toStatus: 'APPROVED',
          processingMarker: marker,
          requestType: row.requestType,
          refundType: row.refundType,
          walletCreditAmount: credit,
          variantId,
          stockBefore,
          stockAfter,
          correlationId: correlationId || null,
          meta: { qty: item.quantity, orderItemId: item.id },
        });

        const saved = await manager.getRepository(ReturnRequestEntity).save(row);
        return saved;
      }

      row.status = status;
      if (status === 'REJECTED' || status === 'COMPLETED') {
        row.processedAt = row.processedAt || new Date();
        row.processedByUserId = actorUserId || row.processedByUserId;
      }

      await manager.getRepository(ReturnRequestAuditEntity).insert({
        returnRequestId: row.id,
        actorUserId: actorUserId || null,
        fromStatus,
        toStatus: status,
        processingMarker: null,
        requestType: row.requestType,
        refundType: row.refundType,
        walletCreditAmount: null,
        variantId: null,
        stockBefore: null,
        stockAfter: null,
        correlationId: correlationId || null,
        meta: null,
      });

      return manager.getRepository(ReturnRequestEntity).save(row);
    });
  }
}
