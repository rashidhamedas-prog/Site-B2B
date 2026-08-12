import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  InstallmentContractEntity,
  InstallmentScheduleEntity,
} from './entities/installment-contract.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';

export type CreateInstallmentFromOrderInput = {
  orderId: string;
  customerId: string;
  principalIrr: number;
  downPaymentIrr: number;
  termCount: number;
  ruleId?: string | null;
  actorId?: string | null;
};

export type EqualScheduleRow = {
  installmentNo: number;
  dueAt: Date;
  amountIrr: number;
};

export type AgingBucket = {
  key: '0-30' | '31-60' | '61-90' | '90+';
  label: string;
  remainingIrr: number;
  scheduleCount: number;
};

/** Coerce DB bigint / string / number to a finite non-negative integer IRR. */
export function toIrrInt(value: unknown, field = 'amount'): number {
  if (typeof value === 'bigint') {
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException(`${field} خارج از محدوده مجاز است`);
    }
    return Number(value);
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new BadRequestException(`${field} باید عدد صحیح غیرمنفی ریال باشد`);
  }
  if (n > Number.MAX_SAFE_INTEGER) {
    throw new BadRequestException(`${field} خارج از محدوده مجاز است`);
  }
  return n;
}

export function assertPositiveIrr(value: unknown, field = 'amount'): number {
  const n = toIrrInt(value, field);
  if (n <= 0) throw new BadRequestException(`${field} باید مثبت باشد`);
  return n;
}

/**
 * Split remainder into equal monthly amounts; last row absorbs leftover IRR.
 * First due = startDate + 1 calendar month.
 */
export function buildEqualSchedules(
  remainder: number,
  months: number,
  startDate: Date,
): EqualScheduleRow[] {
  const rem = toIrrInt(remainder, 'remainder');
  const m = Number(months);
  if (!Number.isFinite(m) || !Number.isInteger(m) || m < 1) {
    throw new BadRequestException('تعداد اقساط نامعتبر است');
  }
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
    throw new BadRequestException('تاریخ شروع نامعتبر است');
  }
  if (rem === 0) return [];

  const base = Math.floor(rem / m);
  const rows: EqualScheduleRow[] = [];
  let allocated = 0;
  for (let i = 1; i <= m; i++) {
    const amountIrr = i === m ? rem - allocated : base;
    allocated += amountIrr;
    const dueAt = new Date(startDate.getTime());
    dueAt.setUTCMonth(dueAt.getUTCMonth() + i);
    rows.push({ installmentNo: i, dueAt, amountIrr });
  }
  return rows;
}

