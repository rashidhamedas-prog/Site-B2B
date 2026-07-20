import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CustomerEntity } from './entities/customer.entity';
import { AuthService } from '../auth/auth.service';

/** True when the DB rejected an insert because the customer `code` already exists. */
function isDuplicateCodeError(err: unknown): boolean {
  const e = (err ?? {}) as {
    code?: string;
    detail?: string;
    driverError?: { code?: string; detail?: string };
  };
  const code = e.code ?? e.driverError?.code;
  const detail = e.detail ?? e.driverError?.detail ?? '';
  return code === '23505' && /\(code\)/i.test(detail);
}

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly repo: Repository<CustomerEntity>,
    private readonly authService: AuthService,
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
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await this.nextCode();
      try {
        return await this.repo.save(this.repo.create({ ...data, code, status: 'PENDING' }));
      } catch (err) {
        if (isDuplicateCodeError(err) && attempt < 4) continue;
        throw err;
      }
    }
    throw new Error('امکان ایجاد کد مشتری نبود، دوباره تلاش کنید');
  }

  /**
   * Next sequential customer code, derived from the highest existing TRN-#####
   * including soft-deleted rows (whose unique code constraint is still enforced).
   */
  private async nextCode(): Promise<string> {
    const rows = await this.repo
      .createQueryBuilder('c')
      .withDeleted()
      .select('c.code', 'code')
      .where("c.code ~ '^TRN-[0-9]+$'")
      .getRawMany<{ code: string }>();
    const max = rows.reduce((m, r) => {
      const n = parseInt(r.code.slice(4), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `TRN-${String(max + 1).padStart(5, '0')}`;
  }

  async update(id: string, data: Partial<CustomerEntity>) {
    const before = await this.findOne(id);
    await this.repo.update(id, data);
    if (data.status && data.status !== before.status) {
      await this.authService.syncUserActiveByCustomerId(id, data.status);
    }
    return this.findOne(id);
  }

  async updateSegment(id: string, segment: string) {
    await this.repo.update(id, { segment });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.authService.deactivateUserByCustomerId(id);
    await this.repo.softDelete(id);
    return { message: 'مشتری با موفقیت حذف شد' };
  }

  async updateBalance(id: string, delta: number) {
    const customer = await this.findOne(id);
    customer.balance = Number(customer.balance) + delta;
    return this.repo.save(customer);
  }
}
