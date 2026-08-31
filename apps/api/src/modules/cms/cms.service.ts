import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CmsPageEntity } from './entities/cms-page.entity';
import { SiteContentEntity } from './entities/site-content.entity';
import { sanitizeCmsBlocks, sanitizeCmsHtml, sanitizeCmsValue } from './cms-sanitize';
import { OutboxService } from '../omnichannel/services/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../omnichannel/omnichannel.constants';

@Injectable()
export class CmsService {
  constructor(
    @InjectRepository(CmsPageEntity)
    private readonly repo: Repository<CmsPageEntity>,
    @InjectRepository(SiteContentEntity)
    private readonly siteContentRepo: Repository<SiteContentEntity>,
    private readonly outbox: OutboxService,
  ) {}

  private async enqueueCmsPublished(
    page: { id: string; status?: string; channel?: string; isPublished?: boolean },
    operationId: string,
    manager?: EntityManager,
  ) {
    const published = page.status === 'PUBLISHED' || page.isPublished === true;
    if (!published) return;
    await this.outbox.enqueue(
      {
        operationId,
        eventType: OUTBOX_EVENT_TYPES.CMS_PUBLISHED,
        aggregateType: 'CMS_PAGE',
        aggregateId: page.id,
        channel: page.channel ?? null,
        payload: { pageId: page.id, channel: page.channel ?? null },
      },
      manager,
    );
  }

  private normalizeChannel(channel?: string): string {
    const c = String(channel || 'WHOLESALE').toUpperCase();
    return c === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
  }

  private sanitizePage(page: CmsPageEntity): CmsPageEntity {
    page.content = sanitizeCmsHtml(page.content || '');
    page.blocks = sanitizeCmsBlocks(page.blocks);
    if (page.meta) page.meta = sanitizeCmsValue(page.meta, 'meta') as Record<string, any>;
    return page;
  }

  // Public: published page by slug. Channel is always applied — no cross-channel fallback.
  async findBySlug(slug: string, channel?: string): Promise<CmsPageEntity> {
    const ch = this.normalizeChannel(channel);
    const page = await this.repo.findOne({ where: { slug, status: 'PUBLISHED', channel: ch } });
    if (!page) throw new NotFoundException('صفحه یافت نشد');
    return this.sanitizePage(page);
  }

  // Public: published banners/FAQ collections.
  async findByKind(kind: string, channel?: string): Promise<CmsPageEntity[]> {
    const where: any = { kind: kind.toUpperCase(), status: 'PUBLISHED', channel: this.normalizeChannel(channel) };
    const rows = await this.repo.find({
      where,
      order: { updatedAt: 'DESC' },
    });
    return rows.map((row) => this.sanitizePage(row));
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
    return this.repo.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(CmsPageEntity).save(
        manager.getRepository(CmsPageEntity).create({
          ...data,
          channel,
          content: typeof data.content === 'string' ? sanitizeCmsHtml(data.content) : data.content,
          blocks: sanitizeCmsBlocks(data.blocks),
          meta: data.meta ? (sanitizeCmsValue(data.meta, 'meta') as Record<string, any>) : data.meta,
        }),
      );
      await this.enqueueCmsPublished(saved, `${saved.id}:create`, manager);
      return saved;
    });
  }

  async update(id: string, data: Partial<CmsPageEntity>): Promise<CmsPageEntity> {
    const page = await this.repo.findOne({ where: { id } });
    if (!page) throw new NotFoundException('صفحه یافت نشد');
    if (data.channel !== undefined) data.channel = this.normalizeChannel(data.channel);
    if (data.content !== undefined) data.content = sanitizeCmsHtml(String(data.content || ''));
    if (data.blocks !== undefined) data.blocks = sanitizeCmsBlocks(data.blocks);
    if (data.meta !== undefined) data.meta = sanitizeCmsValue(data.meta, 'meta') as Record<string, any>;
    const prevUpdatedAt = page.updatedAt ? new Date(page.updatedAt).getTime() : 0;
    Object.assign(page, data);
    return this.repo.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(CmsPageEntity).save(page);
      await this.enqueueCmsPublished(saved, `${saved.id}:update:${prevUpdatedAt}`, manager);
      return saved;
    });
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
    return {
      ...row,
      blocks: sanitizeCmsBlocks(row.blocks),
    };
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
        blocks: sanitizeCmsBlocks(data.blocks),
        seo: data.seo ?? null,
        isPublished: data.isPublished ?? true,
      });
    } else {
      if (data.title !== undefined) row.title = data.title;
      if (data.blocks !== undefined) row.blocks = sanitizeCmsBlocks(data.blocks);
      if (data.seo !== undefined) row.seo = data.seo;
      if (data.isPublished !== undefined) row.isPublished = !!data.isPublished;
    }
    const prevUpdatedAt = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    return this.siteContentRepo.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(SiteContentEntity).save(row);
      await this.enqueueCmsPublished(
        { id: saved.id, isPublished: saved.isPublished, channel: saved.channel },
        `${saved.id}:site:${prevUpdatedAt}`,
        manager,
      );
      return saved;
    });
  }

  async deleteSiteContent(id: string) {
    const row = await this.siteContentRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('محتوای صفحه یافت نشد');
    await this.siteContentRepo.remove(row);
    return { deleted: true, id };
  }
}