function daysPastDue(dueAt: Date, now: Date): number {
  const ms = now.getTime() - dueAt.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function bucketKey(days: number): AgingBucket['key'] {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

@Injectable()
export class InstallmentService {
  constructor(
    @InjectRepository(InstallmentContractEntity)
    private readonly contractRepo: Repository<InstallmentContractEntity>,
    @InjectRepository(InstallmentScheduleEntity)
    private readonly scheduleRepo: Repository<InstallmentScheduleEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /** Pure helper exposed for callers/tests. */
  buildEqualSchedules(remainder: number, months: number, startDate: Date) {
    return buildEqualSchedules(remainder, months, startDate);
  }

  async availableCredit(customerId: string, manager?: EntityManager): Promise<number> {
    const customerRepo = manager
      ? manager.getRepository(CustomerEntity)
      : this.customerRepo;
    const contractRepo = manager
      ? manager.getRepository(InstallmentContractEntity)
      : this.contractRepo;

    const customer = await customerRepo.findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');

    const limit = toIrrInt(customer.creditLimit, 'creditLimit');
    const raw = await contractRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.creditConsumedIrr), 0)', 'consumed')
      .where('c.customerId = :customerId', { customerId })
      .andWhere('c.status = :status', { status: 'ACTIVE' })
      .getRawOne<{ consumed: string | number }>();

    const consumed = toIrrInt(raw?.consumed ?? 0, 'creditConsumed');
    return Math.max(0, limit - consumed);
  }

  async createFromOrder(
    input: CreateInstallmentFromOrderInput,
    manager?: EntityManager,
  ): Promise<{ contract: InstallmentContractEntity; schedules: InstallmentScheduleEntity[] }> {
    const run = async (em: EntityManager) => {
      const contractRepo = em.getRepository(InstallmentContractEntity);
      const scheduleRepo = em.getRepository(InstallmentScheduleEntity);
      const customerRepo = em.getRepository(CustomerEntity);

      const existing = await contractRepo.findOne({ where: { orderId: input.orderId } });
      if (existing) {
        const schedules = await scheduleRepo.find({
          where: { contractId: existing.id },
          order: { installmentNo: 'ASC' },
        });
        return { contract: existing, schedules };
      }

      const principalIrr = toIrrInt(input.principalIrr, 'principalIrr');
      const downPaymentIrr = toIrrInt(input.downPaymentIrr, 'downPaymentIrr');
      const termCount = Number(input.termCount);
      if (!Number.isFinite(termCount) || !Number.isInteger(termCount) || termCount < 1) {
        throw new BadRequestException('تعداد اقساط نامعتبر است');
      }
      if (downPaymentIrr > principalIrr) {
        throw new BadRequestException('پیش‌پرداخت نمی‌تواند از اصل بیشتر باشد');
      }
      const remainder = principalIrr - downPaymentIrr;

      // Lock customer row for credit check.
      const customer = await customerRepo.findOne({
        where: { id: input.customerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!customer) throw new NotFoundException('مشتری یافت نشد');

      const available = await this.availableCredit(input.customerId, em);
      if (remainder > available) {
        throw new BadRequestException(
          `اعتبار کافی نیست (نیاز: ${remainder}، موجود: ${available})`,
        );
      }

      const now = new Date();
      const scheduleRows = buildEqualSchedules(remainder, termCount, now);
      const approvedBy = (input.actorId && String(input.actorId).trim()) || 'system:checkout';

      let contract: InstallmentContractEntity;
      try {
        contract = await contractRepo.save(
          contractRepo.create({
            customerId: input.customerId,
            orderId: input.orderId,
            providerCode: 'INTERNAL',
            principalIrr,
            downPaymentIrr,
            termCount,
            effectiveAmountIrr: remainder,
            creditConsumedIrr: remainder,
            approvedBy,
            approvedAt: now,
            ruleId: input.ruleId ? String(input.ruleId) : null,
            status: 'ACTIVE',
          }),
        );
      } catch (err: any) {
        // Concurrent create for same orderId — return winner.
        if (err?.code === '23505') {
          const raced = await contractRepo.findOne({ where: { orderId: input.orderId } });
          if (raced) {
            const schedules = await scheduleRepo.find({
              where: { contractId: raced.id },
              order: { installmentNo: 'ASC' },
            });
            return { contract: raced, schedules };
          }
        }
        throw err;
      }

      const schedules =
        scheduleRows.length === 0
          ? []
          : await scheduleRepo.save(
              scheduleRows.map((r) =>
                scheduleRepo.create({
                  contractId: contract.id,
                  installmentNo: r.installmentNo,
                  dueAt: r.dueAt,
                  amountIrr: r.amountIrr,
                  paidAmountIrr: 0,
                  status: 'PENDING',
                }),
              ),
            );

      // Zero-remainder (fully prepaid) → complete immediately and release credit.
      if (remainder === 0) {
        contract.status = 'COMPLETED';
        contract.creditConsumedIrr = 0;
        await contractRepo.save(contract);
      }

      return { contract, schedules };
    };

    if (manager) return run(manager);
    return this.dataSource.transaction((em) => run(em));
  }

  async listForCustomer(customerId: string) {
    const contracts = await this.contractRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    if (!contracts.length) return [];

    const ids = contracts.map((c) => c.id);
    const schedules = await this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.contractId IN (:...ids)', { ids })
      .orderBy('s.installmentNo', 'ASC')
      .getMany();

    const byContract = new Map<string, InstallmentScheduleEntity[]>();
    for (const s of schedules) {
      const list = byContract.get(s.contractId) ?? [];
      list.push(s);
      byContract.set(s.contractId, list);
    }

    return contracts.map((c) => ({
      ...c,
      principalIrr: toIrrInt(c.principalIrr, 'principalIrr'),
      downPaymentIrr: toIrrInt(c.downPaymentIrr, 'downPaymentIrr'),
      effectiveAmountIrr: toIrrInt(c.effectiveAmountIrr, 'effectiveAmountIrr'),
      creditConsumedIrr: toIrrInt(c.creditConsumedIrr, 'creditConsumedIrr'),
      schedules: (byContract.get(c.id) ?? []).map((s) => ({
        ...s,
        amountIrr: toIrrInt(s.amountIrr, 'amountIrr'),
        paidAmountIrr: toIrrInt(s.paidAmountIrr, 'paidAmountIrr'),
      })),
    }));
  }

  async getContract(id: string, customerId?: string) {
    const contract = await this.contractRepo.findOne({ where: { id } });
    if (!contract) throw new NotFoundException('قرارداد اقساط یافت نشد');
    if (customerId && contract.customerId !== customerId) {
      throw new ForbiddenException('دسترسی به این قرارداد مجاز نیست');
    }
    const schedules = await this.scheduleRepo.find({
      where: { contractId: id },
      order: { installmentNo: 'ASC' },
    });
    return {
      ...contract,
      principalIrr: toIrrInt(contract.principalIrr, 'principalIrr'),
      downPaymentIrr: toIrrInt(contract.downPaymentIrr, 'downPaymentIrr'),
      effectiveAmountIrr: toIrrInt(contract.effectiveAmountIrr, 'effectiveAmountIrr'),
      creditConsumedIrr: toIrrInt(contract.creditConsumedIrr, 'creditConsumedIrr'),
      schedules: schedules.map((s) => ({
        ...s,
        amountIrr: toIrrInt(s.amountIrr, 'amountIrr'),
        paidAmountIrr: toIrrInt(s.paidAmountIrr, 'paidAmountIrr'),
      })),
    };
  }

  async recordSchedulePayment(
    scheduleId: string,
    amount: number,
    actorId: string,
    reason?: string,
    idempotencyKey?: string,
  ) {
    return this.dataSource.transaction(async (em) => {
      const scheduleRepo = em.getRepository(InstallmentScheduleEntity);
      const contractRepo = em.getRepository(InstallmentContractEntity);

      const schedule = await scheduleRepo.findOne({
        where: { id: scheduleId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!schedule) throw new NotFoundException('قسط یافت نشد');

      if (idempotencyKey) {
        const token = `pay:${idempotencyKey}`;
        if (schedule.providerReference === token) {
          const contract = await contractRepo.findOne({ where: { id: schedule.contractId } });
          return { schedule, contract, idempotent: true };
        }
      }

      if (['PAID', 'CANCELLED'].includes(schedule.status)) {
        throw new ConflictException('این قسط قابل پرداخت نیست');
      }

      const incoming = assertPositiveIrr(amount, 'amount');
      const due = toIrrInt(schedule.amountIrr, 'amountIrr');
      const paid = toIrrInt(schedule.paidAmountIrr, 'paidAmountIrr');
      const remaining = due - paid;
      if (incoming > remaining) {
        throw new BadRequestException(`مبلغ بیش از مانده قسط است (مانده: ${remaining})`);
      }

      const nextPaid = paid + incoming;
      schedule.paidAmountIrr = nextPaid;
      schedule.status = nextPaid >= due ? 'PAID' : 'PARTIAL';
      if (idempotencyKey) {
        schedule.providerReference = `pay:${idempotencyKey}`;
      }
      if (reason) {
        // Keep reason on contract notes (schedules have no notes column).
        const contractLocked = await contractRepo.findOne({
          where: { id: schedule.contractId },
          lock: { mode: 'pessimistic_write' },
        });
        if (contractLocked) {
          const line = `[pay ${schedule.installmentNo} by ${actorId}] ${reason}`;
          contractLocked.notes = contractLocked.notes
            ? `${contractLocked.notes}\n${line}`
            : line;
          await contractRepo.save(contractLocked);
        }
      }
      await scheduleRepo.save(schedule);

      const contract = await contractRepo.findOne({
        where: { id: schedule.contractId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) throw new NotFoundException('قرارداد اقساط یافت نشد');

      const all = await scheduleRepo.find({ where: { contractId: contract.id } });
      const allPaid = all.length > 0 && all.every((s) => s.status === 'PAID');
      if (allPaid) {
        contract.status = 'COMPLETED';
        contract.creditConsumedIrr = 0;
        await contractRepo.save(contract);
      }

      return { schedule, contract, idempotent: false };
    });
  }

  async cancelContract(id: string, actorId: string, reason: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('دلیل لغو الزامی است');
    }
    return this.dataSource.transaction(async (em) => {
      const contractRepo = em.getRepository(InstallmentContractEntity);
      const scheduleRepo = em.getRepository(InstallmentScheduleEntity);

      const contract = await contractRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contract) throw new NotFoundException('قرارداد اقساط یافت نشد');
      if (contract.status === 'CANCELLED') {
        const schedules = await scheduleRepo.find({
          where: { contractId: id },
          order: { installmentNo: 'ASC' },
        });
        return { contract, schedules, idempotent: true };
      }
      if (contract.status === 'COMPLETED') {
        throw new ConflictException('قرارداد تکمیل‌شده قابل لغو نیست');
      }

      const schedules = await scheduleRepo.find({
        where: { contractId: id },
        lock: { mode: 'pessimistic_write' },
      });
      for (const s of schedules) {
        if (['PENDING', 'PARTIAL', 'OVERDUE'].includes(s.status)) {
          s.status = 'CANCELLED';
          await scheduleRepo.save(s);
        }
      }

      const line = `[cancel by ${actorId}] ${reason.trim()}`;
      contract.status = 'CANCELLED';
      contract.creditConsumedIrr = 0;
      contract.notes = contract.notes ? `${contract.notes}\n${line}` : line;
      await contractRepo.save(contract);

      return { contract, schedules, idempotent: false };
    });
  }

  async agingReport(now = new Date()): Promise<AgingBucket[]> {
    const overdue = await this.scheduleRepo.find({ where: { status: 'OVERDUE' } });
    const buckets: Record<AgingBucket['key'], AgingBucket> = {
      '0-30': { key: '0-30', label: '۰–۳۰ روز', remainingIrr: 0, scheduleCount: 0 },
      '31-60': { key: '31-60', label: '۳۱–۶۰ روز', remainingIrr: 0, scheduleCount: 0 },
      '61-90': { key: '61-90', label: '۶۱–۹۰ روز', remainingIrr: 0, scheduleCount: 0 },
      '90+': { key: '90+', label: 'بیش از ۹۰ روز', remainingIrr: 0, scheduleCount: 0 },
    };

    for (const s of overdue) {
      const amount = toIrrInt(s.amountIrr, 'amountIrr');
      const paid = toIrrInt(s.paidAmountIrr, 'paidAmountIrr');
      const remaining = Math.max(0, amount - paid);
      if (remaining <= 0) continue;
      const days = daysPastDue(new Date(s.dueAt), now);
      const key = bucketKey(days);
      buckets[key].remainingIrr += remaining;
      buckets[key].scheduleCount += 1;
    }

    return [buckets['0-30'], buckets['31-60'], buckets['61-90'], buckets['90+']];
  }

  async markOverdue(now = new Date()): Promise<number> {
    const result = await this.scheduleRepo
      .createQueryBuilder()
      .update(InstallmentScheduleEntity)
      .set({ status: 'OVERDUE' })
      .where('status = :pending', { pending: 'PENDING' })
      .andWhere('"dueAt" < :now', { now })
      .execute();
    return Number(result.affected ?? 0);
  }

  async statement(customerId: string) {
    const available = await this.availableCredit(customerId);
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    const contracts = await this.listForCustomer(customerId);

    let outstandingIrr = 0;
    let overdueIrr = 0;
    for (const c of contracts) {
      for (const s of c.schedules) {
        if (['CANCELLED', 'PAID'].includes(s.status)) continue;
        const rem = Math.max(0, Number(s.amountIrr) - Number(s.paidAmountIrr));
        outstandingIrr += rem;
        if (s.status === 'OVERDUE') overdueIrr += rem;
      }
    }

    return {
      customerId,
      creditLimitIrr: toIrrInt(customer.creditLimit, 'creditLimit'),
      availableCreditIrr: available,
      outstandingIrr,
      overdueIrr,
      contracts,
    };
  }
}
