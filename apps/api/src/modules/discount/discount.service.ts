import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscountCodeEntity } from './entities/discount-code.entity';

@Injectable()
export class DiscountService {
  constructor(
    @InjectRepository(DiscountCodeEntity)
    private readonly repo: Repository<DiscountCodeEntity>,
  ) {}

  async findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async create(data: Partial<DiscountCodeEntity>) {
    const code = this.repo.create(data);
    return this.repo.save(code);
  }

  async update(id: string, data: Partial<DiscountCodeEntity>) {
    await this.repo.update(id, data);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { message: 'کد تخفیف حذف شد' };
  }

  async validate(code: string, orderTotal: number) {
    const dc = await this.repo.findOne({ where: { code: code.toUpperCase(), isActive: true } });
    if (!dc) throw new NotFoundException('کد تخفیف معتبر نیست');
    if (dc.expiresAt && dc.expiresAt < new Date()) throw new BadRequestException('کد تخفیف منقضی شده');
    if (dc.maxUses && dc.usedCount >= dc.maxUses) throw new BadRequestException('سقف استفاده از کد تخفیف پر شده');
    if (orderTotal < dc.minOrder) throw new BadRequestException(`حداقل سفارش برای این کد ${(dc.minOrder / 10).toLocaleString()} تومان است`);

    const discount = dc.type === 'PERCENT'
      ? Math.floor(orderTotal * dc.value / 100)
      : Math.min(dc.value, orderTotal);

    return { id: dc.id, code: dc.code, type: dc.type, value: dc.value, discount };
  }

  async recordUse(id: string) {
    await this.repo.increment({ id }, 'usedCount', 1);
  }
}
