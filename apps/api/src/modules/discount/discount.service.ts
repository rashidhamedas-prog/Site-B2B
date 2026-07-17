import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscountCodeEntity } from './entities/discount-code.entity';
import { TieredDiscountEntity, TierLevel } from './entities/tiered-discount.entity';
import { SideDiscountEntity, SideDiscountType } from './entities/side-discount.entity';

@Injectable()
export class DiscountService {
  constructor(
    @InjectRepository(DiscountCodeEntity)
    private readonly repo: Repository<DiscountCodeEntity>,
    @InjectRepository(TieredDiscountEntity)
    private readonly tierRepo: Repository<TieredDiscountEntity>,
    @InjectRepository(SideDiscountEntity)
    private readonly sideRepo: Repository<SideDiscountEntity>,
  ) {}

  // ── Codes ──────────────────────────────────────────────────

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
    const now = new Date();
    if (dc.startsAt && dc.startsAt > now) throw new BadRequestException('کد تخفیف هنوز فعال نشده');
    if (dc.expiresAt && dc.expiresAt < now) throw new BadRequestException('کد تخفیف منقضی شده');
    if (dc.maxUses && dc.usedCount >= dc.maxUses) throw new BadRequestException('سقف استفاده از کد تخفیف پر شده');
    if (orderTotal < dc.minOrder) {
      throw new BadRequestException(`حداقل سفارش برای این کد ${(dc.minOrder / 10).toLocaleString()} تومان است`);
    }

    const discount = dc.type === 'PERCENT'
      ? Math.floor(orderTotal * dc.value / 100)
      : Math.min(dc.value, orderTotal);

    return { id: dc.id, code: dc.code, type: dc.type, value: dc.value, discount };
  }

  async recordUse(id: string) {
    await this.repo.increment({ id }, 'usedCount', 1);
  }

  // ── Tiered (طبقاتی) ────────────────────────────────────────

  async listTiered() {
    return this.tierRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createTiered(data: { levels: TierLevel[]; expiresAt?: string | Date; isActive?: boolean }) {
    const levels = (data.levels ?? [])
      .map((l) => ({ minAmount: Number(l.minAmount) || 0, percent: Number(l.percent) || 0 }))
      .filter((l) => l.percent > 0)
      .sort((a, b) => a.minAmount - b.minAmount);
    if (!levels.length) throw new BadRequestException('حداقل یک سطح تخفیف لازم است');
    return this.tierRepo.save(this.tierRepo.create({
      levels,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      isActive: data.isActive ?? true,
    }));
  }

  async updateTiered(id: string, data: Partial<TieredDiscountEntity>) {
    const existing = await this.tierRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('تخفیف طبقاتی یافت نشد');
    if (data.levels) {
      data.levels = data.levels
        .map((l) => ({ minAmount: Number(l.minAmount) || 0, percent: Number(l.percent) || 0 }))
        .filter((l) => l.percent > 0)
        .sort((a, b) => a.minAmount - b.minAmount);
    }
    Object.assign(existing, data);
    return this.tierRepo.save(existing);
  }

  async removeTiered(id: string) {
    await this.tierRepo.delete(id);
    return { message: 'تخفیف طبقاتی حذف شد' };
  }

  async applyTiered(orderTotal: number): Promise<{ percent: number; discount: number; tierId?: string }> {
    const now = new Date();
    const tiers = await this.tierRepo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
    let best = { percent: 0, discount: 0, tierId: undefined as string | undefined };
    for (const t of tiers) {
      if (t.expiresAt && t.expiresAt < now) continue;
      const levels = [...(t.levels ?? [])].sort((a, b) => b.minAmount - a.minAmount);
      const match = levels.find((l) => orderTotal >= l.minAmount);
      if (match && match.percent > best.percent) {
        best = {
          percent: match.percent,
          discount: Math.floor(orderTotal * match.percent / 100),
          tierId: t.id,
        };
      }
    }
    return best;
  }

  // ── Side (جانبی) ───────────────────────────────────────────

  async listSide() {
    return this.sideRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createSide(data: Partial<SideDiscountEntity>) {
    if (!data.type || !data.percent) throw new BadRequestException('نوع و درصد تخفیف الزامی است');
    return this.sideRepo.save(this.sideRepo.create({
      type: data.type,
      percent: Number(data.percent),
      threshold: Number(data.threshold ?? 0),
      categoryId: data.categoryId || undefined,
      isActive: data.isActive ?? true,
    }));
  }

  async updateSide(id: string, data: Partial<SideDiscountEntity>) {
    await this.sideRepo.update(id, data as any);
    return this.sideRepo.findOne({ where: { id } });
  }

  async removeSide(id: string) {
    await this.sideRepo.delete(id);
    return { message: 'تخفیف جانبی حذف شد' };
  }

  /**
   * Apply best matching side discount based on customer purchase history stats.
   * stats: { invoiceCount, invoiceSum (IRR), productCount, isFirstInvoice }
   */
  async applySide(
    orderTotal: number,
    stats: {
      invoiceCount: number;
      invoiceSum: number;
      productCount: number;
      isFirstInvoice: boolean;
      categoryIds?: string[];
    },
  ): Promise<{ percent: number; discount: number; sideId?: string; type?: SideDiscountType }> {
    const rules = await this.sideRepo.find({ where: { isActive: true } });
    let best = { percent: 0, discount: 0, sideId: undefined as string | undefined, type: undefined as SideDiscountType | undefined };

    for (const r of rules) {
      if (r.categoryId && stats.categoryIds?.length && !stats.categoryIds.includes(r.categoryId)) {
        continue;
      }
      let ok = false;
      switch (r.type) {
        case 'FIRST_INVOICE':
          ok = stats.isFirstInvoice;
          break;
        case 'INVOICE_COUNT':
          ok = stats.invoiceCount >= Number(r.threshold);
          break;
        case 'INVOICE_SUM':
          ok = stats.invoiceSum >= Number(r.threshold);
          break;
        case 'PRODUCT_COUNT':
          ok = stats.productCount >= Number(r.threshold);
          break;
        default:
          ok = false;
      }
      if (ok && r.percent > best.percent) {
        best = {
          percent: r.percent,
          discount: Math.floor(orderTotal * r.percent / 100),
          sideId: r.id,
          type: r.type,
        };
      }
    }
    return best;
  }
}
