import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  SalesCommissionLedgerEntryEntity,
  SalesPartnerPayoutEntity,
  SalesPartnerPayoutItemEntity,
  SalesPartnerProfileEntity,
} from './entities';
import { SalesPartnerService } from './sales-partner.service';
import { SalesPartnerLedgerService } from './sales-partner-ledger.service';
import { payoutIdempotencyKey } from './sales-partner-ledger-policy';
import { payoutCarryAllowed } from './sales-partner-referral-policy';
import { SALES_PARTNER_EVENT } from './sales-partner-events';

@Injectable()
export class SalesPartnerPayoutService {
  constructor(
    @InjectRepository(SalesPartnerPayoutEntity)
    private readonly payouts: Repository<SalesPartnerPayoutEntity>,
    @InjectRepository(SalesPartnerPayoutItemEntity)
    private readonly items: Repository<SalesPartnerPayoutItemEntity>,
    @InjectRepository(SalesCommissionLedgerEntryEntity)
    private readonly entries: Repository<SalesCommissionLedgerEntryEntity>,
    @InjectRepository(SalesPartnerProfileEntity)
    private readonly profiles: Repository<SalesPartnerProfileEntity>,
    private readonly program: SalesPartnerService,
    private readonly ledger: SalesPartnerLedgerService,
    private readonly dataSource: DataSource,
  ) {}

  async listMine(salesPartnerId: string) {
    const rows = await this.payouts.find({ where: { salesPartnerId }, order: { createdAt: 'DESC' }, take: 50 });
    return rows.map((row) => this.toPublic(row));
  }

