import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CmsPageEntity } from './entities/cms-page.entity';
import { SiteContentEntity } from './entities/site-content.entity';

@Injectable()
export class CmsService {
  constructor(
    @InjectRepository(CmsPageEntity)
    private readonly repo: Repository<CmsPageEntity>,
    @InjectRepository(SiteContentEntity)
    private readonly siteContentRepo: Repository<SiteContentEntity>,
  ) {}

  private normalizeChannel(channel?: string): string {
    const c = String(channel || 'WHOLESALE').toUpperCase();
    return c === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
  }

  // Public: published page by slug (+ optional channel).
  async findBySlug(slug: string, channel?: string): Promise<CmsPageEntity> {
    const where: any = { slug, status: 'PUBLISHED' };
    if (channel) where.channel = this.normalizeChannel(channel);
    let page = await this.repo.findOne({ where });
    // Fallback: if channel filter miss, try without channel for legacy rows
    if (!page && channel) {
      page = await this.repo.findOne({ where: { slug, status: 'PUBLISHED' } });
    }
    if (!page) throw new NotFoundException('صفحه یافت نشد');
    return page;
  }

  // Public: published banners/FAQ collections.
  async findByKind(kind: string, channel?: string): Promise<CmsPageEntity[]> {
    const where: any = { kind: kind.toUpperCase(), status: 'PUBLISHED' };
    if (channel) where.channel = this.normalizeChannel(channel);
    return this.repo.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  // Admin
  async findAllAdmin(channel?: string): Promise<CmsPageEntity[]> {
    const where: any = {};
    if (channel) where.channel = this.normalizeChannel(channel);
    return this.repo.find({ where, order: { updatedAt: 'DESC' } });
  }

  async create(data: Partial<CmsPageEntity>): Promise<CmsPageEntity> {
    const channel = this.normalizeChannel(data.channel);
    const slug = data.slug;
    if (slug) {
      const exists = await this.repo.findOne({
        where: { slug, channel },
        withDeleted: true,
      });
      if (exists) throw new ConflictException('اسلاگ تکراری است');
    }
    return this.repo.save(
      this.repo.create({
        ...data,
        channel,
        blocks: Array.isArray(data.blocks) ? data.blocks : [],
      }),
    );
  }

  async update(id: string, data: Partial<CmsPageEntity>): Promise<CmsPageEntity> {
    const page = await this.repo.findOne({ where: { id } });
    if (!page) throw new NotFoundException('صفحه یافت نشد');
    if (data.channel !== undefined) data.channel = this.normalizeChannel(data.channel);
    if (data.blocks !== undefined && !Array.isArray(data.blocks)) {
      data.blocks = [];
    }
    Object.assign(page, data);
    return this.repo.save(page);
  }

  async remove(id: string) {
    const res = await this.repo.softDelete(id);
    if (!res.affected) throw new NotFoundException('صفحه یافت نشد');
    return { deleted: true };
  }

  // ── Site content ───────────────────────────────────────────

  async listSiteContent(channel?: string) {
    const where: any = {};
    if (channel) where.channel = this.normalizeChannel(channel);
    return this.siteContentRepo.find({ where, order: { pageKey: 'ASC' } });
  }

  async getSiteContent(channel: string, pageKey: string) {
    const ch = this.normalizeChannel(channel);
    const row = await this.siteContentRepo.findOne({
      where: { channel: ch, pageKey },
    });
    if (!row) throw new NotFoundException('محتوای صفحه یافت نشد');
    return row;
  }

  /** Public: only published content — empty shell when missing (storefront falls back to defaults) */
  async getPublicSiteContent(channel: string, pageKey: string) {
    const ch = this.normalizeChannel(channel);
    const row = await this.siteContentRepo.findOne({
      where: { channel: ch, pageKey, isPublished: true },
    });
    if (!row) {
      return {
        channel: ch,
        pageKey,
        title: pageKey,
        blocks: [],
        seo: null,
        isPublished: false,
      };
    }
    return row;
  }

  async upsertSiteContent(data: {
    channel?: string;
    pageKey: string;
    title?: string;
    blocks?: Array<Record<string, unknown>>;
    seo?: Record<string, string> | null;
    isPublished?: boolean;
  }) {
    if (!data.pageKey?.trim()) throw new BadRequestException('کلید صفحه الزامی است');
    const channel = this.normalizeChannel(data.channel);
    const pageKey = data.pageKey.trim();
    let row = await this.siteContentRepo.findOne({ where: { channel, pageKey } });
    if (!row) {
      row = this.siteContentRepo.create({
        channel,
        pageKey,
        title: data.title ?? pageKey,
        blocks: Array.isArray(data.blocks) ? data.blocks : [],
        seo: data.seo ?? null,
        isPublished: data.isPublished ?? true,
      });
    } else {
      if (data.title !== undefined) row.title = data.title;
      if (data.blocks !== undefined) row.blocks = Array.isArray(data.blocks) ? data.blocks : [];
      if (data.seo !== undefined) row.seo = data.seo;
      if (data.isPublished !== undefined) row.isPublished = !!data.isPublished;
    }
    return this.siteContentRepo.save(row);
  }

  async deleteSiteContent(id: string) {
    const row = await this.siteContentRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('محتوای صفحه یافت نشد');
    await this.siteContentRepo.remove(row);
    return { deleted: true, id };
  }
}
