import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from './entities/category.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repo: Repository<CategoryEntity>,
  ) {}

  findAll() {
    return this.repo.find({ where: { deletedAt: null as any }, order: { createdAt: 'DESC' } as any });
  }

  async findOne(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('دسته‌بندی یافت نشد');
    return c;
  }

  async create(body: { name: string; skuPrefix?: string }) {
    if (!body?.name?.trim()) throw new BadRequestException('نام دسته‌بندی الزامی است');
    const entity = this.repo.create({
      name: body.name.trim(),
      skuPrefix: String(body.skuPrefix ?? '').trim(),
      nextSequence: 1,
    });
    return this.repo.save(entity);
  }

  async update(id: string, body: { name?: string; skuPrefix?: string; nextSequence?: number }) {
    const existing = await this.findOne(id);
    if (typeof body.name === 'string') existing.name = body.name.trim();
    if (typeof body.skuPrefix === 'string') existing.skuPrefix = body.skuPrefix.trim();
    if (typeof body.nextSequence === 'number' && Number.isFinite(body.nextSequence) && body.nextSequence >= 1) {
      existing.nextSequence = Math.floor(body.nextSequence);
    }
    return this.repo.save(existing);
  }

  async remove(id: string) {
    const c = await this.findOne(id);
    await this.repo.softDelete(c.id);
    return { message: 'دسته‌بندی حذف شد' };
  }
}

