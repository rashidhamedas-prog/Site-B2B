import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, ILike, In } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductVariantEntity } from './entities/product-variant.entity';
import { CategoryEntity } from '../category/entities/category.entity';
import { VariantColorEntity } from './entities/variant-color.entity';
import { VariantSizeEntity } from './entities/variant-size.entity';
import { ProductSpecMemoryEntity } from './entities/product-spec-memory.entity';
import {
  ProductSizeType,
  ProductSpecs,
  SIZE_GUIDE,
  SPEC_FIELD_KEYS,
} from './entities/product-specs';
import { StorageService } from '../upload/storage.service';
import { SearchService } from '../search/search.service';
import { SettingsService } from '../settings/settings.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { ProductRelatedEntity } from './entities/product-related.entity';
import { SeoRedirectEntity } from '../blog/entities/seo-redirect.entity';
import { sanitizeBlogHtml } from '../blog/blog-sanitize';
import { normalizePublicSlug } from '../../common/public-slug';
import { buildProductWorkbook, parseExportChannel, type ExportProduct } from './catalog-excel';
import { changeProductSlug, type SalesChannel as SlugChannel } from './product-slug-redirect';
import { computePackQty, sizesForSizeType } from './product-pack';
import {
  generateChannelContent,
  type ProductContentInput,
} from './product-content';
import { fillRelatedIds, MAX_RELATED_PRODUCTS, sortRelatedCandidates } from './product-related-fill';
import {
  applyChannelSalePrices,
  derivedIsDiscounted,
  GLOBAL_MIN_ORDER_QTY,
  normalizeMinOrderQty,
  resolveChannelSale,
  type DiscountType,
} from './product-sale';

type BadgeConfig = { limitedStockMultiplier: number; newBadgeDays: number };

export type ProductChannelPriceInput = {
  wholesalePrice?: unknown;
  retailPrice?: unknown;
  wholesaleCompareAtPrice?: unknown;
  retailCompareAtPrice?: unknown;
  /** Defaults true (create). When false, retailPrice may be null. */
  showOnRetail?: boolean;
  /**
   * Defaults true. Display gating only — DB column wholesalePrice is NOT NULL,
   * so a positive wholesale final is always required regardless of this flag.
   */
  showOnWholesale?: boolean;
};

export type ProductChannelPrices = {
  wholesalePrice: number;
  retailPrice: number | null;
  wholesaleCompareAtPrice: number | null;
  retailCompareAtPrice: number | null;
};

/**
 * Parse IRR money: null/'' → null; reject NaN/negative/non-integer/unsafe-huge.
 * Zero is syntactically parseable; channel finals still require > 0 below.
 */
function parseIrr(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'bigint') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new BadRequestException('مبلغ ریالی نامعتبر است');
    }
    if (n > Number.MAX_SAFE_INTEGER) {
      throw new BadRequestException('مبلغ خارج از محدوده امن Number است');
    }
    return n;
  }
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new BadRequestException('مبلغ ریالی باید عدد صحیح غیرمنفی (ریال) باشد');
  }
  // Guard unsafe JS precision for money beyond Number.MAX_SAFE_INTEGER
  if (n > Number.MAX_SAFE_INTEGER) {
    throw new BadRequestException('مبلغ خارج از محدوده امن Number است');
  }
  return n;
}

/**
 * HIGH-5 channel pricing invariant (create + update):
 * - wholesalePrice / retailPrice = FINAL transaction prices (after discount)
 * - compare-at optional; when set must be STRICTLY greater than that channel's final
 * - showOnRetail true (default): retailPrice required, positive (> 0)
 * - showOnRetail false: retailPrice may be null (clearing final only allowed off-channel)
 * - wholesalePrice always required positive (> 0) — DB column is NOT NULL;
 *   showOnWholesale only gates storefront display, not column nullability
 * - zero / negative / NaN / > MAX_SAFE_INTEGER rejected
 */
export function normalizeProductChannelPrices(
  input: ProductChannelPriceInput
): ProductChannelPrices {
  const showOnRetail = input.showOnRetail !== false;

  const wholesalePrice = parseIrr(input.wholesalePrice);
  if (wholesalePrice === null || wholesalePrice <= 0) {
    throw new BadRequestException('قیمت نهایی عمده الزامی است و باید مثبت باشد');
  }

  const retailPrice = parseIrr(input.retailPrice);
  if (showOnRetail) {
    if (retailPrice === null || retailPrice <= 0) {
      throw new BadRequestException(
        'قیمت نهایی تکی برای نمایش در فروشگاه تکی الزامی است و باید مثبت باشد'
      );
    }
  } else if (retailPrice !== null && retailPrice <= 0) {
    throw new BadRequestException('قیمت نهایی تکی در صورت ارسال باید مثبت باشد');
  }

  const wholesaleCompareAtPrice = parseIrr(input.wholesaleCompareAtPrice);
  const retailCompareAtPrice = parseIrr(input.retailCompareAtPrice);

  if (wholesaleCompareAtPrice !== null && wholesaleCompareAtPrice <= wholesalePrice) {
    throw new BadRequestException('قیمت قبل از تخفیف عمده باید از قیمت نهایی بیشتر باشد');
  }
  if (retailCompareAtPrice !== null) {
    if (retailPrice === null) {
      throw new BadRequestException('قیمت قبل از تخفیف تکی بدون قیمت نهایی معتبر نیست');
    }
    if (retailCompareAtPrice <= retailPrice) {
      throw new BadRequestException('قیمت قبل از تخفیف تکی باید از قیمت نهایی بیشتر باشد');
    }
  }

  return {
    wholesalePrice,
    retailPrice,
    wholesaleCompareAtPrice,
    retailCompareAtPrice,
  };
}

