import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CmsPageEntity } from './entities/cms-page.entity';

@Injectable()
export class CmsService {
  constructor(
    @InjectRepository(CmsPageEntity)
    private readonly repo: Repository<CmsPageEntity>,
  ) {}

  // Public: published page by slug.
  async findBySlug(slug: string): Promise<CmsPageEntity> {
    const page = await this.repo.findOne({ where: { slug, status: 'PUBLISHED' } });
    if (!page) throw new NotFoundException('صفحه یافت نشد');
    return page;
  }

  // Public: published banners/FAQ collections.
  async findByKind(kind: string): Promise<CmsPageEntity[]> {
    return this.repo.find({
      where: { kind: kind.toUpperCase(), status: 'PUBLISHED' },
      order: { updatedAt: 'DESC' },
    });
  }

  // Admin
  async findAllAdmin(): Promise<CmsPageEntity[]> {
    return this.repo.find({ order: { updatedAt: 'DESC' } });
  }

  async create(data: Partial<CmsPageEntity>): Promise<CmsPageEntity> {
    const exists = await this.repo.findOne({ where: { slug: data.slug }, withDeleted: true });
    if (exists) throw new ConflictException('اسلاگ تکراری است');
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<CmsPageEntity>): Promise<CmsPageEntity> {
    const page = await this.repo.findOne({ where: { id } });
    if (!page) throw new NotFoundException('صفحه یافت نشد');
    Object.assign(page, data);
    return this.repo.save(page);
  }

  async remove(id: string) {
    const res = await this.repo.softDelete(id);
    if (!res.affected) throw new NotFoundException('صفحه یافت نشد');
    return { deleted: true };
  }
}
