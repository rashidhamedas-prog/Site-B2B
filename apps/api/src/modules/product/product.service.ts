import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, ILike, In } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductVariantEntity } from './entities/product-variant.entity';
import { CategoryEntity } from '../category/entities/category.entity';
import { VariantColorEntity } from './entities/variant-color.entity';
import { VariantSizeEntity } from './entities/variant-size.entity';
import { ProductSpecMemoryEntity } from './entities/product-spec-memory.entity';
import { ProductSizeType, ProductSpecs, SIZE_GUIDE, SPEC_FIELD_KEYS } from './entities/product-specs';
import { StorageService } from '../upload/storage.service';
import { SearchService } from '../search/search.service';
import { SettingsService } from '../settings/settings.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';

type BadgeConfig = { limitedStockMultiplier: number; newBadgeDays: number };

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
    private readonly storage: StorageService,
    private readonly search: SearchService,
    private readonly settings: SettingsService,
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
      isFeatured: !!product.isDiscounted,
      isDiscounted: !!product.isDiscounted,
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
        const existing = await this.specMemoryRepo.findOne({ where: { fieldKey: e.fieldKey, value: e.value } });
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
      garmentSize?: string;
      channel?: string;
      sort?: string;
      /** When false (default for storefront), skip loading variants to cut payload/TTFB */
      includeVariants?: boolean;
    },
  ) {
    const statusFilter = status ?? 'ACTIVE';
    const sizeType = (size && ['FREE', 'TWO', 'THREE'].includes(size)
      ? size
      : undefined) as ProductSizeType | undefined;
    const garmentSize = opts?.garmentSize || (size && !sizeType ? size : undefined);

    let related: ProductEntity | null = null;
    if (opts?.relatedTo) {
      related =
        (await this.productRepo.findOne({ where: { id: opts.relatedTo } })) ||
        (await this.productRepo.findOne({ where: { slug: opts.relatedTo } }));
    }

    // Admin list (status=ALL) needs variants for stock/color counts; storefront cards do not.
    const wantVariants = opts?.includeVariants === true || status === 'ALL';

    const qb = this.productRepo
      .createQueryBuilder('p')
      .where('p.deletedAt IS NULL');
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
    if (opts?.categoryId || related?.categoryId) {
      qb.andWhere('p.categoryId = :categoryId', {
        categoryId: opts?.categoryId || related?.categoryId,
      });
    }
    if (opts?.collectionId) {
      qb.andWhere('p.collectionId = :collectionId', { collectionId: opts.collectionId });
    }
    if (fabric) {
      qb.andWhere('(p.fabric ILIKE :fabric OR p.specs->>\'fabricType\' ILIKE :fabric)', {
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
    if (related) {
      qb.andWhere('p.id != :rid', { rid: related.id });
      if (related.fabric) {
        qb.andWhere('(p.fabric ILIKE :rf OR p.specs->>\'fabricType\' ILIKE :rf)', {
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
        },
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
    const data = await qb.skip((page - 1) * limit).take(limit).getMany();
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
    return this.withBadges(product, channel, cfg);
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
    return this.withBadges(product, channel, cfg);
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

    const product = this.productRepo.create({
      name: data.name,
      fabric,
      fabricComposition: data.fabricComposition,
      description: data.description,
      specs,
      sizeType: (data.sizeType as ProductSizeType) || 'FREE',
      wholesalePrice: data.wholesalePrice,
      retailPrice: data.retailPrice,
      minOrderQty: data.minOrderQty,
      allowWholesaleColorSelect: !!data.allowWholesaleColorSelect,
      minWholesaleColors: Math.max(1, Number(data.minWholesaleColors) || 1),
      status: data.status,
      isDiscounted: !!data.isDiscounted,
      isFeatured: !!data.isDiscounted,
      isNew: false,
      images: data.images,
      seoMeta: data.seoMeta,
      sku: data.sku!,
      categoryId: data.categoryId,
      collectionId: data.collectionId,
      isPreOrder: !!data.isPreOrder,
      preOrderDate: data.preOrderDate ? new Date(data.preOrderDate) : null,
      modelInfo: data.modelInfo ?? null,
      videoUrl: data.videoUrl ?? null,
      showOnWholesale: data.showOnWholesale !== false,
      showOnRetail: data.showOnRetail !== false,
    });
    const saved = await this.productRepo.save(product);
    await this.rememberSpecs(specs);
    await this.syncSearch(saved);
    const cfg = await this.badgeConfig();
    return this.withBadges(
      await this.productRepo.findOne({ where: { id: saved.id }, relations: ['variants'] }) as ProductEntity,
      undefined,
      cfg,
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
      if (!prefix) throw new BadRequestException('فرمول/پیشوند SKU برای این دسته‌بندی تنظیم نشده است');

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
    if (data.specs) {
      patch.specs = data.specs as ProductSpecs;
      patch.fabric = this.fabricFromSpecs(data.specs as ProductSpecs, data.fabric ?? existing.fabric);
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
    if (data.allowWholesaleColorSelect !== undefined) {
      patch.allowWholesaleColorSelect = !!data.allowWholesaleColorSelect;
    }
    if (data.minWholesaleColors !== undefined) {
      patch.minWholesaleColors = Math.max(1, Number(data.minWholesaleColors) || 1);
    }

    await this.productRepo.update(id, patch as any);
    const updated = await this.productRepo.findOne({ where: { id }, relations: ['variants'] });
    if (!updated) throw new NotFoundException('محصول یافت نشد');

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
    manager?: EntityManager,
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
          ...(field === 'wholesaleStock'
            ? { stock: () => `"wholesaleStock" + (${qty})` }
            : {}),
        } as any)
        .where('id = :id', { id: variantId })
        .andWhere(`"${field}" >= :need`, { need: Math.abs(qty) })
        .execute();
      if (!result.affected) {
        const variant = await variantRepo.findOne({ where: { id: variantId } });
        if (!variant) throw new NotFoundException('واریانت یافت نشد');
        throw new BadRequestException(
          `موجودی کافی نیست (واریانت ${variant.color}/${variant.size})`,
        );
      }
    } else {
      await variantRepo
        .createQueryBuilder()
        .update()
        .set({
          [field]: () => `"${field}" + (${qty})`,
          ...(field === 'wholesaleStock'
            ? { stock: () => `"wholesaleStock" + (${qty})` }
            : {}),
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
    const wholesaleSum = variants.reduce((s, v) => s + (Number(v.wholesaleStock) || Number(v.stock) || 0), 0);
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
    channel: 'WHOLESALE' | 'RETAIL' | string = 'WHOLESALE',
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
   * WHOLESALE: must be a non-negative multiple of minOrderQty; also sets legacy stock.
   * RETAIL: soft check only (no hard MOQ multiple requirement).
   */
  async setProductStock(
    productId: string,
    stock: number,
    channel: 'WHOLESALE' | 'RETAIL' | string = 'WHOLESALE',
  ) {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    const minOrderQty = Math.max(1, Number(product.minOrderQty) || 1);
    const next = Math.floor(Number(stock));
    if (!Number.isFinite(next) || next < 0) {
      throw new BadRequestException('موجودی نامعتبر است');
    }
    const field = this.stockField(channel);
    if (field === 'wholesaleStock' && next % minOrderQty !== 0) {
      throw new BadRequestException(`موجودی باید مضربی از حداقل سفارش (${minOrderQty}) باشد`);
    }
    product[field] = next;
    if (field === 'wholesaleStock') {
      product.stock = next;
    }
    return this.productRepo.save(product);
  }

  async setProductStockBySku(
    sku: string,
    stock: number,
    channel: 'WHOLESALE' | 'RETAIL' | string = 'WHOLESALE',
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
    const t = String(sizeType || 'FREE').toUpperCase();
    if (t === 'TWO') return ['سایز ۱', 'سایز ۲'];
    if (t === 'THREE') return ['سایز ۱', 'سایز ۲', 'سایز ۳'];
    return ['فری سایز'];
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
    const sizes = explicitSize
      ? [explicitSize]
      : this.sizesForProduct(product.sizeType);
    const imageUrl =
      data.imageUrl !== undefined
        ? String(data.imageUrl || '').trim() || null
        : undefined;

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
    },
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
      data.imageUrl !== undefined
        ? String(data.imageUrl || '').trim() || null
        : undefined;

    const productSizes = this.sizesForProduct(product.sizeType);
    const perSize = new Map<
      string,
      { wholesale?: number; retail?: number }
    >();

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

    const sizes = Array.from(
      new Set([...productSizes, ...Array.from(perSize.keys())]),
    );
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
        (product.variants ?? [])
          .map((v) => String(v.imageUrl || '').trim())
          .filter(Boolean),
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

  async updateVariant(variantId: string, data: Partial<ProductVariantEntity> & {
    wholesaleStock?: number;
    retailStock?: number;
    stock?: number;
  }) {
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
      const next = Math.max(
        0,
        Math.floor(Number(hasWholesale ? data.wholesaleStock : data.stock)),
      );
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
    const qb = this.productRepo.createQueryBuilder('p')
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
}