@Injectable()
export class ProductService {
  private badgeCache: { value: BadgeConfig; at: number } | null = null;
  private static readonly BADGE_TTL_MS = 30_000;

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variantRepo: Repository<ProductVariantEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
    @InjectRepository(VariantColorEntity)
    private readonly colorRepo: Repository<VariantColorEntity>,
    @InjectRepository(VariantSizeEntity)
    private readonly sizeRepo: Repository<VariantSizeEntity>,
    @InjectRepository(ProductSpecMemoryEntity)
    private readonly specMemoryRepo: Repository<ProductSpecMemoryEntity>,
    @InjectRepository(ProductRelatedEntity)
    private readonly relatedRepo: Repository<ProductRelatedEntity>,
    @InjectRepository(SeoRedirectEntity)
    private readonly redirectRepo: Repository<SeoRedirectEntity>,
    private readonly storage: StorageService,
    private readonly search: SearchService,
    private readonly settings: SettingsService
  ) {}

  private fabricFromSpecs(specs?: ProductSpecs | null, fallback?: string): string {
    return (specs?.fabricType || fallback || '').trim();
  }

  private async badgeConfig(): Promise<BadgeConfig> {
    if (this.badgeCache && Date.now() - this.badgeCache.at < ProductService.BADGE_TTL_MS) {
      return this.badgeCache.value;
    }
    const business = await this.settings.business();
    const value: BadgeConfig = {
      limitedStockMultiplier: Math.max(1, Number(business.limitedStockMultiplier) || 2),
      newBadgeDays: Math.max(1, Number(business.newBadgeDays) || 7),
    };
    this.badgeCache = { value, at: Date.now() };
    return value;
  }

  private withBadges<T extends ProductEntity>(product: T, channel?: string, cfg?: BadgeConfig) {
    const isRetail = String(channel || '').toUpperCase() === 'RETAIL';
    const wholesaleStock = Number(product.wholesaleStock) || Number(product.stock) || 0;
    const retailStock = Number(product.retailStock) || 0;
    const stock = isRetail ? retailStock : wholesaleStock;
    const minOrder = Math.max(1, Number(product.minOrderQty) || 1);
    const multiplier = Math.max(1, cfg?.limitedStockMultiplier ?? 2);
    const newBadgeDays = Math.max(1, cfg?.newBadgeDays ?? 7);
    const newBadgeMs = newBadgeDays * 24 * 60 * 60 * 1000;
    const createdAt = product.createdAt ? new Date(product.createdAt).getTime() : 0;
    const isNewAuto = createdAt > 0 && Date.now() - createdAt < newBadgeMs;
    const isLimitedStock = stock > 0 && stock <= minOrder * multiplier;
    const sizeType = (product.sizeType || 'FREE') as ProductSizeType;
    const sale = resolveChannelSale(product, isRetail ? 'RETAIL' : 'WHOLESALE');
    const packQty = computePackQty(
      (product.variants ?? []).map((v) => v.color),
      sizeType,
    );
    const fullContent = isRetail
      ? product.retailFullContent || product.description
      : product.wholesaleFullContent || product.description;
    const variants = (product.variants ?? []).map((v) => {
      const vWholesale = Number(v.wholesaleStock) || Number(v.stock) || 0;
      const vRetail = Number(v.retailStock) || 0;
      return {
        ...v,
        stock: isRetail ? vRetail : vWholesale,
        wholesaleStock: vWholesale,
        retailStock: vRetail,
      };
    });
    return {
      ...product,
      stock,
      wholesaleStock,
      retailStock,
      showOnWholesale: product.showOnWholesale !== false,
      showOnRetail: product.showOnRetail !== false,
      variants,
      fabric: this.fabricFromSpecs(product.specs, product.fabric),
      isNew: isNewAuto,
      isFeatured: derivedIsDiscounted(product),
      isDiscounted: channel ? sale.active : derivedIsDiscounted(product),
      wholesaleIsDiscounted: product.wholesaleIsDiscounted ?? null,
      retailIsDiscounted: product.retailIsDiscounted ?? null,
      sale,
      fullContent,
      packQty,
      minOrderQty: minOrder,
      isLimitedStock,
      totalStock: stock,
      sizeGuide: SIZE_GUIDE[sizeType] ?? SIZE_GUIDE.FREE,
      channel: isRetail ? 'RETAIL' : 'WHOLESALE',
      badgeSettings: { limitedStockMultiplier: multiplier, newBadgeDays },
    };
  }

  private async rememberSpecs(specs?: ProductSpecs | null) {
    if (!specs) return;
    const entries: Array<{ fieldKey: string; value: string }> = [];
    for (const key of SPEC_FIELD_KEYS) {
      const val = String((specs as any)[key] ?? '').trim();
      if (val) entries.push({ fieldKey: key, value: val });
    }
    for (const cf of specs.customFields ?? []) {
      const label = String(cf?.label ?? '').trim();
      const value = String(cf?.value ?? '').trim();
      if (label && value) {
        entries.push({ fieldKey: `custom:${label}`, value });
        entries.push({ fieldKey: 'customLabel', value: label });
      }
    }
    for (const e of entries) {
      try {
        const existing = await this.specMemoryRepo.findOne({
          where: { fieldKey: e.fieldKey, value: e.value },
        });
        if (!existing) {
          await this.specMemoryRepo.save(this.specMemoryRepo.create(e));
        }
      } catch {
        // unique race — ignore
      }
    }
  }

  private async syncSearch(product: ProductEntity) {
    const cfg = await this.badgeConfig();
    const newBadgeMs = cfg.newBadgeDays * 24 * 60 * 60 * 1000;
    await this.search.indexProduct({
      id: product.id,
      sku: product.sku,
      name: product.name,
      fabric: this.fabricFromSpecs(product.specs, product.fabric),
      description: product.description,
      status: product.status,
      isFeatured: !!product.isDiscounted,
      isNew: product.createdAt
        ? Date.now() - new Date(product.createdAt).getTime() < newBadgeMs
        : false,
    });
  }

  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    fabric?: string,
    status?: string,
    color?: string,
    size?: string,
    opts?: {
      categoryId?: string;
      collectionId?: string;
      minPrice?: number;
      maxPrice?: number;
      collar?: string;
      relatedTo?: string;
      categorySlug?: string;
      garmentSize?: string;
      channel?: string;
      sort?: string;
      /** When false (default for storefront), skip loading variants to cut payload/TTFB */
      includeVariants?: boolean;
    }
  ) {
    const statusFilter = status ?? 'ACTIVE';
    const sizeType = (size && ['FREE', 'TWO', 'THREE'].includes(size) ? size : undefined) as
      ProductSizeType | undefined;
    const garmentSize = opts?.garmentSize || (size && !sizeType ? size : undefined);

    let related: ProductEntity | null = null;
    let relatedIds: string[] | null = null;
    if (opts?.relatedTo) {
      related =
        (await this.productRepo.findOne({ where: { id: opts.relatedTo } })) ||
        (await this.productRepo.findOne({ where: { slug: opts.relatedTo } }));
      if (related) {
        const links = await this.relatedRepo.find({
          where: { productId: related.id },
          order: { sortOrder: 'ASC' },
          take: MAX_RELATED_PRODUCTS,
        });
        if (links.length) relatedIds = links.map((l) => l.relatedProductId);
      }
    }

    let categoryId = opts?.categoryId || (!relatedIds ? related?.categoryId : undefined);
    if (opts?.categorySlug) {
      const cat = await this.categoryRepo.findOne({
        where: { slug: String(opts.categorySlug).trim().toLowerCase() },
      });
      if (cat) categoryId = cat.id;
    }

    // Admin list (status=ALL) needs variants for stock/color counts; storefront cards do not.
    const wantVariants = opts?.includeVariants === true || status === 'ALL';

    const qb = this.productRepo.createQueryBuilder('p').where('p.deletedAt IS NULL');
    if (wantVariants) {
      qb.leftJoinAndSelect('p.variants', 'v');
    }

    if (status !== 'ALL') qb.andWhere('p.status = :status', { status: statusFilter });
    const channel = String(opts?.channel || '').toUpperCase();
    if (channel === 'RETAIL') {
      qb.andWhere('p.showOnRetail = true');
    } else if (channel === 'WHOLESALE') {
      qb.andWhere('p.showOnWholesale = true');
    }
    if (sizeType) qb.andWhere('p.sizeType = :sizeType', { sizeType });
    if (relatedIds?.length) {
      qb.andWhere('p.id IN (:...relatedIds)', { relatedIds });
    } else if (categoryId) {
      qb.andWhere('p.categoryId = :categoryId', { categoryId });
    }
    if (opts?.collectionId) {
      qb.andWhere('p.collectionId = :collectionId', { collectionId: opts.collectionId });
    }
    if (fabric) {
      qb.andWhere("(p.fabric ILIKE :fabric OR p.specs->>'fabricType' ILIKE :fabric)", {
        fabric: `%${fabric}%`,
      });
    }
    if (opts?.collar) {
      qb.andWhere("p.specs->>'collarModel' ILIKE :collar", { collar: `%${opts.collar}%` });
    }
    if (opts?.minPrice != null && Number.isFinite(opts.minPrice)) {
      qb.andWhere('COALESCE(p.retailPrice, p.wholesalePrice) >= :minPrice', {
        minPrice: opts.minPrice,
      });
    }
    if (opts?.maxPrice != null && Number.isFinite(opts.maxPrice)) {
      qb.andWhere('COALESCE(p.retailPrice, p.wholesalePrice) <= :maxPrice', {
        maxPrice: opts.maxPrice,
      });
    }
    if (search?.trim()) {
      qb.andWhere('(p.name ILIKE :q OR p.sku ILIKE :q OR p.fabric ILIKE :q)', {
        q: `%${search.trim()}%`,
      });
    }
    if (related && !relatedIds?.length) {
      qb.andWhere('p.id != :rid', { rid: related.id });
      if (related.fabric) {
        qb.andWhere("(p.fabric ILIKE :rf OR p.specs->>'fabricType' ILIKE :rf)", {
          rf: `%${related.fabric}%`,
        });
      }
    }
    if (color || garmentSize) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM product_variants vv
          WHERE vv."productId" = p.id
          ${color ? 'AND vv.color ILIKE :vcolor' : ''}
          ${garmentSize ? 'AND vv.size ILIKE :vsize' : ''}
        )`,
        {
          ...(color ? { vcolor: `%${color}%` } : {}),
          ...(garmentSize ? { vsize: `%${garmentSize}%` } : {}),
        }
      );
    }

    const sort = String(opts?.sort || '').toLowerCase();
    if (sort === 'views') {
      qb.orderBy('p.viewCount', 'DESC').addOrderBy('p.createdAt', 'DESC');
    } else if (sort === 'newest') {
      qb.orderBy('p.createdAt', 'DESC');
    } else {
      // default: discounted then newest
      qb.orderBy('p.isDiscounted', 'DESC').addOrderBy('p.createdAt', 'DESC');
    }
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    const cfg = await this.badgeConfig();
    return {
      data: data.map((p) => this.withBadges(p, channel || undefined, cfg)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async incrementView(idOrSlug: string) {
    const product =
      (await this.productRepo.findOne({ where: { id: idOrSlug } })) ||
      (await this.productRepo.findOne({ where: { slug: idOrSlug } }));
    if (!product) throw new NotFoundException('محصول یافت نشد');
    await this.productRepo.increment({ id: product.id }, 'viewCount', 1);
    const updated = await this.productRepo.findOne({ where: { id: product.id } });
    return { id: product.id, viewCount: updated?.viewCount ?? product.viewCount + 1 };
  }

  async findComingSoon(limit = 12, channel?: string) {
    const data = await this.productRepo.find({
      where: [{ status: 'COMING_SOON' }, { isPreOrder: true, status: 'ACTIVE' }],
      relations: ['variants'],
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 48),
    });
    const ch = String(channel || '').toUpperCase();
    const filtered = data.filter((p) => {
      if (ch === 'RETAIL') return p.showOnRetail !== false;
      if (ch === 'WHOLESALE') return p.showOnWholesale !== false;
      return true;
    });
    const cfg = await this.badgeConfig();
    return filtered.map((p) => this.withBadges(p, ch || undefined, cfg));
  }

  async listSpecMemory(fieldKey?: string) {
    const where = fieldKey ? { fieldKey } : {};
    const rows = await this.specMemoryRepo.find({
      where,
      order: { updatedAt: 'DESC' },
      take: 200,
    });
    if (fieldKey) return rows.map((r) => r.value);
    const grouped: Record<string, string[]> = {};
    for (const r of rows) {
      if (!grouped[r.fieldKey]) grouped[r.fieldKey] = [];
      if (!grouped[r.fieldKey].includes(r.value)) grouped[r.fieldKey].push(r.value);
    }
    return grouped;
  }

  async deleteSpecMemory(opts: { fieldKey?: string; value?: string; id?: string }) {
    if (opts.id) {
      const row = await this.specMemoryRepo.findOne({ where: { id: opts.id } });
      if (!row) throw new NotFoundException('مقدار حافظه یافت نشد');
      await this.specMemoryRepo.remove(row);
      return { deleted: true };
    }
    const fieldKey = String(opts.fieldKey ?? '').trim();
    const value = String(opts.value ?? '').trim();
    if (!fieldKey || !value) {
      throw new BadRequestException('fieldKey و value الزامی است');
    }
    const row = await this.specMemoryRepo.findOne({ where: { fieldKey, value } });
    if (!row) throw new NotFoundException('مقدار حافظه یافت نشد');
    await this.specMemoryRepo.remove(row);
    return { deleted: true };
  }

  async listColors() {
    return this.colorRepo.find({ order: { updatedAt: 'DESC' }, take: 200 });
  }

  async createColor(data: { name: string; hex?: string }) {
    const name = String(data.name ?? '').trim();
    if (!name) throw new BadRequestException('نام رنگ الزامی است');
    const hex = data.hex ? String(data.hex).trim() : null;
    const existing = await this.colorRepo.findOne({ where: { name } });
    if (existing) {
      if (hex && existing.hex !== hex) {
        existing.hex = hex;
        return this.colorRepo.save(existing);
      }
      return existing;
    }
    return this.colorRepo.save(this.colorRepo.create({ name, hex }));
  }

  async updateColor(id: string, data: { name?: string; hex?: string }) {
    const color = await this.colorRepo.findOne({ where: { id } });
    if (!color) throw new NotFoundException('رنگ یافت نشد');
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) throw new BadRequestException('نام رنگ الزامی است');
      const clash = await this.colorRepo.findOne({ where: { name } });
      if (clash && clash.id !== id) throw new BadRequestException('رنگ با این نام قبلاً ثبت شده');
      color.name = name;
    }
    if (data.hex !== undefined) color.hex = String(data.hex).trim() || null;
    return this.colorRepo.save(color);
  }

  async deleteColor(id: string) {
    const color = await this.colorRepo.findOne({ where: { id } });
    if (!color) throw new NotFoundException('رنگ یافت نشد');
    await this.colorRepo.remove(color);
    return { deleted: true };
  }

  private async attachRelated<T>(
    product: ProductEntity,
    payload: T,
    channel?: string,
    cfg?: BadgeConfig,
  ) {
    const links = await this.relatedRepo.find({
      where: { productId: product.id },
      order: { sortOrder: 'ASC' },
      take: MAX_RELATED_PRODUCTS,
    });
    if (!links.length) return { ...payload, relatedProducts: [] };
    const ids = links.map((l) => l.relatedProductId);
    const related = await this.productRepo.find({
      where: { id: In(ids) },
      relations: ['variants'],
    });
    const order = new Map(ids.map((id, i) => [id, i]));
    related.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
    const ch = String(channel || '').toUpperCase();
    const visible = related.filter((item) => {
      if (item.status && item.status !== 'ACTIVE') return ch !== 'RETAIL' && ch !== 'WHOLESALE';
      if (ch === 'RETAIL') return item.showOnRetail !== false;
      if (ch === 'WHOLESALE') return item.showOnWholesale !== false;
      return true;
    });
    return {
      ...payload,
      relatedProducts: visible.map((item) => this.withBadges(item, channel, cfg)),
    };
  }

  async replaceRelated(productId: string, ids: string[] | undefined) {
    if (!ids) return;
    const unique = [...new Set(ids.map(String).filter((id) => id && id !== productId))].slice(
      0,
      MAX_RELATED_PRODUCTS,
    );
    if (unique.length) {
      const found = await this.productRepo.count({ where: { id: In(unique) } });
      if (found !== unique.length) {
        throw new BadRequestException('یکی از محصولات مرتبط نامعتبر است');
      }
    }
    await this.relatedRepo.delete({ productId });
    if (!unique.length) return [];
    return this.relatedRepo.save(
      unique.map((relatedProductId, sortOrder) =>
        this.relatedRepo.create({ productId, relatedProductId, sortOrder }),
      ),
    );
  }

  private async changeSlugInTransaction(productId: string, nextRaw: string) {
    await this.productRepo.manager.transaction(async (em) => {
      const productRepo = em.getRepository(ProductEntity);
      const redirectRepo = em.getRepository(SeoRedirectEntity);
      await changeProductSlug(
        {
          async lockProduct() {
            const row = await productRepo
              .createQueryBuilder('p')
              .setLock('pessimistic_write')
              .where('p.id = :id', { id: productId })
              .getOne();
            if (!row) throw new NotFoundException('محصول یافت نشد');
            return { id: row.id, slug: row.slug };
          },
          async slugTaken(slug, excludeId) {
            const clash = await productRepo.findOne({ where: { slug } });
            return !!clash && clash.id !== excludeId;
          },
          async updateProductSlug(id, slug) {
            await productRepo.update(id, { slug });
          },
          async listActiveRedirects() {
            return redirectRepo.find({ where: { isActive: true } });
          },
          async collapseDestination(channel: SlugChannel, oldDest, newDest) {
            await redirectRepo
              .createQueryBuilder()
              .update(SeoRedirectEntity)
              .set({ destinationUrl: newDest })
              .where(`"channel" = :channel AND "destinationUrl" = :src`, {
                channel,
                src: oldDest,
              })
              .execute();
          },
          async upsertRedirect(row) {
            const existing = await redirectRepo.findOne({
              where: { channel: row.channel, sourcePath: row.sourcePath },
            });
            if (existing?.destinationUrl === row.sourcePath) {
              throw new BadRequestException('تغییر slug باعث حلقه ریدایرکت می‌شود');
            }
            if (existing) {
              existing.destinationUrl = row.destinationUrl;
              existing.statusCode = 301;
              existing.reason = 'SLUG_CHANGED';
              existing.autoGenerated = true;
              existing.isActive = true;
              await redirectRepo.save(existing);
              return;
            }
            await redirectRepo.save(
              redirectRepo.create({
                channel: row.channel,
                sourcePath: row.sourcePath,
                destinationUrl: row.destinationUrl,
                statusCode: 301,
                reason: 'SLUG_CHANGED',
                autoGenerated: true,
                isActive: true,
              }),
            );
          },
        },
        nextRaw,
      );
    });
  }

  private applySaleFromDto(
    data: CreateProductDto | UpdateProductDto,
    bases: { wholesalePrice: number; retailPrice: number | null },
  ): {
    prices: ProductChannelPrices;
    flags: Partial<ProductEntity>;
  } {
    const hasChannel =
      data.wholesaleIsDiscounted !== undefined || data.retailIsDiscounted !== undefined;
    if (!hasChannel) {
      return {
        prices: normalizeProductChannelPrices({
          wholesalePrice: bases.wholesalePrice,
          retailPrice: bases.retailPrice,
          wholesaleCompareAtPrice: (data as CreateProductDto).wholesaleCompareAtPrice,
          retailCompareAtPrice: data.retailCompareAtPrice,
          showOnWholesale: data.showOnWholesale,
          showOnRetail: data.showOnRetail,
        }),
        flags: {
          isDiscounted: !!data.isDiscounted,
          isFeatured: !!data.isDiscounted,
          discountType: (data.discountType as DiscountType) || null,
          discountPercent: data.discountPercent ?? null,
          discountAmount: data.discountAmount ?? null,
          discountStartsAt: data.discountStartsAt ? new Date(data.discountStartsAt) : null,
          discountEndsAt: data.discountEndsAt ? new Date(data.discountEndsAt) : null,
        },
      };
    }

    const wholesaleEnabled = !!data.wholesaleIsDiscounted;
    const retailEnabled = !!data.retailIsDiscounted;
    const wholesaleSale = applyChannelSalePrices({
      baseIrr: bases.wholesalePrice,
      enabled: wholesaleEnabled,
      type: data.wholesaleDiscountType ?? data.discountType,
      percent: data.wholesaleDiscountPercent ?? data.discountPercent,
      amountIrr: data.wholesaleDiscountAmount ?? data.discountAmount,
    });
    let retailFinal: number | null = bases.retailPrice;
    let retailCompare: number | null = null;
    if (bases.retailPrice != null && bases.retailPrice > 0) {
      if (retailEnabled) {
        const retailSale = applyChannelSalePrices({
          baseIrr: bases.retailPrice,
          enabled: true,
          type: data.retailDiscountType ?? data.discountType,
          percent: data.retailDiscountPercent ?? data.discountPercent,
          amountIrr: data.retailDiscountAmount ?? data.discountAmount,
        });
        retailFinal = retailSale.final;
        retailCompare = retailSale.compareAt;
      } else {
        retailFinal = bases.retailPrice;
        retailCompare = null;
      }
    }

    const prices = normalizeProductChannelPrices({
      wholesalePrice: wholesaleSale.final,
      retailPrice: retailFinal,
      wholesaleCompareAtPrice: wholesaleSale.compareAt,
      retailCompareAtPrice: retailCompare,
      showOnWholesale: data.showOnWholesale,
      showOnRetail: data.showOnRetail,
    });

    return {
      prices,
      flags: {
        wholesaleIsDiscounted: wholesaleEnabled,
        retailIsDiscounted: retailEnabled,
        isDiscounted: wholesaleEnabled || retailEnabled,
        isFeatured: wholesaleEnabled || retailEnabled,
        wholesaleDiscountType: (data.wholesaleDiscountType as DiscountType) || (data.discountType as DiscountType) || null,
        retailDiscountType: (data.retailDiscountType as DiscountType) || (data.discountType as DiscountType) || null,
        wholesaleDiscountPercent: data.wholesaleDiscountPercent ?? data.discountPercent ?? null,
        retailDiscountPercent: data.retailDiscountPercent ?? data.discountPercent ?? null,
        wholesaleDiscountAmount: data.wholesaleDiscountAmount ?? data.discountAmount ?? null,
        retailDiscountAmount: data.retailDiscountAmount ?? data.discountAmount ?? null,
        wholesaleDiscountStartsAt: data.wholesaleDiscountStartsAt
          ? new Date(data.wholesaleDiscountStartsAt)
          : data.discountStartsAt
            ? new Date(data.discountStartsAt)
            : null,
        retailDiscountStartsAt: data.retailDiscountStartsAt
          ? new Date(data.retailDiscountStartsAt)
          : data.discountStartsAt
            ? new Date(data.discountStartsAt)
            : null,
        wholesaleDiscountEndsAt: data.wholesaleDiscountEndsAt
          ? new Date(data.wholesaleDiscountEndsAt)
          : data.discountEndsAt
            ? new Date(data.discountEndsAt)
            : null,
        retailDiscountEndsAt: data.retailDiscountEndsAt
          ? new Date(data.retailDiscountEndsAt)
          : data.discountEndsAt
            ? new Date(data.discountEndsAt)
            : null,
        discountType: (data.discountType as DiscountType) || (data.wholesaleDiscountType as DiscountType) || (data.retailDiscountType as DiscountType) || null,
        discountPercent: data.discountPercent ?? data.wholesaleDiscountPercent ?? data.retailDiscountPercent ?? null,
        discountAmount: data.discountAmount ?? data.wholesaleDiscountAmount ?? data.retailDiscountAmount ?? null,
        discountStartsAt: data.discountStartsAt
          ? new Date(data.discountStartsAt)
          : data.wholesaleDiscountStartsAt
            ? new Date(data.wholesaleDiscountStartsAt)
            : data.retailDiscountStartsAt
              ? new Date(data.retailDiscountStartsAt)
              : null,
        discountEndsAt: data.discountEndsAt
          ? new Date(data.discountEndsAt)
          : data.wholesaleDiscountEndsAt
            ? new Date(data.wholesaleDiscountEndsAt)
            : data.retailDiscountEndsAt
              ? new Date(data.retailDiscountEndsAt)
              : null,
      },
    };
  }

  async findOne(id: string, channel?: string) {
    const product = await this.productRepo.findOne({ where: { id }, relations: ['variants'] });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    const ch = String(channel || '').toUpperCase();
    if (ch === 'RETAIL' && product.showOnRetail === false) {
      throw new NotFoundException('محصول یافت نشد');
    }
    if (ch === 'WHOLESALE' && product.showOnWholesale === false) {
      throw new NotFoundException('محصول یافت نشد');
    }
    const cfg = await this.badgeConfig();
    return this.attachRelated(product, this.withBadges(product, channel, cfg), channel, cfg);
  }

  async findBySlug(slug: string, channel?: string) {
    let decoded = String(slug || '').trim();
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      /* keep raw */
    }

    let product =
      (await this.productRepo.findOne({ where: { slug: decoded }, relations: ['variants'] })) ||
      (await this.productRepo.findOne({
        where: { sku: ILike(decoded) },
        relations: ['variants'],
      }));

    // Legacy Persian slugs ended with "-{sku}" — resolve by trailing SKU.
    if (!product && decoded.includes('-')) {
      const tail = decoded.split('-').pop()?.trim();
      if (tail) {
        product = await this.productRepo.findOne({
          where: { sku: ILike(tail) },
          relations: ['variants'],
        });
      }
    }

    if (!product) throw new NotFoundException('محصول یافت نشد');
    const ch = String(channel || '').toUpperCase();
    if (ch === 'RETAIL' && product.showOnRetail === false) {
      throw new NotFoundException('محصول یافت نشد');
    }
    if (ch === 'WHOLESALE' && product.showOnWholesale === false) {
      throw new NotFoundException('محصول یافت نشد');
    }
    const cfg = await this.badgeConfig();
    return this.attachRelated(product, this.withBadges(product, channel, cfg), channel, cfg);
  }

  async create(data: CreateProductDto) {
    if (!data.sku) {
      if (!data.categoryId) {
        throw new BadRequestException('دسته‌بندی الزامی است (برای تولید خودکار SKU)');
      }
      const sku = await this.allocateSku(data.categoryId);
      data = { ...data, sku };
    }

    const specs = (data.specs ?? {}) as ProductSpecs;
    const fabric = this.fabricFromSpecs(specs, data.fabric);
    const showOnWholesale = data.showOnWholesale !== false;
    const showOnRetail = data.showOnRetail !== false;
    let minOrderQty: number;
    try {
      minOrderQty = normalizeMinOrderQty(data.minOrderQty ?? GLOBAL_MIN_ORDER_QTY);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    let prices: ProductChannelPrices;
    let saleFlags: Partial<ProductEntity>;
    try {
      const applied = this.applySaleFromDto(data, {
        wholesalePrice: Number(data.wholesalePrice),
        retailPrice: data.retailPrice == null ? null : Number(data.retailPrice),
      });
      prices = applied.prices;
      saleFlags = applied.flags;
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    const retailFullContent = data.retailFullContent
      ? sanitizeBlogHtml(data.retailFullContent)
      : data.description || null;
    const wholesaleFullContent = data.wholesaleFullContent
      ? sanitizeBlogHtml(data.wholesaleFullContent)
      : data.description || null;

    if (data.slug) {
      const slug = normalizePublicSlug(data.slug);
      const clash = await this.productRepo.findOne({ where: { slug } });
      if (clash) throw new BadRequestException('این slug قبلاً استفاده شده است');
    }

    const product = this.productRepo.create({
      name: data.name,
      fabric,
      fabricComposition: data.fabricComposition,
      description: data.description,
      retailFullContent,
      wholesaleFullContent,
      legacyContent: data.description || null,
      careInstructions: data.careInstructions ?? null,
      faqItems: data.faqItems ?? null,
      specs,
      sizeType: (data.sizeType as ProductSizeType) || 'FREE',
      wholesalePrice: prices.wholesalePrice,
      retailPrice: prices.retailPrice,
      wholesaleCompareAtPrice: prices.wholesaleCompareAtPrice,
      retailCompareAtPrice: prices.retailCompareAtPrice,
      minOrderQty,
      allowWholesaleColorSelect: !!data.allowWholesaleColorSelect,
      minWholesaleColors: Math.max(1, Number(data.minWholesaleColors) || 1),
      status: data.status,
      ...saleFlags,
      isNew: false,
      images: data.images,
      seoMeta: data.seoMeta,
      sku: data.sku!,
      slug: data.slug ? normalizePublicSlug(data.slug) : undefined,
      categoryId: data.categoryId,
      collectionId: data.collectionId,
      isPreOrder: !!data.isPreOrder,
      preOrderDate: data.preOrderDate ? new Date(data.preOrderDate) : null,
      modelInfo: data.modelInfo ?? null,
      videoUrl: data.videoUrl ?? null,
      showOnWholesale,
      showOnRetail,
    });
    const saved = await this.productRepo.save(product);
    await this.replaceRelated(saved.id, data.relatedProductIds);
    await this.rememberSpecs(specs);
    await this.syncSearch(saved);
    const cfg = await this.badgeConfig();
    return this.withBadges(
      (await this.productRepo.findOne({
        where: { id: saved.id },
        relations: ['variants'],
      })) as ProductEntity,
      undefined,
      cfg
    );
  }

  private async allocateSku(categoryId: string): Promise<string> {
    return this.productRepo.manager.transaction(async (em) => {
      const catRepo = em.getRepository(CategoryEntity);
      const productRepo = em.getRepository(ProductEntity);

      const category = await catRepo
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: categoryId })
        .getOne();

      if (!category) throw new BadRequestException('دسته‌بندی یافت نشد');
      const prefix = (category.skuPrefix ?? '').trim();
      if (!prefix)
        throw new BadRequestException('فرمول/پیشوند SKU برای این دسته‌بندی تنظیم نشده است');

      let seq = Math.max(1, Number(category.nextSequence) || 1);
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const sku = `${prefix}${String(seq).padStart(5, '0')}`.toUpperCase();
        try {
          category.nextSequence = seq + 1;
          await catRepo.save(category);
          const exists = await productRepo.exist({ where: { sku } });
          if (!exists) return sku;
        } catch {
          // ignore and retry
        }
        seq += 1;
      }
      throw new BadRequestException('تولید SKU ناموفق بود');
    });
  }

  async update(id: string, data: UpdateProductDto) {
    const existing = await this.productRepo.findOne({ where: { id }, relations: ['variants'] });
    if (!existing) throw new NotFoundException('محصول یافت نشد');
    const oldImages = existing.images ?? [];

    const patch: Partial<ProductEntity> = { ...data } as any;
    delete (patch as any).relatedProductIds;
    delete (patch as any).slug;
    delete (patch as any).minOrderQty;
    delete (patch as any).allowBelowMoq;
    delete (patch as any).wholesaleIsDiscounted;
    delete (patch as any).retailIsDiscounted;
    delete (patch as any).wholesaleDiscountType;
    delete (patch as any).retailDiscountType;
    delete (patch as any).wholesaleDiscountPercent;
    delete (patch as any).retailDiscountPercent;
    delete (patch as any).wholesaleDiscountAmount;
    delete (patch as any).retailDiscountAmount;
    delete (patch as any).wholesaleDiscountStartsAt;
    delete (patch as any).retailDiscountStartsAt;
    delete (patch as any).wholesaleDiscountEndsAt;
    delete (patch as any).retailDiscountEndsAt;
    if (data.specs) {
      patch.specs = data.specs as ProductSpecs;
      patch.fabric = this.fabricFromSpecs(
        data.specs as ProductSpecs,
        data.fabric ?? existing.fabric
      );
      await this.rememberSpecs(data.specs as ProductSpecs);
    } else if (data.fabric !== undefined) {
      patch.fabric = data.fabric;
    }
    // Ignore legacy flags from old clients
    delete (patch as any).isNew;
    delete (patch as any).isFeatured;
    if (data.isDiscounted !== undefined) {
      patch.isDiscounted = data.isDiscounted;
      patch.isFeatured = data.isDiscounted;
    }
    if (data.preOrderDate !== undefined) {
      patch.preOrderDate = data.preOrderDate ? new Date(data.preOrderDate) : null;
    }

    const showOnWholesale =
      data.showOnWholesale !== undefined
        ? data.showOnWholesale !== false
        : existing.showOnWholesale !== false;
    const showOnRetail =
      data.showOnRetail !== undefined
        ? data.showOnRetail !== false
        : existing.showOnRetail !== false;

    const priceOrChannelTouch =
      data.wholesalePrice !== undefined ||
      data.retailPrice !== undefined ||
      data.wholesaleCompareAtPrice !== undefined ||
      data.retailCompareAtPrice !== undefined ||
      data.showOnWholesale !== undefined ||
      data.showOnRetail !== undefined ||
      data.wholesaleIsDiscounted !== undefined ||
      data.retailIsDiscounted !== undefined ||
      data.isDiscounted !== undefined;

    // Clearing retail final to null is only allowed when retail channel is off.
    if (data.retailPrice === null && showOnRetail) {
      throw new BadRequestException(
        'پاک کردن قیمت نهایی تکی فقط وقتی نمایش در تکی غیرفعال است مجاز است',
      );
    }

    // Legacy products may have null retailPrice while showOnRetail=true.
    // Do not block unrelated PATCH (description/images/stock) until prices/channels are touched.
    if (priceOrChannelTouch) {
      try {
        const hasChannel =
          data.wholesaleIsDiscounted !== undefined || data.retailIsDiscounted !== undefined;
        if (hasChannel) {
          const baseWholesale =
            data.wholesalePrice != null
              ? Number(data.wholesalePrice)
              : Number(existing.wholesaleCompareAtPrice ?? existing.wholesalePrice);
          const baseRetail =
            data.retailPrice !== undefined
              ? data.retailPrice
              : existing.retailCompareAtPrice ?? existing.retailPrice;
          const merged = this.applySaleFromDto(
            {
              ...data,
              showOnWholesale,
              showOnRetail,
            },
            { wholesalePrice: baseWholesale, retailPrice: baseRetail },
          );
          patch.wholesalePrice = merged.prices.wholesalePrice;
          patch.retailPrice = merged.prices.retailPrice;
          patch.wholesaleCompareAtPrice = merged.prices.wholesaleCompareAtPrice;
          patch.retailCompareAtPrice = merged.prices.retailCompareAtPrice;
          Object.assign(patch, merged.flags);
        } else {
          const mergedPrices = normalizeProductChannelPrices({
            wholesalePrice: data.wholesalePrice ?? existing.wholesalePrice,
            retailPrice: data.retailPrice !== undefined ? data.retailPrice : existing.retailPrice,
            wholesaleCompareAtPrice:
              data.wholesaleCompareAtPrice !== undefined
                ? data.wholesaleCompareAtPrice
                : existing.wholesaleCompareAtPrice,
            retailCompareAtPrice:
              data.retailCompareAtPrice !== undefined
                ? data.retailCompareAtPrice
                : existing.retailCompareAtPrice,
            showOnWholesale,
            showOnRetail,
          });
          patch.wholesalePrice = mergedPrices.wholesalePrice;
          patch.retailPrice = mergedPrices.retailPrice;
          patch.wholesaleCompareAtPrice = mergedPrices.wholesaleCompareAtPrice;
          patch.retailCompareAtPrice = mergedPrices.retailCompareAtPrice;
        }
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    }
    if (data.showOnWholesale !== undefined) patch.showOnWholesale = showOnWholesale;
    if (data.showOnRetail !== undefined) patch.showOnRetail = showOnRetail;
    if (data.allowWholesaleColorSelect !== undefined) {
      patch.allowWholesaleColorSelect = !!data.allowWholesaleColorSelect;
    }
    if (data.minWholesaleColors !== undefined) {
      patch.minWholesaleColors = Math.max(1, Number(data.minWholesaleColors) || 1);
    }
    if (data.minOrderQty !== undefined) {
      try {
        patch.minOrderQty = normalizeMinOrderQty(data.minOrderQty);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    }
    if (data.retailFullContent !== undefined) {
      patch.retailFullContent = data.retailFullContent
        ? sanitizeBlogHtml(data.retailFullContent)
        : null;
    }
    if (data.wholesaleFullContent !== undefined) {
      patch.wholesaleFullContent = data.wholesaleFullContent
        ? sanitizeBlogHtml(data.wholesaleFullContent)
        : null;
    }
    if (data.careInstructions !== undefined) patch.careInstructions = data.careInstructions;
    if (data.faqItems !== undefined) patch.faqItems = data.faqItems;

    await this.productRepo.update(id, patch as any);
    if (data.slug !== undefined && data.slug !== existing.slug) {
      await this.changeSlugInTransaction(id, data.slug);
    }
    const updated = await this.productRepo.findOne({ where: { id }, relations: ['variants'] });
    if (!updated) throw new NotFoundException('محصول یافت نشد');
    if (data.relatedProductIds) {
      await this.replaceRelated(id, data.relatedProductIds);
    }

    if (data.images) {
      const removed = oldImages.filter((url) => !data.images!.includes(url));
      if (removed.length) await this.storage.deleteByUrls(removed);
    }

    await this.syncSearch(updated);
    const cfg = await this.badgeConfig();
    return this.withBadges(updated, undefined, cfg);
  }

  async remove(id: string) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    if (product.images?.length) {
      await this.storage.deleteByUrls(product.images);
    }
    await this.productRepo.softDelete(id);
    await this.search.removeProduct(id);
    return { message: 'محصول با موفقیت حذف شد' };
  }

  /** Resolve channel stock column on product/variant. */
  stockField(channel?: string): 'wholesaleStock' | 'retailStock' {
    const c = String(channel || 'WHOLESALE').toUpperCase();
    return c === 'RETAIL' ? 'retailStock' : 'wholesaleStock';
  }

  async updateVariantStock(
    variantId: string,
    delta: number,
    channel: 'WHOLESALE' | 'RETAIL' | string = 'WHOLESALE',
    manager?: EntityManager
  ) {
    const variantRepo = manager?.getRepository(ProductVariantEntity) ?? this.variantRepo;
    const field = this.stockField(channel);
    const qty = Number(delta) || 0;
    if (qty === 0) {
      const variant = await variantRepo.findOne({ where: { id: variantId } });
      if (!variant) throw new NotFoundException('واریانت یافت نشد');
      return variant;
    }

    if (qty < 0) {
      // Atomic deduct: refuse if insufficient stock (no Math.max clamp).
      const result = await variantRepo
        .createQueryBuilder()
        .update()
        .set({
          [field]: () => `"${field}" + (${qty})`,
          ...(field === 'wholesaleStock' ? { stock: () => `"wholesaleStock" + (${qty})` } : {}),
        } as any)
        .where('id = :id', { id: variantId })
        .andWhere(`"${field}" >= :need`, { need: Math.abs(qty) })
        .execute();
      if (!result.affected) {
        const variant = await variantRepo.findOne({ where: { id: variantId } });
        if (!variant) throw new NotFoundException('واریانت یافت نشد');
        throw new BadRequestException(
          `موجودی کافی نیست (واریانت ${variant.color}/${variant.size})`
        );
      }
    } else {
      await variantRepo
        .createQueryBuilder()
        .update()
        .set({
          [field]: () => `"${field}" + (${qty})`,
          ...(field === 'wholesaleStock' ? { stock: () => `"wholesaleStock" + (${qty})` } : {}),
        } as any)
        .where('id = :id', { id: variantId })
        .execute();
    }

    const variant = await this.variantRepo.findOneOrFail({ where: { id: variantId } });
    await this.syncProductStockFromVariants(variant.productId);
    return variant;
  }

  /** Sum variant channel stocks onto product wholesale/retail/legacy stock. */
  async syncProductStockFromVariants(productId: string) {
    const variants = await this.variantRepo.find({ where: { productId } });
    const wholesaleSum = variants.reduce(
      (s, v) => s + (Number(v.wholesaleStock) || Number(v.stock) || 0),
      0
    );
    const retailSum = variants.reduce((s, v) => s + (Number(v.retailStock) || 0), 0);
    await this.productRepo.update(productId, {
      wholesaleStock: wholesaleSum,
      retailStock: retailSum,
      stock: wholesaleSum,
    });
    return { wholesaleStock: wholesaleSum, retailStock: retailSum, stock: wholesaleSum };
  }

  /** Adjust product-level stock by delta (orders deduct with negative delta). */
  async updateProductStock(
    productId: string,
    delta: number,
    channel: 'WHOLESALE' | 'RETAIL' | string = 'WHOLESALE'
  ) {
    const field = this.stockField(channel);
    const qty = Number(delta) || 0;
    if (qty === 0) {
      const product = await this.productRepo.findOne({ where: { id: productId } });
      if (!product) throw new NotFoundException('محصول یافت نشد');
      return product;
    }
    if (qty < 0) {
      const result = await this.productRepo
        .createQueryBuilder()
        .update()
        .set({
          [field]: () => `"${field}" + (${qty})`,
          ...(field === 'wholesaleStock' ? { stock: () => `"wholesaleStock" + (${qty})` } : {}),
        } as any)
        .where('id = :id', { id: productId })
        .andWhere(`"${field}" >= :need`, { need: Math.abs(qty) })
        .execute();
      if (!result.affected) {
        throw new BadRequestException('موجودی کافی نیست');
      }
    } else {
      await this.productRepo
        .createQueryBuilder()
        .update()
        .set({
          [field]: () => `"${field}" + (${qty})`,
          ...(field === 'wholesaleStock' ? { stock: () => `"wholesaleStock" + (${qty})` } : {}),
        } as any)
        .where('id = :id', { id: productId })
        .execute();
    }
    return this.productRepo.findOneOrFail({ where: { id: productId } });
  }

  /**
   * Set absolute product-level stock for a channel.
   * Pack MOQ is enforced at wholesale checkout, not on warehouse piece counts.
   */
  async setProductStock(
    productId: string,
    stock: number,
    channel: 'WHOLESALE' | 'RETAIL' | string = 'WHOLESALE'
  ) {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    const next = Math.floor(Number(stock));
    if (!Number.isFinite(next) || next < 0) {
      throw new BadRequestException('موجودی نامعتبر است');
    }
    const field = this.stockField(channel);
    product[field] = next;
    if (field === 'wholesaleStock') {
      product.stock = next;
    }
    return this.productRepo.save(product);
  }

  async setProductStockBySku(
    sku: string,
    stock: number,
    channel: 'WHOLESALE' | 'RETAIL' | string = 'WHOLESALE'
  ) {
    const product = await this.productRepo.findOne({ where: { sku: String(sku).trim() } });
    if (!product) throw new NotFoundException(`محصول با SKU «${sku}» یافت نشد`);
    return this.setProductStock(product.id, stock, channel);
  }

  async findBySku(sku: string) {
    const product = await this.productRepo.findOne({
      where: { sku: String(sku).trim() },
      relations: ['variants'],
    });
    if (!product) throw new NotFoundException(`محصول با SKU «${sku}» یافت نشد`);
    const cfg = await this.badgeConfig();
    return this.withBadges(product, undefined, cfg);
  }

  private sizeLabelForProduct(product: ProductEntity): string {
    const map: Record<string, string> = {
      TWO: 'سایز ۱',
      THREE: 'سایز ۱',
      FREE: 'فری سایز',
    };
    return map[product.sizeType] || 'فری سایز';
  }

  /** Available size choices based on product sizeType */
  sizesForProduct(sizeType?: string): string[] {
    return sizesForSizeType(sizeType);
  }

  /**
   * Create color×size rows. When `size` is omitted, expands to ALL sizes of the
   * product and places the entered stock on the first size only (siblings = 0)
   * so product totals are not inflated by size count.
   */
  async createVariant(productId: string, data: CreateVariantDto) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['variants'],
    });
    if (!product) throw new NotFoundException('محصول یافت نشد');

    const colorName = String(data.color ?? '').trim();
    const colorHex = String((data as any).colorHex ?? '').trim();
    const color = await this.upsertColor(colorName, colorHex || undefined);

    const wholesale =
      data.wholesaleStock !== undefined && data.wholesaleStock !== null
        ? Math.max(0, Math.floor(Number(data.wholesaleStock)))
        : data.stock !== undefined && data.stock !== null
          ? Math.max(0, Math.floor(Number(data.stock)))
          : 0;
    const retail =
      data.retailStock !== undefined && data.retailStock !== null
        ? Math.max(0, Math.floor(Number(data.retailStock)))
        : 0;

    if (!Number.isFinite(wholesale) || !Number.isFinite(retail)) {
      throw new BadRequestException('موجودی نامعتبر است');
    }

    const explicitSize = String(data.size ?? '').trim();
    const sizes = explicitSize ? [explicitSize] : this.sizesForProduct(product.sizeType);
    const imageUrl =
      data.imageUrl !== undefined ? String(data.imageUrl || '').trim() || null : undefined;

    const existing = product.variants ?? [];
    const created: ProductVariantEntity[] = [];

    for (let i = 0; i < sizes.length; i++) {
      const sizeLabel = sizes[i];
      const found = existing.find((v) => v.color === color.name && v.size === sizeLabel);
      if (found) {
        // Color-level create (no explicit size): refresh stock pool onto first size only
        if (!explicitSize) {
          found.wholesaleStock = i === 0 ? wholesale : 0;
          found.stock = i === 0 ? wholesale : 0;
          found.retailStock = i === 0 ? retail : 0;
          found.colorHex = color.hex ?? (colorHex || found.colorHex);
          if (data.barcode !== undefined) found.barcode = data.barcode || null;
          if (imageUrl !== undefined) found.imageUrl = imageUrl;
          const savedFound = await this.variantRepo.save(found);
          created.push(Array.isArray(savedFound) ? savedFound[0] : savedFound);
        } else {
          if (imageUrl !== undefined) {
            found.imageUrl = imageUrl;
            const savedFound = await this.variantRepo.save(found);
            created.push(Array.isArray(savedFound) ? savedFound[0] : savedFound);
          } else {
            created.push(found);
          }
        }
        continue;
      }

      const size = await this.upsertSize(sizeLabel);
      const rowWholesale = explicitSize ? wholesale : i === 0 ? wholesale : 0;
      const rowRetail = explicitSize ? retail : i === 0 ? retail : 0;
      const variant = this.variantRepo.create({
        productId,
        barcode: data.barcode,
        stock: rowWholesale,
        wholesaleStock: rowWholesale,
        retailStock: rowRetail,
        color: color.name,
        colorHex: color.hex ?? colorHex ?? '',
        size: size.label,
        colorId: color.id,
        sizeId: size.id,
        imageUrl: imageUrl ?? null,
      });
      const saved = await this.variantRepo.save(variant);
      created.push(Array.isArray(saved) ? saved[0] : saved);
    }

    await this.syncProductStockFromVariants(productId);
    if (imageUrl) {
      await this.mergeColorImagesIntoProduct(productId);
    }
    return created;
  }

  /**
   * Set absolute stock for a color across product sizes.
   * Prefer `sizes[]` for per-size wholesale/retail stock.
   * Legacy: single wholesaleStock/retailStock applies only to the first size.
   */
  async setColorStock(
    productId: string,
    data: {
      color: string;
      colorHex?: string;
      barcode?: string;
      imageUrl?: string | null;
      wholesaleStock?: number;
      retailStock?: number;
      stock?: number;
      sizes?: Array<{
        size: string;
        wholesaleStock?: number;
        retailStock?: number;
        stock?: number;
      }>;
    }
  ) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['variants'],
    });
    if (!product) throw new NotFoundException('محصول یافت نشد');

    const colorName = String(data.color ?? '').trim();
    if (!colorName) throw new BadRequestException('رنگ الزامی است');
    const colorHex = String(data.colorHex ?? '').trim();
    const color = await this.upsertColor(colorName, colorHex || undefined);
    const imageUrl =
      data.imageUrl !== undefined ? String(data.imageUrl || '').trim() || null : undefined;

    const productSizes = this.sizesForProduct(product.sizeType);
    const perSize = new Map<string, { wholesale?: number; retail?: number }>();

    if (Array.isArray(data.sizes) && data.sizes.length > 0) {
      for (const row of data.sizes) {
        const label = String(row.size ?? '').trim();
        if (!label) continue;
        const wholesale =
          row.wholesaleStock !== undefined && row.wholesaleStock !== null
            ? Math.max(0, Math.floor(Number(row.wholesaleStock)))
            : row.stock !== undefined && row.stock !== null
              ? Math.max(0, Math.floor(Number(row.stock)))
              : undefined;
        const retail =
          row.retailStock !== undefined && row.retailStock !== null
            ? Math.max(0, Math.floor(Number(row.retailStock)))
            : undefined;
        if (wholesale !== undefined && !Number.isFinite(wholesale)) {
          throw new BadRequestException(`موجودی عمده سایز «${label}» نامعتبر است`);
        }
        if (retail !== undefined && !Number.isFinite(retail)) {
          throw new BadRequestException(`موجودی تکی سایز «${label}» نامعتبر است`);
        }
        perSize.set(label, { wholesale, retail });
      }
    } else {
      const wholesale =
        data.wholesaleStock !== undefined && data.wholesaleStock !== null
          ? Math.max(0, Math.floor(Number(data.wholesaleStock)))
          : data.stock !== undefined && data.stock !== null
            ? Math.max(0, Math.floor(Number(data.stock)))
            : undefined;
      const retail =
        data.retailStock !== undefined && data.retailStock !== null
          ? Math.max(0, Math.floor(Number(data.retailStock)))
          : undefined;
      if (wholesale !== undefined && !Number.isFinite(wholesale)) {
        throw new BadRequestException('موجودی عمده نامعتبر است');
      }
      if (retail !== undefined && !Number.isFinite(retail)) {
        throw new BadRequestException('موجودی تکی نامعتبر است');
      }
      for (let i = 0; i < productSizes.length; i++) {
        perSize.set(productSizes[i], {
          wholesale: wholesale === undefined ? undefined : i === 0 ? wholesale : 0,
          retail: retail === undefined ? undefined : i === 0 ? retail : 0,
        });
      }
    }

    const sizes = Array.from(new Set([...productSizes, ...Array.from(perSize.keys())]));
    const existing = product.variants ?? [];
    const updated: ProductVariantEntity[] = [];

    for (const sizeLabel of sizes) {
      const stockRow = perSize.get(sizeLabel);
      let row = existing.find((v) => v.color === color.name && v.size === sizeLabel);
      if (!row) {
        const size = await this.upsertSize(sizeLabel);
        row = this.variantRepo.create({
          productId,
          stock: 0,
          wholesaleStock: 0,
          retailStock: 0,
          color: color.name,
          colorHex: color.hex ?? colorHex ?? '',
          size: size.label,
          colorId: color.id,
          sizeId: size.id,
          barcode: data.barcode || null,
          imageUrl: imageUrl ?? null,
        });
      } else {
        row.color = color.name;
        row.colorHex = color.hex ?? (colorHex || row.colorHex);
        row.colorId = color.id;
        if (data.barcode !== undefined) row.barcode = data.barcode || null;
        if (imageUrl !== undefined) row.imageUrl = imageUrl;
      }

      if (stockRow?.wholesale !== undefined) {
        row.wholesaleStock = stockRow.wholesale;
        row.stock = stockRow.wholesale;
      }
      if (stockRow?.retail !== undefined) {
        row.retailStock = stockRow.retail;
      }
      const saved = await this.variantRepo.save(row);
      updated.push(Array.isArray(saved) ? saved[0] : saved);
    }

    await this.syncProductStockFromVariants(productId);
    await this.mergeColorImagesIntoProduct(productId);
    return updated;
  }

  /** Ensure product.images includes each unique color imageUrl (gallery sync). */
  private async mergeColorImagesIntoProduct(productId: string) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['variants'],
    });
    if (!product) return;
    const colorImages = [
      ...new Set(
        (product.variants ?? []).map((v) => String(v.imageUrl || '').trim()).filter(Boolean)
      ),
    ];
    if (!colorImages.length) return;
    const current = Array.isArray(product.images) ? [...product.images] : [];
    let changed = false;
    for (const url of colorImages) {
      if (!current.includes(url)) {
        current.push(url);
        changed = true;
      }
    }
    if (changed) {
      product.images = current;
      await this.productRepo.save(product);
    }
  }

  async removeColorVariants(productId: string, colorName: string) {
    const name = String(colorName ?? '').trim();
    if (!name) throw new BadRequestException('رنگ الزامی است');
    const rows = await this.variantRepo.find({ where: { productId, color: name } });
    if (!rows.length) throw new NotFoundException('واریانتی با این رنگ یافت نشد');
    await this.variantRepo.remove(rows);
    await this.syncProductStockFromVariants(productId);
    return { message: `رنگ «${name}» و ${rows.length} سایز حذف شد`, deleted: rows.length };
  }

  async updateVariant(
    variantId: string,
    data: Partial<ProductVariantEntity> & {
      wholesaleStock?: number;
      retailStock?: number;
      stock?: number;
    }
  ) {
    const variant = await this.variantRepo.findOne({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('واریانت یافت نشد');

    if (typeof (data as any).color === 'string' || typeof (data as any).colorHex === 'string') {
      const colorName = String((data as any).color ?? variant.color).trim();
      const colorHex = String((data as any).colorHex ?? variant.colorHex).trim();
      const color = await this.upsertColor(colorName, colorHex || undefined);
      variant.color = color.name;
      variant.colorHex = color.hex ?? variant.colorHex;
      variant.colorId = color.id;
    }

    if (typeof (data as any).size === 'string' && String((data as any).size).trim()) {
      const sizeLabel = String((data as any).size).trim();
      const size = await this.upsertSize(sizeLabel);
      variant.size = size.label;
      variant.sizeId = size.id;
    }

    if ((data as any).barcode !== undefined) {
      variant.barcode = (data as any).barcode || null;
    }

    const hasWholesale = data.wholesaleStock !== undefined && data.wholesaleStock !== null;
    const hasRetail = data.retailStock !== undefined && data.retailStock !== null;
    const hasLegacyStock = data.stock !== undefined && data.stock !== null;

    if (hasWholesale || hasLegacyStock) {
      const next = Math.max(0, Math.floor(Number(hasWholesale ? data.wholesaleStock : data.stock)));
      if (!Number.isFinite(next)) throw new BadRequestException('موجودی عمده نامعتبر است');
      variant.wholesaleStock = next;
      variant.stock = next;
    }
    if (hasRetail) {
      const next = Math.max(0, Math.floor(Number(data.retailStock)));
      if (!Number.isFinite(next)) throw new BadRequestException('موجودی تکی نامعتبر است');
      variant.retailStock = next;
    }

    const saved = await this.variantRepo.save(variant);
    if (hasWholesale || hasRetail || hasLegacyStock) {
      await this.syncProductStockFromVariants(variant.productId);
    }
    return saved;
  }

  private async upsertColor(name: string, hex?: string) {
    const n = String(name ?? '').trim();
    if (!n) throw new BadRequestException('رنگ الزامی است');
    const existing = await this.colorRepo.findOne({ where: { name: n } });
    if (existing) {
      if (hex && existing.hex !== hex) {
        existing.hex = hex;
        return this.colorRepo.save(existing);
      }
      return existing;
    }
    return this.colorRepo.save(this.colorRepo.create({ name: n, hex: hex || null }));
  }

  private async upsertSize(label: string) {
    const l = String(label ?? '').trim();
    if (!l) throw new BadRequestException('سایز الزامی است');
    const existing = await this.sizeRepo.findOne({ where: { label: l } });
    if (existing) return existing;
    return this.sizeRepo.save(this.sizeRepo.create({ label: l, sort: 0 }));
  }

  async removeVariant(variantId: string) {
    const variant = await this.variantRepo.findOne({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('واریانت یافت نشد');
    const productId = variant.productId;
    await this.variantRepo.remove(variant);
    await this.syncProductStockFromVariants(productId);
    return { message: 'واریانت حذف شد' };
  }

  async findAllWithVariants(search?: string, channel?: string) {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.variants', 'v')
      .where('p.deletedAt IS NULL')
      .orderBy('p.name', 'ASC');

    if (search) {
      qb.andWhere('(p.name ILIKE :s OR p.sku ILIKE :s)', { s: `%${search}%` });
    }

    const products = await qb.getMany();
    const field = this.stockField(channel);
    return products.map((p) => {
      const wholesaleStock = Number(p.wholesaleStock) || Number(p.stock) || 0;
      const retailStock = Number(p.retailStock) || 0;
      const totalStock = field === 'retailStock' ? retailStock : wholesaleStock;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        fabric: this.fabricFromSpecs(p.specs, p.fabric),
        status: p.status,
        wholesalePrice: p.wholesalePrice,
        minOrderQty: p.minOrderQty,
        stock: wholesaleStock,
        wholesaleStock,
        retailStock,
        totalStock,
        channel: field === 'retailStock' ? 'RETAIL' : 'WHOLESALE',
        variants: (p.variants ?? []).map((v) => {
          const vWholesale = Number(v.wholesaleStock) || Number(v.stock) || 0;
          const vRetail = Number(v.retailStock) || 0;
          return {
            id: v.id,
            color: v.color,
            colorHex: v.colorHex,
            size: v.size,
            stock: field === 'retailStock' ? vRetail : vWholesale,
            wholesaleStock: vWholesale,
            retailStock: vRetail,
            barcode: v.barcode,
            imageUrl: (v as { imageUrl?: string }).imageUrl ?? null,
          };
        }),
      };
    });
  }

  async getVariant(variantId: string) {
    const v = await this.variantRepo.findOne({ where: { id: variantId }, relations: ['product'] });
    if (!v) throw new NotFoundException('واریانت یافت نشد');
    return v;
  }

  private contentInputFromProduct(product: ProductEntity, categoryName?: string | null): ProductContentInput {
    const colors = [...new Set((product.variants ?? []).map((v) => String(v.color || '').trim()).filter(Boolean))];
    const sizes = sizesForSizeType(product.sizeType);
    return {
      name: product.name,
      description: product.description,
      retailFullContent: product.retailFullContent,
      wholesaleFullContent: product.wholesaleFullContent,
      legacyContent: product.legacyContent,
      fabric: this.fabricFromSpecs(product.specs, product.fabric),
      specs: product.specs,
      sizeType: product.sizeType,
      colors,
      sizes,
      packQty: computePackQty(colors, product.sizeType),
      minPackQty: Math.max(1, Number(product.minOrderQty) || 1),
      careInstructions: product.careInstructions,
      categoryName: categoryName ?? null,
    };
  }

  async previewGeneratedContent(body: {
    channel: 'RETAIL' | 'WHOLESALE';
    productId?: string;
    name?: string;
    description?: string | null;
    fabric?: string | null;
    specs?: ProductSpecs | null;
    sizeType?: string | null;
    colors?: string[];
    minOrderQty?: number;
    careInstructions?: Record<string, unknown> | null;
    categoryName?: string | null;
  }) {
    const channel = body.channel === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    let input: ProductContentInput = {
      name: body.name || '',
      description: body.description,
      fabric: body.fabric,
      specs: body.specs,
      sizeType: body.sizeType,
      colors: body.colors ?? [],
      sizes: sizesForSizeType(body.sizeType),
      packQty: computePackQty(body.colors ?? [], body.sizeType),
      minPackQty: Math.max(1, Number(body.minOrderQty) || 1),
      careInstructions: body.careInstructions ?? null,
      categoryName: body.categoryName ?? null,
    };
    if (body.productId) {
      const product = await this.productRepo.findOne({
        where: { id: body.productId },
        relations: ['variants', 'category'],
      });
      if (!product) throw new NotFoundException('محصول یافت نشد');
      input = {
        ...this.contentInputFromProduct(product, product.category?.name),
        ...Object.fromEntries(Object.entries(input).filter(([, v]) => v != null && v !== '')),
      };
    }
    if (!input.name) throw new BadRequestException('نام محصول برای ساخت متن لازم است');
    return { channel, text: generateChannelContent(input, channel) };
  }

  async fillRelatedForProduct(productId: string, replace = false) {
    const product = await this.productRepo.findOne({ where: { id: productId }, relations: ['variants'] });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    const existing = replace
      ? []
      : (await this.relatedRepo.find({ where: { productId }, order: { sortOrder: 'ASC' } })).map(
          (r) => r.relatedProductId,
        );
    const candidates = await this.productRepo.find({
      where: { status: 'ACTIVE' },
      select: ['id', 'sku', 'status', 'categoryId', 'collectionId', 'sizeType', 'showOnRetail', 'showOnWholesale', 'fabric', 'specs'],
    });
    const ranked = sortRelatedCandidates(
      {
        id: product.id,
        sku: product.sku,
        status: product.status,
        categoryId: product.categoryId,
        collectionId: product.collectionId,
        fabricType: this.fabricFromSpecs(product.specs, product.fabric),
        sizeType: product.sizeType,
        showOnRetail: product.showOnRetail,
        showOnWholesale: product.showOnWholesale,
      },
      candidates.map((item) => ({
        id: item.id,
        sku: item.sku,
        status: item.status,
        categoryId: item.categoryId,
        collectionId: item.collectionId,
        fabricType: this.fabricFromSpecs(item.specs, item.fabric),
        sizeType: item.sizeType,
        showOnRetail: item.showOnRetail,
        showOnWholesale: item.showOnWholesale,
      })),
    );
    const filled = fillRelatedIds(product.id, existing, ranked);
    await this.replaceRelated(productId, filled.next);
    return filled;
  }

  async exportExcel(channelRaw?: string) {
    let channel;
    try {
      channel = parseExportChannel(channelRaw);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'کانال خروجی نامعتبر است');
    }
    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.variants', 'v')
      .leftJoinAndSelect('p.category', 'c')
      .where('p.deletedAt IS NULL')
      .orderBy('p.sku', 'ASC')
      .addOrderBy('v.color', 'ASC')
      .addOrderBy('v.size', 'ASC');
    if (channel === 'WHOLESALE') qb.andWhere('p.showOnWholesale = true');
    if (channel === 'RETAIL') qb.andWhere('p.showOnRetail = true');
    const products = await qb.getMany();
    const ids = products.map((p) => p.id);
    const relatedSkusByProduct = new Map<string, string[]>();
    if (ids.length) {
      const links = await this.relatedRepo.find({ where: { productId: In(ids) } });
      const relatedIds = [...new Set(links.map((l) => l.relatedProductId))];
      const related = relatedIds.length
        ? await this.productRepo.find({ where: { id: In(relatedIds) }, select: ['id', 'sku'] })
        : [];
      const skuById = new Map(related.map((r) => [r.id, r.sku]));
      for (const link of links) {
        const sku = skuById.get(link.relatedProductId);
        if (!sku) continue;
        const list = relatedSkusByProduct.get(link.productId) ?? [];
        if (!list.includes(sku)) list.push(sku);
        relatedSkusByProduct.set(link.productId, list);
      }
    }
    const payload: ExportProduct[] = products.map((p) => ({
      ...p,
      relatedSkus: relatedSkusByProduct.get(p.id) ?? [],
    }));
    return buildProductWorkbook({ products: payload, channel });
  }
}
