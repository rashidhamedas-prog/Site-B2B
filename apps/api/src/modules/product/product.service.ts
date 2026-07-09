import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductVariantEntity } from './entities/product-variant.entity';
import { StorageService } from '../upload/storage.service';
import { SearchService } from '../search/search.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto } from './dto/create-variant.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variantRepo: Repository<ProductVariantEntity>,
    private readonly storage: StorageService,
    private readonly search: SearchService,
  ) {}

  private async syncSearch(product: ProductEntity) {
    await this.search.indexProduct({
      id: product.id,
      sku: product.sku,
      name: product.name,
      fabric: product.fabric,
      description: product.description,
      status: product.status,
      isFeatured: product.isFeatured,
      isNew: product.isNew,
    });
  }

  async findAll(page = 1, limit = 20, search?: string, fabric?: string, status?: string) {
    const statusFilter = status ?? 'ACTIVE';

    if (search?.trim()) {
      const ids = await this.search.searchIds(search, { status: statusFilter, fabric });
      if (ids?.length) {
        const [data, total] = await this.productRepo.findAndCount({
          where: { id: In(ids), ...(status !== 'ALL' && { status: statusFilter }), ...(fabric && { fabric }) },
          relations: ['variants'],
          skip: (page - 1) * limit,
          take: limit,
          order: { isFeatured: 'DESC', createdAt: 'DESC' },
        });
        return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
      }
    }

    const where: any[] = search
      ? [
          { name: ILike(`%${search}%`), ...(status !== 'ALL' && { status: statusFilter }) },
          { sku: ILike(`%${search}%`), ...(status !== 'ALL' && { status: statusFilter }) },
          { fabric: ILike(`%${search}%`), ...(status !== 'ALL' && { status: statusFilter }) },
        ]
      : [status === 'ALL' ? {} : { status: statusFilter }];

    if (fabric) where.forEach((w) => (w.fabric = fabric));

    const [data, total] = await this.productRepo.findAndCount({
      where,
      relations: ['variants'],
      skip: (page - 1) * limit,
      take: limit,
      order: { isFeatured: 'DESC', createdAt: 'DESC' },
    });

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const product = await this.productRepo.findOne({ where: { id }, relations: ['variants'] });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    return product;
  }

  async findBySlug(slug: string) {
    const product = await this.productRepo.findOne({ where: { slug }, relations: ['variants'] });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    return product;
  }

  async create(data: CreateProductDto) {
    const product = this.productRepo.create(data);
    const saved = await this.productRepo.save(product);
    await this.syncSearch(saved);
    return saved;
  }

  async update(id: string, data: UpdateProductDto) {
    const existing = await this.findOne(id);
    const oldImages = existing.images ?? [];

    await this.productRepo.update(id, data);
    const updated = await this.findOne(id);

    if (data.images) {
      const removed = oldImages.filter((url) => !data.images!.includes(url));
      if (removed.length) await this.storage.deleteByUrls(removed);
    }

    await this.syncSearch(updated);
    return updated;
  }

  async remove(id: string) {
    const product = await this.findOne(id);
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
    variant.stock = Math.max(0, variant.stock + delta);
    return this.variantRepo.save(variant);
  }

  async createVariant(productId: string, data: CreateVariantDto) {
    await this.findOne(productId);
    const variant = this.variantRepo.create({ ...data, productId });
    return this.variantRepo.save(variant);
  }

  async updateVariant(variantId: string, data: Partial<ProductVariantEntity>) {
    const variant = await this.variantRepo.findOne({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('واریانت یافت نشد');
    Object.assign(variant, data);
    return this.variantRepo.save(variant);
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
      fabric: p.fabric,
      status: p.status,
      wholesalePrice: p.wholesalePrice,
      minOrderQty: p.minOrderQty,
      totalStock: p.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0),
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
