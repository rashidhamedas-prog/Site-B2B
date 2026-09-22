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
import { SalesPartnerLedgerService } from './sales-partner-ledger.service';
import { payoutIdempotencyKey } from './sales-partner-ledger-policy';

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
    if (balances.available < settings.minPayoutIrr) {
      throw new BadRequestException('مبلغ قابل‌برداشت به حداقل تسویه نرسیده است');
    }
    if (balances.available <= 0) throw new BadRequestException('مانده قابل‌برداشت وجود ندارد');

    const now = new Date();
    const payable = (await this.entries.find({
      where: { salesPartnerId: input.salesPartnerId, entryType: 'COMMISSION_EARNED', payoutId: IsNull() },
    })).filter((row) => row.availableAt && row.availableAt.getTime() <= now.getTime());
    const amount = payable.reduce((sum, row) => sum + Number(row.amountIrr), 0);
    if (amount !== balances.available) {
      throw new ConflictException('مانده دفتر تغییر کرده است. صفحه را تازه کنید');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const payoutRepo = manager.getRepository(SalesPartnerPayoutEntity);
      const itemRepo = manager.getRepository(SalesPartnerPayoutItemEntity);
      const entryRepo = manager.getRepository(SalesCommissionLedgerEntryEntity);
      const again = await payoutRepo.findOne({ where: { idempotencyKey: key } });
      if (again) return again;
      const payout = await payoutRepo.save(payoutRepo.create({
        salesPartnerId: input.salesPartnerId,
        status: 'PAID',
        amountIrr: String(amount),
        bankReference: ref,
        method: (input.method || 'TRANSFER').slice(0, 40),
        paidAt: now,
        createdBy: actorId,
        note: input.note?.slice(0, 240) ?? null,
        idempotencyKey: key,
      }));
      for (const row of payable) {
        const locked = await entryRepo.findOne({ where: { id: row.id }, lock: { mode: 'pessimistic_write' } });
        if (!locked || locked.payoutId) throw new ConflictException('یکی از ردیف‌ها هم‌زمان تسویه شد');
        locked.payoutId = payout.id;
        await entryRepo.save(locked);
        await itemRepo.save(itemRepo.create({
          payoutId: payout.id,
          ledgerEntryId: locked.id,
          amountIrr: locked.amountIrr,
        }));
      }
      await entryRepo.save(entryRepo.create({
        salesPartnerId: input.salesPartnerId,
        orderId: null,
        orderItemId: null,
        amountIrr: String(-amount),
        entryType: 'PAYOUT',
        availableAt: now,
        idempotencyKey: `${key}:ledger`,
        reasonCode: 'PAYOUT',
        createdBy: actorId,
        payoutId: payout.id,
      }));
      return payout;
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
