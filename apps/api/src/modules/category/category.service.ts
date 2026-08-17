import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from './entities/category.entity';
import { matchCategorySeed } from './category-seo-seed';
import { asciiSlug } from '../../common/ascii-slug';
import { normalizePublicSlug } from '../../common/public-slug';
import { SeoRedirectEntity } from '../blog/entities/seo-redirect.entity';

export type CategoryUpsert = {
  name?: string;
  skuPrefix?: string;
  nextSequence?: number;
  bannerUrl?: string | null;
  slug?: string | null;
  nameEn?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  h1?: string | null;
  introText?: string | null;
  bottomContent?: string | null;
  heroImage?: string | null;
  heroImageAlt?: string | null;
  ogImage?: string | null;
  canonicalOverride?: string | null;
  isIndexable?: boolean;
  sortOrder?: number;
  status?: string;
  faqItems?: Array<{ question: string; answer: string }> | null;
  wholesaleH1?: string | null;
  wholesaleSeoTitle?: string | null;
  wholesaleSeoDescription?: string | null;
  wholesaleIntroText?: string | null;
  wholesaleBottomContent?: string | null;
};

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repo: Repository<CategoryEntity>,
    @InjectRepository(SeoRedirectEntity)
    private readonly redirectRepo: Repository<SeoRedirectEntity>,
  ) {}

  findAll(opts?: { includeHidden?: boolean }) {
    if (opts?.includeHidden) {
      return this.repo.find({
        where: { deletedAt: null as any },
        order: { sortOrder: 'ASC', createdAt: 'DESC' } as any,
      });
    }
    return this.repo.find({
      where: { deletedAt: null as any, status: 'ACTIVE' } as any,
      order: { sortOrder: 'ASC', createdAt: 'DESC' } as any,
    });
  }

  async findOne(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('دسته‌بندی یافت نشد');
    return c;
  }

  async findBySlug(slug: string) {
    const normalized = asciiSlug(slug, '');
    if (!normalized) throw new NotFoundException('دسته‌بندی یافت نشد');
    const c = await this.repo.findOne({ where: { slug: normalized } });
    if (!c || c.status === 'HIDDEN') throw new NotFoundException('دسته‌بندی یافت نشد');
    return c;
  }

  private async uniqueSlug(desired: string, excludeId?: string): Promise<string> {
    const base = normalizePublicSlug(desired, 'category');
    let slug = base;
    let n = 2;
    while (true) {
      const existing = await this.repo.findOne({ where: { slug } });
      if (!existing || existing.id === excludeId) return slug;
      slug = `${base}-${n}`;
      n += 1;
      if (n > 50) throw new BadRequestException('امکان ساخت slug یکتا وجود ندارد');
    }
  }

  private applySeedDefaults(name: string, entity: CategoryEntity) {
    const seed = matchCategorySeed(name);
    if (!seed) return;
    entity.h1 = entity.h1 || seed.retail.h1;
    entity.seoTitle = entity.seoTitle || seed.retail.seoTitle;
    entity.seoDescription = entity.seoDescription || seed.retail.seoDescription;
    entity.introText = entity.introText || seed.retail.introText;
    entity.bottomContent = entity.bottomContent || seed.retail.bottomContent;
    entity.wholesaleH1 = entity.wholesaleH1 || seed.wholesale.h1;
    entity.wholesaleSeoTitle = entity.wholesaleSeoTitle || seed.wholesale.seoTitle;
    entity.wholesaleSeoDescription = entity.wholesaleSeoDescription || seed.wholesale.seoDescription;
    entity.wholesaleIntroText = entity.wholesaleIntroText || seed.wholesale.introText;
    entity.wholesaleBottomContent = entity.wholesaleBottomContent || seed.wholesale.bottomContent;
  }

  async create(body: CategoryUpsert & { name: string }) {
    if (!body?.name?.trim()) throw new BadRequestException('نام دسته‌بندی الزامی است');
    const name = body.name.trim();
    const seed = matchCategorySeed(name);
    const slug = await this.uniqueSlug(body.slug || seed?.slug || name);
    const entity = this.repo.create({
      name,
      skuPrefix: String(body.skuPrefix ?? '').trim(),
      nextSequence: 1,
      bannerUrl: body.bannerUrl?.trim() || null,
      slug,
      nameEn: body.nameEn?.trim() || null,
      seoTitle: body.seoTitle?.trim() || null,
      seoDescription: body.seoDescription?.trim() || null,
      h1: body.h1?.trim() || null,
      introText: body.introText?.trim() || null,
      bottomContent: body.bottomContent?.trim() || null,
      heroImage: body.heroImage?.trim() || null,
      heroImageAlt: body.heroImageAlt?.trim() || null,
      ogImage: body.ogImage?.trim() || null,
      canonicalOverride: body.canonicalOverride?.trim() || null,
      isIndexable: body.isIndexable !== false,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      status: body.status === 'HIDDEN' ? 'HIDDEN' : 'ACTIVE',
      faqItems: body.faqItems ?? null,
      wholesaleH1: body.wholesaleH1?.trim() || null,
      wholesaleSeoTitle: body.wholesaleSeoTitle?.trim() || null,
      wholesaleSeoDescription: body.wholesaleSeoDescription?.trim() || null,
      wholesaleIntroText: body.wholesaleIntroText?.trim() || null,
      wholesaleBottomContent: body.wholesaleBottomContent?.trim() || null,
    });
    this.applySeedDefaults(name, entity);
    return this.repo.save(entity);
  }

  async update(id: string, body: CategoryUpsert) {
    const existing = await this.findOne(id);
    if (typeof body.name === 'string') existing.name = body.name.trim();
    if (typeof body.skuPrefix === 'string') existing.skuPrefix = body.skuPrefix.trim();
    if (typeof body.nextSequence === 'number' && Number.isFinite(body.nextSequence) && body.nextSequence >= 1) {
      existing.nextSequence = Math.floor(body.nextSequence);
    }
    if (body.bannerUrl !== undefined) {
      existing.bannerUrl = body.bannerUrl?.trim() ? body.bannerUrl.trim() : null;
    }
    const previousSlug = existing.slug;
    if (body.slug !== undefined && body.slug !== existing.slug) {
      existing.slug = await this.uniqueSlug(String(body.slug || existing.name), existing.id);
    }
    const assignText = (key: keyof CategoryEntity, value: string | null | undefined) => {
      if (value === undefined) return;
      (existing as any)[key] = value?.trim() ? value.trim() : null;
    };
    assignText('nameEn', body.nameEn);
    assignText('seoTitle', body.seoTitle);
    assignText('seoDescription', body.seoDescription);
    assignText('h1', body.h1);
    assignText('introText', body.introText);
    assignText('bottomContent', body.bottomContent);
    assignText('heroImage', body.heroImage);
    assignText('heroImageAlt', body.heroImageAlt);
    assignText('ogImage', body.ogImage);
    assignText('canonicalOverride', body.canonicalOverride);
    assignText('wholesaleH1', body.wholesaleH1);
    assignText('wholesaleSeoTitle', body.wholesaleSeoTitle);
    assignText('wholesaleSeoDescription', body.wholesaleSeoDescription);
    assignText('wholesaleIntroText', body.wholesaleIntroText);
    assignText('wholesaleBottomContent', body.wholesaleBottomContent);
    if (body.isIndexable !== undefined) existing.isIndexable = !!body.isIndexable;
    if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) {
      existing.sortOrder = Number(body.sortOrder);
    }
    if (body.status !== undefined) existing.status = body.status === 'HIDDEN' ? 'HIDDEN' : 'ACTIVE';
    if (body.faqItems !== undefined) existing.faqItems = body.faqItems;
    const saved = await this.repo.save(existing);
    if (previousSlug && saved.slug && previousSlug !== saved.slug) {
      await this.recordSlugRedirect(previousSlug, saved.slug);
    }
    return saved;
  }

  private async recordSlugRedirect(oldSlug: string, newSlug: string) {
    const from = String(oldSlug || '').trim();
    const to = String(newSlug || '').trim();
    if (!from || !to || from === to) return;
    const sourcePath = `/category/${from}`;
    const destinationUrl = `/category/${to}`;
    for (const channel of ['RETAIL', 'WHOLESALE'] as const) {
      const existing = await this.redirectRepo.findOne({ where: { channel, sourcePath } });
      if (existing?.destinationUrl === sourcePath) continue;
      if (existing) {
        existing.destinationUrl = destinationUrl;
        existing.statusCode = 301;
        existing.reason = 'SLUG_CHANGED';
        existing.autoGenerated = true;
        existing.isActive = true;
        await this.redirectRepo.save(existing);
      } else {
        await this.redirectRepo.save(
          this.redirectRepo.create({
            channel,
            sourcePath,
            destinationUrl,
            statusCode: 301,
            reason: 'SLUG_CHANGED',
            autoGenerated: true,
            isActive: true,
          }),
        );
      }
    }
  }

  async remove(id: string) {
    const c = await this.findOne(id);
    await this.repo.softDelete(c.id);
    return { message: 'دسته‌بندی حذف شد' };
  }
}
