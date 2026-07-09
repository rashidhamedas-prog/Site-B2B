import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceEntity } from './entities/invoice.entity';
import { CustomerService } from '../customer/customer.service';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly repo: Repository<InvoiceEntity>,
    private readonly customerService: CustomerService,
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

  async findAll(page = 1, limit = 20, customerId?: string) {
    const where: any = customerId ? { customerId } : {};
    const [data, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const inv = await this.repo.findOne({ where: { id }, relations: ['customer'] });
    if (!inv) throw new NotFoundException('فاکتور یافت نشد');
    return inv;
  }

  async recordPayment(id: string, amount: number) {
    const inv = await this.findOne(id);
    inv.paidAmount = Number(inv.paidAmount) + amount;
    if (inv.paidAmount >= inv.total) {
      inv.status = 'PAID';
      await this.customerService.updateBalance(inv.customerId, amount);
    } else {
      inv.status = 'PARTIALLY_PAID';
    }
    return this.repo.save(inv);
  }

  async send(id: string) {
    await this.repo.update(id, { status: 'SENT' });
    return this.findOne(id);
  }
}
