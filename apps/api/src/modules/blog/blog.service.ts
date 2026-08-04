import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { randomUUID } from 'crypto';
import { asciiSlug } from '../../common/ascii-slug';
import { BlogPostEntity } from './entities/blog-post.entity';
import { BlogCategoryEntity } from './entities/blog-category.entity';
import { BlogTagEntity } from './entities/blog-tag.entity';
import { BlogAuthorEntity } from './entities/blog-author.entity';
import { SeoRedirectEntity } from './entities/seo-redirect.entity';
import { BlogSettingsEntity } from './entities/blog-settings.entity';
import { SeoAuditLogEntity } from './entities/seo-audit-log.entity';
import {
  countWords,
  estimateReadingMinutes,
  wouldCreateRedirectLoop,
  buildRobotsMeta,
  resolveCanonicalUrl,
  buildArticleJsonLd,
  buildFaqJsonLd,
  buildBreadcrumbJsonLd,
} from './blog-seo.util';
import { sanitizeBlogHtml, buildHowToJsonLd } from './blog-sanitize';
import { hasBlogPermission, type BlogRole } from './blog-roles';
import type {
  CreateBlogPostDto,
  UpdateBlogPostDto,
  DeleteBlogPostDto,
  ImportBlogDto,
  CreateCategoryDto,
  CreateTagDto,
  CreateRedirectDto,
} from './dto/blog.dto';

function slugify(input: string): string {
  return asciiSlug(input, 'post');
}

function normalizeChannel(raw?: string): 'RETAIL' | 'WHOLESALE' {
  return String(raw || 'WHOLESALE').toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
}

type Actor = {
  id?: string;
  role?: string;
  blogRole?: string | null;
  effectiveBlogRole?: BlogRole | null;
};

const RETAIL_SEED = [
  'راهنمای خرید مانتو',
  'استایل زنانه',
  'راهنمای سایزبندی',
  'شناخت پارچه',
  'نگهداری لباس',
  'مد و ترند',
  'مانتو لینن',
  'مانتو کتان',
  'استایل پاییزی',
  'استایل تابستانی',
];

