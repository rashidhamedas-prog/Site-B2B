import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CustomerEntity } from './entities/customer.entity';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly repo: Repository<CustomerEntity>,
  ) {}

  async findAll(page = 1, limit = 20, search?: string, segment?: string) {
    const where: any[] = search
      ? [
          { businessName: ILike(`%${search}%`) },
          { ownerName: ILike(`%${search}%`) },
          { phone: ILike(`%${search}%`) },
          { code: ILike(`%${search}%`) },
        ]
      : [{}];

    if (segment) where.forEach((w) => (w.segment = segment));

    const [data, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    return customer;
  }

  async findByPhone(phone: string) {
    return this.repo.findOne({ where: { phone } });
  }

  async create(data: Partial<CustomerEntity>) {
    const count = await this.repo.count();
    const code = `TRN-${String(count + 1).padStart(5, '0')}`;
    const customer = this.repo.create({ ...data, code, status: 'PENDING' });
    return this.repo.save(customer);
  }

  async update(id: string, data: Partial<CustomerEntity>) {
    await this.findOne(id);
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async updateSegment(id: string, segment: string) {
    await this.repo.update(id, { segment });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.softDelete(id);
    return { message: 'مشتری با موفقیت حذف شد' };
  }

  async updateBalance(id: string, delta: number) {
    const customer = await this.findOne(id);
    customer.balance = Number(customer.balance) + delta;
    return this.repo.save(customer);
  }
}
