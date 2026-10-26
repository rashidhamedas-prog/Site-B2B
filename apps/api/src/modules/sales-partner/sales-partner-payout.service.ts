import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  SalesCommissionLedgerEntryEntity,
  SalesPartnerPayoutEntity,
  SalesPartnerPayoutItemEntity,
  SalesPartnerProfileEntity,
} from './entities';
import { SalesPartnerService } from './sales-partner.service';
import { allocatePayoutIrr, boundedIdempotencyKey, payoutIdempotencyKey } from './sales-partner-ledger-policy';
import { SALES_PARTNER_EVENT } from './sales-partner-events';
import {
  ibanPayoutBlockedUntil,
  resolveIbanCooldownHours,
} from './sales-partner-iban-cooldown';

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

  async confirm(actorId: string, input: {
    salesPartnerId: string;
    expectedAmountIrr: number;
    bankReference: string;
    method?: string;
    note?: string;
    idempotencyKey: string;
  }) {
    const profile = await this.profiles.findOne({ where: { id: input.salesPartnerId } });
    if (!profile) throw new NotFoundException('همکار بازاریاب پیدا نشد');
    const expected = Math.floor(Number(input.expectedAmountIrr));
    if (!Number.isInteger(expected) || expected < 1) {
      throw new BadRequestException('مبلغ مورد انتظار نامعتبر است');
    }
    const cooldownHours = resolveIbanCooldownHours(this.program.ibanCooldownHours());
    const blockedUntil = ibanPayoutBlockedUntil(profile.ibanChangedAt, cooldownHours);
    if (blockedUntil) {
      throw new ConflictException(
        `به‌خاطر تغییر شبا، تسویه تا ${blockedUntil.toISOString()} مسدود است`,
      );
    }
    const requestHash = boundedIdempotencyKey('preq', [
      input.salesPartnerId,
      input.idempotencyKey.trim(),
      input.bankReference.trim(),
      input.method || 'MANUAL_TRANSFER',
      String(expected),
    ].join('|'));
    const key = payoutIdempotencyKey(input.salesPartnerId, requestHash);
    const existing = await this.payouts.findOne({ where: { idempotencyKey: key } });
    if (existing) {
      if (existing.salesPartnerId !== input.salesPartnerId) {
        throw new ConflictException('کلید تسویه به همکار دیگری تعلق دارد');
      }
      return this.toPublic(existing);
    }
    const ref = String(input.bankReference || '').trim();
    if (ref.length < 4 || ref.length > 80) throw new BadRequestException('شماره مرجع واریز نامعتبر است');
    const settings = await this.program.settings();

    const saved = await this.dataSource.transaction(async (manager) => {
      const payoutRepo = manager.getRepository(SalesPartnerPayoutEntity);
      const itemRepo = manager.getRepository(SalesPartnerPayoutItemEntity);
      const entryRepo = manager.getRepository(SalesCommissionLedgerEntryEntity);
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `sales-partner-ledger:${input.salesPartnerId}`,
      ]);
      const again = await payoutRepo.findOne({ where: { idempotencyKey: key } });
      if (again) return again;
      await manager.query(
        `UPDATE sales_commission_ledger_entries AS rev
         SET bucket = 'available'
         FROM sales_commission_ledger_entries AS earned
         WHERE rev."salesPartnerId" = $1
           AND rev."entryType" = 'COMMISSION_REVERSAL'
           AND rev.bucket = 'held'
           AND rev."payoutId" IS NULL
           AND earned."salesPartnerId" = rev."salesPartnerId"
           AND earned."orderId" = rev."orderId"
           AND earned."orderItemId" = rev."orderItemId"
           AND earned."entryType" = 'COMMISSION_EARNED'
           AND earned."availableAt" IS NOT NULL
           AND earned."availableAt" <= $2`,
        [input.salesPartnerId, new Date()],
      );
      const open = await entryRepo.find({
        where: { salesPartnerId: input.salesPartnerId, payoutId: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      const now = new Date();
      const allocation = allocatePayoutIrr(
        open.map((row) => ({
          id: row.id,
          amountIrr: Number(row.amountIrr),
          entryType: row.entryType as 'COMMISSION_EARNED' | 'COMMISSION_REVERSAL' | 'MANUAL_ADJUSTMENT' | 'PAYOUT' | 'PAYOUT_REVERSAL',
          availableAt: row.availableAt,
          payoutId: row.payoutId,
          bucket: row.bucket === 'held' ? 'held' : 'available',
          orderItemId: row.orderItemId,
        })),
        now,
      );
      if (allocation.amountIrr !== expected) {
        throw new ConflictException('مانده تغییر کرده؛ دوباره بارگذاری کنید');
      }
      if (allocation.amountIrr < settings.minPayoutIrr || allocation.amountIrr <= 0) {
        throw new BadRequestException('مبلغ قابل‌برداشت به حداقل تسویه نرسیده است');
      }
      const payout = await payoutRepo.save(payoutRepo.create({
        salesPartnerId: input.salesPartnerId,
        status: 'RECORDED',
        amountIrr: String(allocation.amountIrr),
        bankReference: ref,
        method: (input.method || 'MANUAL_TRANSFER').slice(0, 40),
        paidAt: now,
        createdBy: actorId,
        note: input.note?.slice(0, 240) ?? null,
        idempotencyKey: key,
      }));
      const selected = new Set(allocation.entryIds);
      for (const row of open) {
        if (!selected.has(row.id)) continue;
        row.payoutId = payout.id;
        await entryRepo.save(row);
        await itemRepo.save(itemRepo.create({
          payoutId: payout.id,
          ledgerEntryId: row.id,
          amountIrr: row.amountIrr,
        }));
      }
      await entryRepo.save(entryRepo.create({
        salesPartnerId: input.salesPartnerId,
        orderId: null,
        orderItemId: null,
        amountIrr: String(-allocation.amountIrr),
        entryType: 'PAYOUT',
        availableAt: now,
        idempotencyKey: boundedIdempotencyKey('payout-ledger', key),
        reasonCode: 'MANUAL_PAYOUT_RECORDED',
        createdBy: actorId,
        payoutId: payout.id,
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

  async reverse(actorId: string, payoutId: string, reason: string) {
    const note = String(reason || '').trim();
    if (note.length < 8) throw new BadRequestException('دلیل برگشت حداقل ۸ حرف است');

    const saved = await this.dataSource.transaction(async (manager) => {
      const payoutRepo = manager.getRepository(SalesPartnerPayoutEntity);
      const entryRepo = manager.getRepository(SalesCommissionLedgerEntryEntity);
      const payout = await payoutRepo.findOne({
        where: { id: payoutId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payout) throw new NotFoundException('تسویه پیدا نشد');
      if (payout.status === 'REVERSED') return payout;

      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `sales-partner-ledger:${payout.salesPartnerId}`,
      ]);

      const again = await payoutRepo.findOne({
        where: { id: payoutId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!again) throw new NotFoundException('تسویه پیدا نشد');
      if (again.status === 'REVERSED') return again;
      if (again.status !== 'RECORDED') {
        throw new ConflictException('فقط تسویه ثبت‌شده قابل برگشت است');
      }

      const amount = Math.abs(Number(again.amountIrr));
      const reverseKey = boundedIdempotencyKey('payout-rev', again.id);
      const existingRev = await entryRepo.findOne({ where: { idempotencyKey: reverseKey } });
      if (!existingRev) {
        await entryRepo.save(entryRepo.create({
          salesPartnerId: again.salesPartnerId,
          orderId: null,
          orderItemId: null,
          amountIrr: String(amount),
          entryType: 'PAYOUT_REVERSAL',
          availableAt: new Date(),
          idempotencyKey: reverseKey,
          reasonCode: note.slice(0, 64),
          createdBy: actorId,
          payoutId: null,
        }));
      }

      await entryRepo
        .createQueryBuilder()
        .update(SalesCommissionLedgerEntryEntity)
        .set({ payoutId: null })
        .where('"payoutId" = :payoutId', { payoutId: again.id })
        .andWhere(`"entryType" NOT IN ('PAYOUT', 'PAYOUT_REVERSAL')`)
        .execute();

      again.status = 'REVERSED';
      again.note = [again.note, `REVERSE:${note}`].filter(Boolean).join(' | ').slice(0, 240);
      return payoutRepo.save(again);
    });

    await this.program.recordAudit(actorId, 'payout.reversed', 'payout', saved.id, {
      salesPartnerId: saved.salesPartnerId,
      amountIrr: Number(saved.amountIrr),
      reason: note,
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
