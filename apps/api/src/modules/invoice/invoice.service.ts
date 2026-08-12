import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InvoiceEntity } from './entities/invoice.entity';
import { CustomerService } from '../customer/customer.service';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly repo: Repository<InvoiceEntity>,
    private readonly customerService: CustomerService,
    private readonly dataSource: DataSource,
  ) {}

  private async generateNumber(type: string): Promise<string> {
    const count = await this.repo.count({ where: { type } });
    const prefix = type === 'PROFORMA' ? 'PFI' : 'INV';
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  async create(data: Partial<InvoiceEntity>) {
    const invoiceNumber = await this.generateNumber(data.type ?? 'PROFORMA');
    const invoice = this.repo.create({ ...data, invoiceNumber, status: 'DRAFT' });
    return this.repo.save(invoice);
  }

  async findAll(
    page = 1,
    limit = 20,
    customerId?: string,
    channel?: string,
  ) {
    const qb = this.repo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.customer', 'customer')
      .orderBy('inv.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (customerId) {
      qb.andWhere('inv.customerId = :customerId', { customerId });
    }

    const ch = String(channel || '').toUpperCase();
    if (ch === 'RETAIL') {
      qb.andWhere(
        `(UPPER(COALESCE(customer.businessType, '')) = 'RETAIL' OR UPPER(COALESCE(customer.type, '')) = 'RETAIL')`,
      );
    } else if (ch === 'WHOLESALE') {
      qb.andWhere(
        `(UPPER(COALESCE(customer.businessType, '')) <> 'RETAIL' AND UPPER(COALESCE(customer.type, '')) <> 'RETAIL')`,
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const inv = await this.repo.findOne({ where: { id }, relations: ['customer'] });
    if (!inv) throw new NotFoundException('فاکتور یافت نشد');
    return inv;
  }

  async recordPayment(id: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('مبلغ پرداخت نامعتبر است');
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(InvoiceEntity);
      const inv = await repo
        .createQueryBuilder('inv')
        .setLock('pessimistic_write')
        .where('inv.id = :id', { id })
        .getOne();
      if (!inv) throw new NotFoundException('فاکتور یافت نشد');

      const paid = Number(inv.paidAmount) || 0;
      const total = Number(inv.total) || 0;
      if (paid + amount > total) {
        throw new BadRequestException('مبلغ پرداخت از مانده فاکتور بیشتر است');
      }

      inv.paidAmount = paid + amount;
      if (inv.paidAmount >= total) {
        inv.status = 'PAID';
        await this.customerService.updateBalance(inv.customerId, amount, manager);
      } else {
        inv.status = 'PARTIALLY_PAID';
      }
      return repo.save(inv);
    });
  }

  async send(id: string) {
    await this.repo.update(id, { status: 'SENT' });
    return this.findOne(id);
  }

  /**
   * Soft-delete a customer invoice.
   * Admin: any. Customer: own DRAFT / unpaid SENT only.
   */
  async remove(id: string, opts: { role: string; customerId?: string | null }) {
    const inv = await this.findOne(id);

    if (opts.role === 'CUSTOMER') {
      if (!opts.customerId || inv.customerId !== opts.customerId) {
        throw new ForbiddenException('اجازه حذف این فاکتور را ندارید');
      }
      const paid = Number(inv.paidAmount ?? 0);
      if (paid > 0 || ['PAID', 'PARTIALLY_PAID'].includes(inv.status)) {
        throw new BadRequestException('فاکتور پرداخت‌شده قابل حذف نیست');
      }
      if (!['DRAFT', 'SENT'].includes(inv.status)) {
        throw new BadRequestException('فقط پیش‌نویس یا ارسال‌شدهٔ بدون پرداخت قابل حذف است');
      }
    } else if (opts.role !== 'ADMIN') {
      throw new ForbiddenException('اجازه حذف فاکتور را ندارید');
    }

    await this.repo.softDelete(id);
    return { message: 'فاکتور با موفقیت حذف شد' };
  }
}