const WHOLESALE_SEED = [
  'راهنمای خرید عمده',
  'مدیریت بوتیک',
  'انتخاب مدل پرفروش',
  'راهنمای پارچه',
  'فروش پوشاک',
  'چیدمان ویترین',
  'بازاریابی پوشاک',
  'مدیریت موجودی',
  'خرید از تولیدی',
  'ترندهای بازار مانتو',
];

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(BlogPostEntity) private readonly repo: Repository<BlogPostEntity>,
    @InjectRepository(BlogCategoryEntity) private readonly catRepo: Repository<BlogCategoryEntity>,
    @InjectRepository(BlogTagEntity) private readonly tagRepo: Repository<BlogTagEntity>,
    @InjectRepository(BlogAuthorEntity) private readonly authorRepo: Repository<BlogAuthorEntity>,
    @InjectRepository(SeoRedirectEntity) private readonly redirectRepo: Repository<SeoRedirectEntity>,
    @InjectRepository(BlogSettingsEntity) private readonly settingsRepo: Repository<BlogSettingsEntity>,
    @InjectRepository(SeoAuditLogEntity) private readonly auditRepo: Repository<SeoAuditLogEntity>,
  ) {}

  async writeAudit(opts: {
    action: string;
    channel?: string | null;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    meta?: Record<string, unknown>;
  }) {
    return this.audit(opts);
  }

  private async audit(opts: {
    action: string;
    channel?: string | null;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    meta?: Record<string, unknown>;
  }) {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          action: opts.action,
          channel: opts.channel ?? null,
          entityType: opts.entityType ?? null,
          entityId: opts.entityId ?? null,
          actorId: opts.actorId ?? null,
          meta: opts.meta ?? null,
        }),
      );
    } catch {
      /* never block main flow */
    }
  }

  private enrichStats(data: Partial<BlogPostEntity>): Partial<BlogPostEntity> {
    let content = data.content;
    if (content && (data.contentFormat === 'HTML' || String(content).trim().startsWith('<'))) {
      content = sanitizeBlogHtml(content);
      data = { ...data, content, contentFormat: data.contentFormat || 'HTML' };
    }
    const wordCount = countWords(String(data.content ?? ''));
    return {
      ...data,
      wordCount,
      readingTimeMinutes: estimateReadingMinutes(wordCount),
    };
  }

  private siteOrigin(channel: string): string {
    if (channel === 'RETAIL') {
      return (process.env.NEXT_PUBLIC_RETAIL_URL || 'https://poshaktaranom.ir').replace(/\/$/, '');
    }
    return (process.env.NEXT_PUBLIC_SITE_URL || 'https://poshaktaranom.com').replace(/\/$/, '');
  }

  // ── Public ────────────────────────────────────────────────

  async findPublished(opts: {
    page?: number;
    limit?: number;
    category?: string;
    categorySlug?: string;
    tag?: string;
    search?: string;
    channel?: string;
  }) {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(50, Number(opts.limit) || 12);
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: 'PUBLISHED' })
      .andWhere('p.deletedAt IS NULL');

    if (opts.channel) {
      qb.andWhere('p.channel = :channel', { channel: normalizeChannel(opts.channel) });
    }
    if (opts.category) qb.andWhere('p.category = :category', { category: opts.category });
    if (opts.categorySlug) {
      const cat = await this.catRepo.findOne({
        where: {
          slug: opts.categorySlug,
          channel: opts.channel ? normalizeChannel(opts.channel) : undefined,
          isActive: true,
        } as any,
      });
      if (cat) qb.andWhere('p.categoryId = :cid', { cid: cat.id });
      else qb.andWhere('1=0');
    }
    if (opts.search) {
      qb.andWhere('(p.title ILIKE :q OR p.excerpt ILIKE :q OR p.content ILIKE :q)', {
        q: `%${opts.search}%`,
      });
    }
    if (opts.tag) {
      qb.andWhere('p.tags ILIKE :tag', { tag: `%${opts.tag}%` });
    }

    qb.orderBy('p.publishedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async findBySlug(slug: string, channel?: string): Promise<BlogPostEntity> {
    const where: any = { slug, status: 'PUBLISHED' };
    if (channel) where.channel = normalizeChannel(channel);
    const post = await this.repo.findOne({ where });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    this.repo.increment({ id: post.id }, 'views', 1).catch(() => undefined);
    return post;
  }

  async getPublicSeoBundle(slug: string, channel: string) {
    const post = await this.findBySlug(slug, channel);
    const origin = this.siteOrigin(post.channel);
    const path = `/blog/${post.slug}`;
    const url = `${origin}${path}`;
    const canonical = resolveCanonicalUrl({
      canonicalType: post.canonicalType,
      canonicalUrl: post.canonicalUrl,
      siteOrigin: origin,
      path,
    });
    const robots = buildRobotsMeta(post);
    const articleLd =
      post.articleSchemaEnabled !== false
        ? buildArticleJsonLd({
            schemaType: post.schemaType,
            title: post.seoTitle || post.title,
            description: post.seoDescription || post.excerpt,
            url,
            imageUrl: post.ogImage || post.coverImage,
            authorName: post.authorName,
            publisherName: 'تولیدی ترنم',
            publisherUrl: origin,
            logoUrl: `${origin}/logo-128.png`,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
          })
        : null;
    const faqLd =
      post.faqSchemaEnabled && post.faqItems?.length
        ? buildFaqJsonLd(post.faqItems)
        : null;
    const howToLd =
      post.howToSchemaEnabled !== false && post.howToData
        ? buildHowToJsonLd({
            ...post.howToData,
            steps: (post.howToData.steps || []).map((s) => ({
              title: s.title,
              description: s.description,
              urlAnchor: s.urlAnchor,
              sortOrder: s.sortOrder,
            })),
          })
        : null;
    const breadcrumbLd =
      post.breadcrumbEnabled !== false
        ? buildBreadcrumbJsonLd([
            { name: 'خانه', url: `${origin}/` },
            { name: 'وبلاگ', url: `${origin}/blog` },
            { name: post.title, url },
          ])
        : null;
    return { post, url, canonical, robots, articleLd, faqLd, howToLd, breadcrumbLd };
  }

  async feed(channel: string, limit = 20) {
    const ch = normalizeChannel(channel);
    const { items } = await this.findPublished({ channel: ch, limit, page: 1 });
    return items.filter((p) => p.rssEnabled !== false);
  }

  // ── Admin posts ───────────────────────────────────────────

  async findAllAdmin(opts: {
    channel?: string;
    status?: string;
    categoryId?: string;
    search?: string;
    authorId?: string;
  }) {
    const where: any = {};
    if (opts.channel) where.channel = normalizeChannel(opts.channel);
    if (opts.status) where.status = opts.status;
    if (opts.categoryId) where.categoryId = opts.categoryId;
    if (opts.authorId) where.authorId = opts.authorId;
    if (opts.search) {
      return this.repo.find({
        where: [
          { ...where, title: ILike(`%${opts.search}%`) },
          { ...where, slug: ILike(`%${opts.search}%`) },
        ],
        order: { createdAt: 'DESC' },
      });
    }
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOneAdmin(id: string) {
    const post = await this.repo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('مطلب یافت نشد');
    return post;
  }

  async create(data: CreateBlogPostDto, actor?: Actor): Promise<BlogPostEntity> {
    const channel = normalizeChannel(data.channel);
    const slug = data.slug ? slugify(data.slug) : slugify(data.title);
    const exists = await this.repo.findOne({
      where: { slug, channel },
      withDeleted: true,
    });
    if (exists) throw new ConflictException('اسلاگ در این سایت تکراری است');

    let status = data.status || 'DRAFT';
    if (status === 'PUBLISHED' && actor && !hasBlogPermission(actor, 'blog:publish')) {
      status = 'DRAFT';
    }

    const enriched = this.enrichStats({
      ...data,
      slug,
      channel,
      status,
      authorId: data.authorId || actor?.id || null,
      createdBy: actor?.id || null,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      publishAt: data.publishAt ? new Date(data.publishAt) : null,
    } as Partial<BlogPostEntity>);

    if (enriched.categoryId) {
      const cat = await this.catRepo.findOne({ where: { id: enriched.categoryId } });
      if (cat) enriched.category = cat.name;
    }

    const post = this.repo.create(enriched);
    const saved = await this.repo.save(post);
    if (Array.isArray(data.tags) && data.tags.length) {
      await this.syncTagsFromNames(saved.channel, data.tags, actor);
    }
    await this.audit({
      action: 'blog.post.create',
      channel,
      entityType: 'blog_post',
      entityId: saved.id,
      actorId: actor?.id,
      meta: { slug: saved.slug, status: saved.status },
    });
    return saved;
  }

  async update(id: string, data: UpdateBlogPostDto, actor?: Actor): Promise<BlogPostEntity> {
    const post = await this.findOneAdmin(id);

    if (actor?.effectiveBlogRole === 'AUTHOR' || actor?.blogRole === 'AUTHOR') {
      if (post.authorId && post.authorId !== actor.id && post.createdBy !== actor.id) {
        throw new ForbiddenException('فقط نویسنده می‌تواند مطلب خودش را ویرایش کند');
      }
      if (!hasBlogPermission(actor, 'blog:edit_own') && !hasBlogPermission(actor, 'blog:edit_any')) {
        throw new ForbiddenException('سطح دسترسی کافی نیست');
      }
    }

    const next: Partial<BlogPostEntity> = { ...data } as any;
    if (data.slug) next.slug = slugify(data.slug);
    if (data.channel) next.channel = normalizeChannel(data.channel);
    if (data.publishAt) next.publishAt = new Date(data.publishAt);
    if (data.content) Object.assign(next, this.enrichStats({ content: data.content }));

    // Slug change redirect for published posts
    if (
      next.slug &&
      next.slug !== post.slug &&
      post.status === 'PUBLISHED' &&
      post.redirectOnSlugChange !== false
    ) {
      await this.createSlugRedirect(post, next.slug, actor?.id);
    }

    // First publish stamp
    if (data.status === 'PUBLISHED' && post.status !== 'PUBLISHED') {
      if (actor && !hasBlogPermission(actor, 'blog:publish') && !hasBlogPermission(actor, 'blog:approve')) {
        throw new ForbiddenException('اجازه انتشار ندارید');
      }
      next.publishedAt = post.publishedAt || new Date();
    }

    if (data.categoryId) {
      const cat = await this.catRepo.findOne({ where: { id: data.categoryId } });
      if (cat) next.category = cat.name;
    }

    next.updatedBy = actor?.id || null;
    next.version = (post.version || 1) + 1;
    Object.assign(post, next);
    const saved = await this.repo.save(post);
    if (Array.isArray(data.tags)) {
      await this.syncTagsFromNames(saved.channel, data.tags, actor);
    }
    await this.audit({
      action: 'blog.post.update',
      channel: saved.channel,
      entityType: 'blog_post',
      entityId: saved.id,
      actorId: actor?.id,
      meta: { status: saved.status, slug: saved.slug },
    });
    return saved;
  }

  async transition(id: string, action: string, actor?: Actor, note?: string) {
    const post = await this.findOneAdmin(id);
    const map: Record<string, { status: string; perm: Parameters<typeof hasBlogPermission>[1] }> = {
      'submit-review': { status: 'IN_REVIEW', perm: 'blog:submit_review' },
      approve: { status: 'APPROVED', perm: 'blog:approve' },
      reject: { status: 'NEEDS_REVISION', perm: 'blog:reject' },
      publish: { status: 'PUBLISHED', perm: 'blog:publish' },
      unpublish: { status: 'UNPUBLISHED', perm: 'blog:publish' },
      schedule: { status: 'SCHEDULED', perm: 'blog:schedule' },
      archive: { status: 'ARCHIVED', perm: 'blog:delete_soft' },
    };
    const step = map[action];
    if (!step) throw new BadRequestException('عملیات نامعتبر');
    if (actor && !hasBlogPermission(actor, step.perm)) {
      throw new ForbiddenException('سطح دسترسی کافی نیست');
    }
    post.status = step.status;
    if (step.status === 'PUBLISHED') post.publishedAt = post.publishedAt || new Date();
    if (step.status === 'APPROVED' || step.status === 'NEEDS_REVISION') {
      post.reviewerId = actor?.id || post.reviewerId;
    }
    const saved = await this.repo.save(post);
    await this.audit({
      action: `blog.post.${action}`,
      channel: saved.channel,
      entityType: 'blog_post',
      entityId: saved.id,
      actorId: actor?.id,
      meta: { note, status: saved.status },
    });
    return saved;
  }

  async duplicate(id: string, actor?: Actor) {
    const src = await this.findOneAdmin(id);
    const copy = await this.create(
      {
        channel: src.channel as 'RETAIL' | 'WHOLESALE',
        title: `${src.title} (کپی)`,
        slug: `${src.slug}-copy-${Date.now().toString(36)}`,
        excerpt: src.excerpt,
        content: src.content,
        contentFormat: src.contentFormat,
        coverImage: src.coverImage,
        category: src.category,
        categoryId: src.categoryId || undefined,
        tags: src.tags,
        status: 'DRAFT',
        seoTitle: src.seoTitle,
        seoDescription: src.seoDescription,
        focusKeyword: src.focusKeyword,
        faqItems: src.faqItems || undefined,
      } as CreateBlogPostDto,
      actor,
    );
    return copy;
  }

  async remove(id: string, dto: DeleteBlogPostDto = {}, actor?: Actor) {
    const post = await this.findOneAdmin(id);
    if (dto.hard) {
      if (actor && !hasBlogPermission(actor, 'blog:delete_hard')) {
        throw new ForbiddenException('حذف دائمی فقط برای SUPER_ADMIN');
      }
      await this.repo.delete(id);
      await this.audit({
        action: 'blog.post.hard_delete',
        channel: post.channel,
        entityType: 'blog_post',
        entityId: id,
        actorId: actor?.id,
      });
      return { deleted: true, hard: true };
    }

    if (post.status === 'PUBLISHED') {
      const strategy = dto.strategy || 'UNPUBLISH';
      if (strategy === 'REDIRECT_ARTICLE' || strategy === 'REDIRECT_CATEGORY') {
        if (!dto.redirectTarget) throw new BadRequestException('مقصد ریدایرکت لازم است');
        await this.redirectRepo.save(
          this.redirectRepo.create({
            channel: post.channel,
            sourcePath: `/blog/${post.slug}`,
            destinationUrl: dto.redirectTarget,
            statusCode: 301,
            reason: 'ARTICLE_DELETED',
            createdBy: actor?.id || null,
          }),
        );
      }
      if (strategy === 'GONE') {
        await this.redirectRepo.save(
          this.redirectRepo.create({
            channel: post.channel,
            sourcePath: `/blog/${post.slug}`,
            destinationUrl: 'gone:410',
            statusCode: 410,
            reason: 'ARTICLE_DELETED',
            createdBy: actor?.id || null,
          }),
        );
      }
      if (strategy === 'UNPUBLISH') {
        post.status = 'UNPUBLISHED';
        await this.repo.save(post);
      }
    }

    await this.repo.softDelete(id);
    await this.audit({
      action: 'blog.post.soft_delete',
      channel: post.channel,
      entityType: 'blog_post',
      entityId: id,
      actorId: actor?.id,
      meta: { strategy: dto.strategy },
    });
    return { deleted: true, hard: false };
  }

  async restore(id: string, actor?: Actor) {
    const res = await this.repo.restore(id);
    if (!res.affected) throw new NotFoundException('مطلب یافت نشد');
    await this.audit({
      action: 'blog.post.restore',
      entityType: 'blog_post',
      entityId: id,
      actorId: actor?.id,
    });
    return this.findOneAdmin(id);
  }

  private async createSlugRedirect(post: BlogPostEntity, newSlug: string, actorId?: string) {
    const sourcePath = `/blog/${post.slug}`;
    const destinationUrl = `/blog/${newSlug}`;
    const existing = await this.redirectRepo.find({ where: { channel: post.channel, isActive: true } });
    if (
      wouldCreateRedirectLoop(
        existing.map((r) => ({
          sourcePath: r.sourcePath,
          destinationUrl: r.destinationUrl,
          isActive: r.isActive,
        })),
        sourcePath,
        destinationUrl,
        this.siteOrigin(post.channel),
      )
    ) {
      throw new BadRequestException('این تغییر اسلاگ باعث حلقه ریدایرکت می‌شود');
    }
    const dup = await this.redirectRepo.findOne({
      where: { channel: post.channel, sourcePath },
    });
    if (dup) {
      dup.destinationUrl = destinationUrl;
      dup.statusCode = 301;
      dup.reason = 'SLUG_CHANGED';
      dup.isActive = true;
      await this.redirectRepo.save(dup);
    } else {
      await this.redirectRepo.save(
        this.redirectRepo.create({
          channel: post.channel,
          sourcePath,
          destinationUrl,
          statusCode: 301,
          reason: 'SLUG_CHANGED',
          createdBy: actorId || null,
        }),
      );
    }
  }

  // ── Import ────────────────────────────────────────────────

  async importArticle(dto: ImportBlogDto, actor?: Actor) {
    const errors: Array<{ field: string; message: string }> = [];
    let payload: Record<string, unknown> = {};

    if (dto.format === 'markdown' || dto.markdown) {
      const md = dto.markdown || '';
      const titleMatch = md.match(/^#\s+(.+)$/m);
      payload = {
        siteKey: dto.channel === 'RETAIL' ? 'retail' : 'wholesale',
        title: titleMatch?.[1]?.trim() || 'مقاله واردشده',
        content: md,
        contentFormat: 'MARKDOWN',
        excerpt: md.replace(/^#.*$/m, '').trim().slice(0, 200),
      };
    } else if (dto.article) {
      payload = dto.article;
    } else {
      throw new BadRequestException('محتوای import خالی است');
    }

    const siteKey = String(payload.siteKey || dto.channel || 'wholesale').toLowerCase();
    const channel = siteKey === 'retail' ? 'RETAIL' : 'WHOLESALE';
    const title = String(payload.title || '').trim();
    const content = String(payload.content || '').trim();
    if (title.length < 5) errors.push({ field: 'title', message: 'عنوان حداقل ۵ کاراکتر' });
    if (content.length < 20) errors.push({ field: 'content', message: 'محتوا خیلی کوتاه است' });

    const seo = (payload.seo || {}) as Record<string, unknown>;
    const faqItems = Array.isArray(payload.faqItems) ? payload.faqItems : [];

    if (errors.length) {
      throw new BadRequestException({ message: 'اعتبارسنجی import ناموفق', errors });
    }

    let categoryId: string | undefined;
    const categorySlug = payload.categorySlug ? String(payload.categorySlug) : undefined;
    if (categorySlug) {
      const cat = await this.catRepo.findOne({ where: { channel, slug: categorySlug } });
      categoryId = cat?.id;
    }

    const tags = Array.isArray(payload.tags)
      ? (payload.tags as string[])
      : [];

    return this.create(
      {
        channel,
        title,
        slug: payload.slug ? String(payload.slug) : undefined,
        excerpt: payload.excerpt ? String(payload.excerpt) : undefined,
        content,
        contentFormat: (payload.contentFormat as any) || 'MARKDOWN',
        categoryId,
        tags,
        status: 'DRAFT',
        seoTitle: seo.seoTitle ? String(seo.seoTitle) : undefined,
        seoDescription: seo.metaDescription ? String(seo.metaDescription) : undefined,
        focusKeyword: seo.focusKeyword ? String(seo.focusKeyword) : undefined,
        secondaryKeywords: Array.isArray(seo.secondaryKeywords)
          ? (seo.secondaryKeywords as string[])
          : undefined,
        searchIntent: seo.searchIntent ? String(seo.searchIntent) : undefined,
        canonicalType: seo.canonicalType ? String(seo.canonicalType) : 'SELF',
        robotsIndex: seo.robotsIndex !== false,
        robotsFollow: seo.robotsFollow !== false,
        maxImagePreview: seo.maxImagePreview ? String(seo.maxImagePreview) : 'large',
        faqItems: faqItems as any,
        tableOfContentsEnabled: payload.tableOfContentsEnabled !== false,
        sitemapEnabled: payload.sitemapEnabled !== false,
        sitemapPriority: typeof payload.sitemapPriority === 'number' ? payload.sitemapPriority : 0.6,
        rssEnabled: payload.rssEnabled !== false,
        relatedProductIds: Array.isArray(payload.relatedProductIds)
          ? (payload.relatedProductIds as string[])
          : undefined,
        relatedArticleIds: Array.isArray(payload.relatedArticleIds)
          ? (payload.relatedArticleIds as string[])
          : undefined,
      },
      actor,
    );
  }

  // ── Categories / Tags ─────────────────────────────────────

  async listCategories(channel?: string) {
    const where: any = { isActive: true };
    if (channel) where.channel = normalizeChannel(channel);
    return this.catRepo.find({ where, order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  /** Legacy string categories for public filter chips */
  async categories(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('p')
      .select('DISTINCT p.category', 'category')
      .where("p.status = 'PUBLISHED'")
      .getRawMany();
    return rows.map((r) => r.category).filter(Boolean);
  }

  async createCategory(dto: CreateCategoryDto, actor?: Actor) {
    const channel = normalizeChannel(dto.channel);
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const exists = await this.catRepo.findOne({ where: { channel, slug }, withDeleted: true });
    if (exists) throw new ConflictException('اسلاگ دسته تکراری است');
    const saved = await this.catRepo.save(
      this.catRepo.create({
        ...dto,
        channel,
        slug,
        robotsIndex: dto.robotsIndex ?? true,
        robotsFollow: dto.robotsFollow ?? true,
      }),
    );
    await this.audit({
      action: 'blog.category.create',
      channel,
      entityType: 'blog_category',
      entityId: saved.id,
      actorId: actor?.id,
    });
    return saved;
  }

  async updateCategory(id: string, dto: Partial<CreateCategoryDto>, actor?: Actor) {
    const cat = await this.catRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('دسته یافت نشد');
    if (dto.slug) dto.slug = slugify(dto.slug);
    if (dto.channel) dto.channel = normalizeChannel(dto.channel);
    Object.assign(cat, dto);
    const saved = await this.catRepo.save(cat);
    await this.audit({
      action: 'blog.category.update',
      channel: saved.channel,
      entityType: 'blog_category',
      entityId: id,
      actorId: actor?.id,
    });
    return saved;
  }

  async removeCategory(id: string, actor?: Actor) {
    await this.catRepo.softDelete(id);
    await this.audit({
      action: 'blog.category.delete',
      entityType: 'blog_category',
      entityId: id,
      actorId: actor?.id,
    });
    return { deleted: true };
  }

  async listTags(channel?: string) {
    const where: any = {};
    if (channel) where.channel = normalizeChannel(channel);
    return this.tagRepo.find({ where, order: { name: 'ASC' } });
  }

  /** Ensure free-text post tags exist as blog_tags rows for public /blog/tag/{slug}. */
  async syncTagsFromNames(channel: string, names: string[], actor?: Actor) {
    const ch = normalizeChannel(channel);
    const cleaned = (names || [])
      .map((n) => String(n || '').trim())
      .filter((n) => n.length >= 2);
    const out = [];
    for (const name of cleaned) {
      const slug = slugify(name);
      let tag = await this.tagRepo.findOne({ where: { channel: ch, slug } });
      if (!tag) {
        tag = await this.tagRepo.save(
          this.tagRepo.create({
            channel: ch,
            name,
            slug,
            robotsIndex: true,
            robotsFollow: true,
          }),
        );
        await this.audit({
          action: 'blog.tag.auto_create',
          channel: ch,
          entityType: 'blog_tag',
          entityId: tag.id,
          actorId: actor?.id,
          meta: { name },
        });
      }
      out.push(tag);
    }
    return out;
  }

  async createTag(dto: CreateTagDto, actor?: Actor) {
    const channel = normalizeChannel(dto.channel);
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const exists = await this.tagRepo.findOne({ where: { channel, slug }, withDeleted: true });
    if (exists) throw new ConflictException('اسلاگ تگ تکراری است');
    const saved = await this.tagRepo.save(
      this.tagRepo.create({
        ...dto,
        channel,
        slug,
        robotsIndex: dto.robotsIndex ?? false,
      }),
    );
    await this.audit({
      action: 'blog.tag.create',
      channel,
      entityType: 'blog_tag',
      entityId: saved.id,
      actorId: actor?.id,
    });
    return saved;
  }

  async updateTag(id: string, dto: Partial<CreateTagDto>, actor?: Actor) {
    const tag = await this.tagRepo.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('تگ یافت نشد');
    if (dto.slug) dto.slug = slugify(dto.slug);
    Object.assign(tag, dto);
    return this.tagRepo.save(tag);
  }

  async removeTag(id: string) {
    await this.tagRepo.softDelete(id);
    return { deleted: true };
  }

  // ── Redirects ─────────────────────────────────────────────

  async listRedirects(channel?: string) {
    const where: any = {};
    if (channel) where.channel = normalizeChannel(channel);
    return this.redirectRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async createRedirect(dto: CreateRedirectDto, actor?: Actor) {
    const channel = normalizeChannel(dto.channel);
    const sourcePath = dto.sourcePath.startsWith('/') ? dto.sourcePath : `/${dto.sourcePath}`;
    const statusCode = dto.statusCode || 301;
    const destinationUrl =
      statusCode === 410 ? dto.destinationUrl || 'gone:410' : dto.destinationUrl || '';
    if (statusCode !== 410 && !destinationUrl) {
      throw new BadRequestException('مقصد ریدایرکت لازم است');
    }
    const existing = await this.redirectRepo.find({ where: { channel, isActive: true } });
    if (
      statusCode !== 410 &&
      wouldCreateRedirectLoop(
        existing.map((r) => ({
          sourcePath: r.sourcePath,
          destinationUrl: r.destinationUrl,
          isActive: r.isActive,
        })),
        sourcePath,
        destinationUrl,
        this.siteOrigin(channel),
      )
    ) {
      throw new BadRequestException('ریدایرکت باعث حلقه می‌شود');
    }
    const saved = await this.redirectRepo.save(
      this.redirectRepo.create({
        channel,
        sourcePath,
        destinationUrl,
        statusCode,
        reason: dto.reason || (statusCode === 410 ? 'GONE' : 'MANUAL'),
        createdBy: actor?.id || null,
      }),
    );
    await this.audit({
      action: 'seo.redirect.create',
      channel,
      entityType: 'seo_redirect',
      entityId: saved.id,
      actorId: actor?.id,
    });
    return saved;
  }

  async updateRedirect(id: string, dto: Partial<CreateRedirectDto> & { isActive?: boolean }) {
    const row = await this.redirectRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('ریدایرکت یافت نشد');
    Object.assign(row, dto);
    return this.redirectRepo.save(row);
  }

  async removeRedirect(id: string) {
    await this.redirectRepo.delete(id);
    return { deleted: true };
  }

  async matchRedirect(channel: string, path: string) {
    const sourcePath = path.startsWith('/') ? path : `/${path}`;
    const row = await this.redirectRepo.findOne({
      where: { channel: normalizeChannel(channel), sourcePath, isActive: true },
    });
    if (!row) return null;
    row.hitCount = (row.hitCount || 0) + 1;
    row.lastHitAt = new Date();
    await this.redirectRepo.save(row).catch(() => undefined);
    return row;
  }

  async exportArticle(id: string) {
    const post = await this.findOneAdmin(id);
    return {
      format: 'taranom-blog-export-v1',
      exportedAt: new Date().toISOString(),
      article: {
        channel: post.channel,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        contentFormat: post.contentFormat,
        category: post.category,
        categoryId: post.categoryId,
        tags: post.tags,
        coverImage: post.coverImage,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        focusKeyword: post.focusKeyword,
        secondaryKeywords: post.secondaryKeywords,
        searchIntent: post.searchIntent,
        faqItems: post.faqItems,
        primaryCta: post.primaryCta,
        relatedProductIds: post.relatedProductIds,
        relatedArticleIds: post.relatedArticleIds,
        howToData: post.howToData,
        authorName: post.authorName,
        status: 'DRAFT',
      },
    };
  }

  async getCategoryBySlug(slug: string, channel?: string) {
    const where: any = { slug, isActive: true };
    if (channel) where.channel = normalizeChannel(channel);
    const cat = await this.catRepo.findOne({ where });
    if (!cat) throw new NotFoundException('دسته یافت نشد');
    return cat;
  }

  async getTagBySlug(slug: string, channel?: string) {
    const where: any = { slug };
    if (channel) where.channel = normalizeChannel(channel);
    const tag = await this.tagRepo.findOne({ where });
    if (!tag) throw new NotFoundException('برچسب یافت نشد');
    return tag;
  }

  async upsertAuthor(
    data: Partial<BlogAuthorEntity> & { displayName: string; userId?: string },
    actor?: Actor,
  ) {
    const userId = data.userId || actor?.id || randomUUID();
    let row = data.userId
      ? await this.authorRepo.findOne({ where: { userId: data.userId } })
      : null;
    if (!row && data.slug) {
      row = await this.authorRepo.findOne({ where: { slug: slugify(data.slug) } });
    }
    const slug = data.slug ? slugify(data.slug) : slugify(data.displayName);
    if (row) {
      Object.assign(row, data, { slug, userId: row.userId });
    } else {
      row = this.authorRepo.create({
        ...data,
        userId,
        slug,
        bio: data.bio || '',
        authorPageEnabled: data.authorPageEnabled !== false,
        robotsIndex: data.robotsIndex !== false,
      });
    }
    const saved = await this.authorRepo.save(row);
    await this.audit({
      action: 'blog.author.upsert',
      entityType: 'blog_author',
      entityId: saved.id,
      actorId: actor?.id,
    });
    return saved;
  }

  async removeAuthor(id: string) {
    await this.authorRepo.softDelete(id);
    return { deleted: true };
  }

  async updateAuthorById(
    id: string,
    data: Partial<BlogAuthorEntity> & { displayName?: string },
    actor?: Actor,
  ) {
    const row = await this.authorRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('نویسنده یافت نشد');
    if (data.slug) data.slug = slugify(data.slug);
    else if (data.displayName) data.slug = slugify(data.displayName);
    Object.assign(row, data);
    const saved = await this.authorRepo.save(row);
    await this.audit({
      action: 'blog.author.update',
      entityType: 'blog_author',
      entityId: saved.id,
      actorId: actor?.id,
    });
    return saved;
  }

  // ── Settings / seed ───────────────────────────────────────

  async getSettings(channel: string) {
    const ch = normalizeChannel(channel);
    let row = await this.settingsRepo.findOne({ where: { channel: ch } });
    if (!row) {
      row = await this.settingsRepo.save(
        this.settingsRepo.create({
          channel: ch,
          blogTitle: ch === 'RETAIL' ? 'وبلاگ فروشگاه ترنم' : 'وبلاگ عمده‌فروشی ترنم',
        }),
      );
    }
    return row;
  }

  async updateSettings(channel: string, data: Partial<BlogSettingsEntity>, actor?: Actor) {
    const row = await this.getSettings(channel);
    Object.assign(row, data);
    const saved = await this.settingsRepo.save(row);
    await this.audit({
      action: 'blog.settings.update',
      channel: saved.channel,
      entityType: 'blog_settings',
      entityId: saved.id,
      actorId: actor?.id,
    });
    return saved;
  }

  async ensureSeedCategories() {
    for (const [channel, names] of [
      ['RETAIL', RETAIL_SEED],
      ['WHOLESALE', WHOLESALE_SEED],
    ] as const) {
      const count = await this.catRepo.count({ where: { channel } });
      if (count > 0) continue;
      let order = 0;
      for (const name of names) {
        await this.catRepo.save(
          this.catRepo.create({
            channel,
            name,
            slug: slugify(name),
            sortOrder: order++,
            isActive: true,
          }),
        );
      }
    }
    return { seeded: true };
  }

  async listAuthors() {
    return this.authorRepo.find({ order: { displayName: 'ASC' } });
  }

  async publishDueScheduled() {
    const now = new Date();
    const due = await this.repo.find({
      where: { status: 'SCHEDULED' },
    });
    const toPublish = due.filter((p) => p.publishAt && p.publishAt <= now);
    for (const p of toPublish) {
      p.status = 'PUBLISHED';
      p.publishedAt = p.publishedAt || now;
      await this.repo.save(p);
      await this.audit({
        action: 'blog.post.auto_publish',
        channel: p.channel,
        entityType: 'blog_post',
        entityId: p.id,
      });
    }
    return { published: toPublish.length };
  }

  async sitemapPosts(channel: string) {
    const ch = normalizeChannel(channel);
    return this.repo.find({
      where: {
        channel: ch,
        status: 'PUBLISHED',
        robotsIndex: true,
        sitemapEnabled: true,
      },
      select: ['slug', 'updatedAt', 'publishedAt', 'sitemapPriority', 'sitemapChangeFrequency'],
      order: { publishedAt: 'DESC' },
      take: 500,
    });
  }
}
