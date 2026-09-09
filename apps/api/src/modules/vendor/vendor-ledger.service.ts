import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { VendorLedgerEntryEntity } from './entities/vendor-ledger-entry.entity';
import {
  canMarkLedgerPaid,
  ledgerAvailableAt,
  resolveLedgerStatus,
  vendorNetPayableIrr,
} from './vendor-ledger-policy';
import { VendorEntity } from './entities/vendor.entity';
import { FulfillmentOrderEntity } from '../order/entities/fulfillment-order.entity';

@Injectable()
export class VendorLedgerService {
  constructor(
    @InjectRepository(VendorLedgerEntryEntity)
    private readonly repo: Repository<VendorLedgerEntryEntity>,
  ) {}

  /** Idempotent accrual after partner marks parcel DELIVERED. */
  async accrueOnDeliver(
    row: FulfillmentOrderEntity,
    vendor: VendorEntity,
    deliveredAt: Date,
  ): Promise<VendorLedgerEntryEntity | null> {
    if (!row.vendorId) return null;
    const amount = vendorNetPayableIrr(row.goodsTotal, row.commissionTotal);
    if (amount <= 0) return null;
    const availableAt = ledgerAvailableAt(deliveredAt, vendor.settlementHoldDays);
    try {
      const saved = await this.repo.save(
        this.repo.create({
          vendorId: row.vendorId,
          fulfillmentOrderId: row.id,
          orderId: row.orderId,
          entryType: 'COMMISSION_ACCRUAL',
          amountIrr: amount,
          availableAt,
          status: 'HELD',
        }),
      );
      return saved;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === '23505') {
        return this.repo.findOne({
          where: { fulfillmentOrderId: row.id, entryType: 'COMMISSION_ACCRUAL' },
        });
      }
      throw err;
    }
  }

  async releaseHeld(now = new Date(), limit = 50): Promise<number> {
    const rows = await this.repo.find({
      where: { status: 'HELD', availableAt: LessThanOrEqual(now) },
      take: Math.max(1, Math.min(limit, 100)),
    });
    for (const row of rows) {
      row.status = 'AVAILABLE';
      await this.repo.save(row);
    }
    return rows.length;
  }

  async summaryForVendor(vendorId: string) {
    const rows = await this.repo.find({
      where: { vendorId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    const now = new Date();
    let held = 0;
    let available = 0;
    let paid = 0;
    const data = rows.map((r) => {
      const status = resolveLedgerStatus(r.status, r.availableAt, now);
      const amount = Math.floor(Number(r.amountIrr) || 0);
      if (status === 'HELD') held += amount;
      else if (status === 'AVAILABLE') available += amount;
      else paid += amount;
      return {
        id: r.id,
        entryType: r.entryType,
        amountIrr: amount,
        availableAt: r.availableAt,
        status,
        orderId: r.orderId,
        fulfillmentOrderId: r.fulfillmentOrderId,
        createdAt: r.createdAt,
      };
    });
    return {
      heldIrr: held,
      availableIrr: available,
      paidIrr: paid,
      data,
    };
  }

  /**
   * Admin payout: flip payable COMMISSION_ACCRUAL rows to PAID.
   * Optional entryIds; empty/omit = all currently AVAILABLE for that vendor.
   */
  async markPaidForVendor(vendorId: string, entryIds?: string[] | null) {
    if (!vendorId) throw new BadRequestException('vendorId لازم است');
    const now = new Date();
    let candidates: VendorLedgerEntryEntity[];
    if (Array.isArray(entryIds) && entryIds.length > 0) {
      const ids = [...new Set(entryIds.map((id) => String(id || '').trim()).filter(Boolean))];
      candidates = await this.repo.find({
        where: { vendorId, id: In(ids) },
      });
      if (candidates.length !== ids.length) {
        throw new NotFoundException('برخی ردیف‌های دفتر پیدا نشد');
      }
    } else {
      candidates = await this.repo.find({
        where: { vendorId, entryType: 'COMMISSION_ACCRUAL' },
        take: 200,
      });
    }

    let paidCount = 0;
    let paidIrr = 0;
    for (const row of candidates) {
      if (!canMarkLedgerPaid(row.status, row.availableAt, now)) continue;
      row.status = 'PAID';
      await this.repo.save(row);
      paidCount += 1;
      paidIrr += Math.floor(Number(row.amountIrr) || 0);
    }

    return {
      paidCount,
      paidIrr,
      summary: await this.summaryForVendor(vendorId),
    };
  }
}
