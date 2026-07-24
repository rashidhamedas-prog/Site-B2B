import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductVariantEntity } from './entities/product-variant.entity';
import { CategoryEntity } from '../category/entities/category.entity';
import { VariantColorEntity } from './entities/variant-color.entity';
import { VariantSizeEntity } from './entities/variant-size.entity';
import { ProductSpecMemoryEntity } from './entities/product-spec-memory.entity';
import { ProductSizeType, ProductSpecs, SIZE_GUIDE, SPEC_FIELD_KEYS } from './entities/product-specs';
import { StorageService } from '../upload/storage.service';
import { SearchService } from '../search/search.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';

const NEW_BADGE_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ProductService {
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
  ) {}

  private fabricFromSpecs(specs?: ProductSpecs | null, fallback?: string): string {
    return (specs?.fabricType || fallback || '').trim();
  }

  private withBadges<T extends ProductEntity>(product: T) {
    const stock = Number.isFinite(Number(product.stock)) ? Number(product.stock) || 0 : 0;
    const minOrder = Math.max(1, Number(product.minOrderQty) || 1);
    const createdAt = product.createdAt ? new Date(product.createdAt).getTime() : 0;
    const isNewAuto = createdAt > 0 && Date.now() - createdAt < NEW_BADGE_MS;
    const isLimitedStock = stock > 0 && stock <= minOrder * 2;
    const sizeType = (product.sizeType || 'FREE') as ProductSizeType;
    return {
      ...product,
      stock,
      fabric: this.fabricFromSpecs(product.specs, product.fabric),
      isNew: isNewAuto,
      isFeatured: !!product.isDiscounted,
      isDiscounted: !!product.isDiscounted,
      isLimitedStock,
      totalStock: stock,
      sizeGuide: SIZE_GUIDE[sizeType] ?? SIZE_GUIDE.FREE,
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
    await this.search.indexProduct({
      id: product.id,
      sku: product.sku,
      name: product.name,
      fabric: this.fabricFromSpecs(product.specs, product.fabric),
      description: product.description,
      status: product.status,
      isFeatured: !!product.isDiscounted,
      isNew: product.createdAt
        ? Date.now() - new Date(product.createdAt).getTime() < NEW_BADGE_MS
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

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.variants', 'v')
      .where('p.deletedAt IS NULL');

    if (status !== 'ALL') qb.andWhere('p.status = :status', { status: statusFilter });
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

    qb.orderBy('p.isDiscounted', 'DESC').addOrderBy('p.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb.skip((page - 1) * limit).take(limit).getMany();
    return {
      data: data.map((p) => this.withBadges(p)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findComingSoon(limit = 12) {
    const data = await this.productRepo.find({
      where: [{ status: 'COMING_SOON' }, { isPreOrder: true, status: 'ACTIVE' }],
      relations: ['variants'],
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 48),
    });
    return data.map((p) => this.withBadges(p));
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

  async listColors() {
    return this.colorRepo.find({ order: { updatedAt: 'DESC' }, take: 200 });
  }

  async findOne(id: string) {
    const product = await this.productRepo.findOne({ where: { id }, relations: ['variants'] });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    return this.withBadges(product);
  }

  async findBySlug(slug: string) {
    const product = await this.productRepo.findOne({ where: { slug }, relations: ['variants'] });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    return this.withBadges(product);
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
    });
    const saved = await this.productRepo.save(product);
    await this.rememberSpecs(specs);
    await this.syncSearch(saved);
    return this.withBadges(await this.productRepo.findOne({ where: { id: saved.id }, relations: ['variants'] }) as ProductEntity);
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

    await this.productRepo.update(id, patch as any);
    const updated = await this.productRepo.findOne({ where: { id }, relations: ['variants'] });
    if (!updated) throw new NotFoundException('محصول یافت نشد');

    if (data.images) {
      const removed = oldImages.filter((url) => !data.images!.includes(url));
      if (removed.length) await this.storage.deleteByUrls(removed);
    }

    await this.syncSearch(updated);
    return this.withBadges(updated);
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

  async updateVariantStock(variantId: string, delta: number) {
    const variant = await this.variantRepo.findOne({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('واریانت یافت نشد');
    variant.stock = Math.max(0, (Number(variant.stock) || 0) + delta);
    await this.variantRepo.save(variant);
    await this.syncProductStockFromVariants(variant.productId);
    return variant;
  }

  /** Sum variant stocks onto product.stock (retail truth). */
  async syncProductStockFromVariants(productId: string) {
    const variants = await this.variantRepo.find({ where: { productId } });
    const sum = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    await this.productRepo.update(productId, { stock: sum });
    return sum;
  }

  /** Adjust product-level stock by delta (orders deduct with negative delta). */
  async updateProductStock(productId: string, delta: number) {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    product.stock = Math.max(0, (Number(product.stock) || 0) + delta);
    return this.productRepo.save(product);
  }

  /**
   * Set absolute product-level stock (independent of colors).
   * Must be a non-negative multiple of minOrderQty.
   */
  async setProductStock(productId: string, stock: number) {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    const minOrderQty = Math.max(1, Number(product.minOrderQty) || 1);
    const next = Math.floor(Number(stock));
    if (!Number.isFinite(next) || next < 0) {
      throw new BadRequestException('موجودی نامعتبر است');
    }
    if (next % minOrderQty !== 0) {
      throw new BadRequestException(`موجودی باید مضربی از حداقل سفارش (${minOrderQty}) باشد`);
    }
    product.stock = next;
    return this.productRepo.save(product);
  }

  async setProductStockBySku(sku: string, stock: number) {
    const product = await this.productRepo.findOne({ where: { sku: String(sku).trim() } });
    if (!product) throw new NotFoundException(`محصول با SKU «${sku}» یافت نشد`);
    return this.setProductStock(product.id, stock);
  }

  async findBySku(sku: string) {
    const product = await this.productRepo.findOne({
      where: { sku: String(sku).trim() },
      relations: ['variants'],
    });
    if (!product) throw new NotFoundException(`محصول با SKU «${sku}» یافت نشد`);
    return this.withBadges(product);
  }

  private sizeLabelForProduct(product: ProductEntity): string {
    const map: Record<string, string> = {
      TWO: 'محصول ۲ سایزی',
      THREE: 'محصول ۳ سایزی',
      FREE: 'محصول فری سایز',
    };
    return map[product.sizeType] || 'محصول فری سایز';
  }

  async createVariant(productId: string, data: CreateVariantDto) {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('محصول یافت نشد');

    const colorName = String(data.color ?? '').trim();
    const sizeLabel = String(data.size ?? '').trim() || this.sizeLabelForProduct(product);
    const colorHex = String((data as any).colorHex ?? '').trim();

    const color = await this.upsertColor(colorName, colorHex || undefined);
    const size = await this.upsertSize(sizeLabel);

    const variant = this.variantRepo.create({
      ...data,
      productId,
      stock: 0,
      color: color.name,
      colorHex: color.hex ?? (data as any).colorHex ?? '',
      size: size.label,
      colorId: color.id,
      sizeId: size.id,
    } as any);
    return this.variantRepo.save(variant);
  }

  async updateVariant(variantId: string, data: Partial<ProductVariantEntity>) {
    const variant = await this.variantRepo.findOne({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('واریانت یافت نشد');

    if (typeof (data as any).stock === 'number') {
      throw new BadRequestException('موجودی فقط از بخش انبار قابل تغییر است');
    }

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

    Object.assign(variant, { ...data, color: variant.color, size: variant.size, stock: variant.stock });
    return this.variantRepo.save(variant);
  }

  private async upsertColor(name: string, hex?: string) {
    const n = String(name ?? '').trim();
    if (!n) throw new BadRequestException('رنگ الزامی است');
    const existing = await this.colorRepo.findOne({ where: { name: n } });
    if (existing) {
      if (hex && !existing.hex) {
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
    await this.variantRepo.remove(variant);
    return { message: 'واریانت حذف شد' };
  }

  async findAllWithVariants(search?: string) {
    const qb = this.productRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.variants', 'v')
      .where('p.deletedAt IS NULL')
      .orderBy('p.name', 'ASC');

    if (search) {
      qb.andWhere('(p.name ILIKE :s OR p.sku ILIKE :s)', { s: `%${search}%` });
    }

    const products = await qb.getMany();
    return products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      fabric: this.fabricFromSpecs(p.specs, p.fabric),
      status: p.status,
      wholesalePrice: p.wholesalePrice,
      minOrderQty: p.minOrderQty,
      stock: Number(p.stock) || 0,
      totalStock: Number(p.stock) || 0,
      variants: p.variants.map((v) => ({
        id: v.id,
        color: v.color,
        colorHex: v.colorHex,
        size: v.size,
        stock: v.stock,
        barcode: v.barcode,
      })),
    }));
  }

  async getVariant(variantId: string) {
    const v = await this.variantRepo.findOne({ where: { id: variantId }, relations: ['product'] });
    if (!v) throw new NotFoundException('واریانت یافت نشد');
    return v;
  }
}