  async listAdmin(salesPartnerId?: string) {
    const rows = await this.payouts.find({
      where: salesPartnerId ? { salesPartnerId } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.map((row) => this.toPublic(row));
  }

  async preview(salesPartnerId: string) {
    const profile = await this.profiles.findOne({ where: { id: salesPartnerId } });
    if (!profile) throw new NotFoundException('همکار بازاریاب پیدا نشد');
    const balances = await this.ledger.balances(salesPartnerId, 1, 1);
    return {
      salesPartnerId,
      displayName: profile.displayName,
      ibanMasked: profile.ibanLast4 ? `IR****${profile.ibanLast4}` : null,
      available: balances.available,
      held: balances.held,
      paid: balances.paid,
      reversed: balances.reversed,
    };
  }

  async confirm(actorId: string, input: {
    salesPartnerId: string;
    bankReference: string;
    method?: string;
    note?: string;
    idempotencyKey: string;
  }) {
    const profile = await this.profiles.findOne({ where: { id: input.salesPartnerId } });
    if (!profile) throw new NotFoundException('همکار بازاریاب پیدا نشد');
    const key = payoutIdempotencyKey(input.idempotencyKey.trim().slice(0, 60));
    const existing = await this.payouts.findOne({ where: { idempotencyKey: key } });
    if (existing) return this.toPublic(existing);
    const ref = String(input.bankReference || '').trim();
    if (ref.length < 4 || ref.length > 80) throw new BadRequestException('شماره مرجع واریز نامعتبر است');
    const settings = await this.program.settings();
    const balances = await this.ledger.balances(input.salesPartnerId);
    const carry = payoutCarryAllowed(balances.available);
    if (carry.ok === false || balances.available < settings.minPayoutIrr) {
      throw new BadRequestException(carry.ok === false ? carry.message : 'مبلغ قابل‌برداشت به حداقل تسویه نرسیده است');
    }
    const duplicateRef = await this.payouts.findOne({ where: { bankReference: ref } });
    if (duplicateRef && duplicateRef.idempotencyKey !== key) {
      throw new ConflictException('این مرجع بانکی قبلاً ثبت شده است');
    }

    const now = new Date();
    const saved = await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`sp-payout:${input.salesPartnerId}`]);
      const payoutRepo = manager.getRepository(SalesPartnerPayoutEntity);
      const itemRepo = manager.getRepository(SalesPartnerPayoutItemEntity);
      const entryRepo = manager.getRepository(SalesCommissionLedgerEntryEntity);
      const again = await payoutRepo.findOne({ where: { idempotencyKey: key } });
      if (again) return again;
      const racedRef = await payoutRepo.findOne({ where: { bankReference: ref } });
      if (racedRef) throw new ConflictException('این مرجع بانکی قبلاً ثبت شده است');
      const freshRows = (await manager.query(
        `SELECT COALESCE(SUM(CASE
           WHEN "entryType" IN ('COMMISSION_EARNED','MANUAL_ADJUSTMENT','PAYOUT_REVERSAL')
            AND "availableAt" IS NOT NULL AND "availableAt" <= NOW() THEN "amountIrr"::bigint
           WHEN "entryType" IN ('COMMISSION_REVERSAL','PAYOUT') THEN "amountIrr"::bigint
           ELSE 0 END), 0)::text AS available
         FROM sales_commission_ledger_entries
         WHERE "salesPartnerId" = $1`,
        [input.salesPartnerId],
      )) as Array<{ available: string }>;
      const available = Number(freshRows[0]?.available || 0);
      const freshCarry = payoutCarryAllowed(available);
      if (freshCarry.ok === false || available < settings.minPayoutIrr) {
        throw new ConflictException(freshCarry.ok === false ? freshCarry.message : 'مانده دفتر تغییر کرده است. صفحه را تازه کنید');
      }
      const payable = await entryRepo
        .createQueryBuilder('e')
        .where('e.salesPartnerId = :id', { id: input.salesPartnerId })
        .andWhere(`e.entryType = 'COMMISSION_EARNED'`)
        .andWhere('e.availableAt IS NOT NULL AND e.availableAt <= :now', { now })
        .andWhere('e.settledIrr < e.amountIrr')
        .orderBy('e.createdAt', 'ASC')
        .setLock('pessimistic_write')
        .getMany();
      let remaining = available;
      const allocations: Array<{ row: SalesCommissionLedgerEntryEntity; take: number }> = [];
      for (const row of payable) {
        const open = Number(row.amountIrr) - Number(row.settledIrr || 0);
        if (open <= 0) continue;
        const take = Math.min(open, remaining);
        if (take <= 0) break;
        allocations.push({ row, take });
        remaining -= take;
      }
      const paidNow = available - remaining;
      const payAmount = paidNow > 0 ? paidNow : available;
      if (payAmount < settings.minPayoutIrr) {
        throw new ConflictException('مانده قابل تخصیص به پورسانت‌های آزاد نیست');
      }
      const payout = await payoutRepo.save(payoutRepo.create({
        salesPartnerId: input.salesPartnerId,
        status: 'PAID',
        amountIrr: String(payAmount),
        bankReference: ref,
        method: (input.method || 'TRANSFER').slice(0, 40),
        paidAt: now,
        createdBy: actorId,
        note: input.note?.slice(0, 240) ?? null,
        idempotencyKey: key,
      }));
      for (const { row, take } of allocations) {
        const nextSettled = Number(row.settledIrr || 0) + take;
        row.settledIrr = String(nextSettled);
        if (nextSettled >= Number(row.amountIrr)) row.payoutId = payout.id;
        await entryRepo.save(row);
        await itemRepo.save(itemRepo.create({
          payoutId: payout.id,
          ledgerEntryId: row.id,
          amountIrr: String(take),
        }));
      }
      await entryRepo.save(entryRepo.create({
        salesPartnerId: input.salesPartnerId,
        orderId: null,
        orderItemId: null,
        amountIrr: String(-payAmount),
        entryType: 'PAYOUT',
        availableAt: now,
        idempotencyKey: `${key}:ledger`,
        reasonCode: 'PAYOUT',
        createdBy: actorId,
        payoutId: payout.id,
        settledIrr: '0',
      }));
      return payout;
    });
    await this.program.emitEvent(SALES_PARTNER_EVENT.PAYOUT_RECORDED, saved.id, {
      payoutId: saved.id,
      profileId: input.salesPartnerId,
      status: saved.status,
    });
    return this.toPublic(saved);
  }

  private toPublic(row: SalesPartnerPayoutEntity) {
    return {
      id: row.id,
      salesPartnerId: row.salesPartnerId,
      status: row.status,
      amountIrr: Number(row.amountIrr),
      bankReferenceMasked: row.bankReference ? `****${row.bankReference.slice(-4)}` : null,
      method: row.method,
      paidAt: row.paidAt,
      note: row.note,
      createdAt: row.createdAt,
    };
  }
}
