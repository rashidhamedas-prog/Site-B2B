import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionEntity } from './entities/collection.entity';

@Injectable()
export class CollectionService {
  constructor(
    @InjectRepository(CollectionEntity)
    private readonly repo: Repository<CollectionEntity>,
  ) {}

  findAll(activeOnly = false, channel?: 'RETAIL' | 'WHOLESALE') {
    const where: any = activeOnly ? { isActive: true } : {};
    if (channel) where.channel = channel;
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, channel?: 'RETAIL' | 'WHOLESALE') {
    const row = await this.repo.findOne({ where: { id } });
    if (!row || (channel && row.channel !== channel)) {
      throw new NotFoundException('کالکشن یافت نشد');
    }
    return row;
  }

  async findBySlug(slug: string, channel?: 'RETAIL' | 'WHOLESALE') {
    const row = await this.repo.findOne({ where: { slug } });
    if (!row || (channel && row.channel !== channel)) {
      throw new NotFoundException('کالکشن یافت نشد');
    }
    return row;
  }

  create(data: Partial<CollectionEntity>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<CollectionEntity>) {
    await this.findOne(id);
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.softDelete(id);
    return { message: 'کالکشن حذف شد' };
  }
}
