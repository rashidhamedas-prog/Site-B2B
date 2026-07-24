import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryMovementEntity } from './entities/inventory-movement.entity';
import { ProductService } from '../product/product.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovementEntity)
    private readonly repo: Repository<InventoryMovementEntity>,
    private readonly productService: ProductService,
  ) {}

  /** Legacy per-variant adjust — now updates variant stock and syncs product. */
  async adjust(
    productVariantId: string,
    quantity: number,
    type: string,
    notes?: string,
    createdBy?: string,
    referenceId?: string,
  ) {
    const variant = await this.productService.getVariant(productVariantId);
    const productId = variant.productId;
    const current = Number(variant.stock) || 0;

    let delta: number;
    let movementQty: number;
    let balanceAfter: number;

    if (type === 'ADJUST') {
      if (quantity < 0) throw new BadRequestException('موجودی نمی‌تواند منفی باشد');
      delta = quantity - current;
      movementQty = Math.abs(delta);
      if (delta === 0) {
        return { productId, productVariantId, stock: current, message: 'بدون تغییر' };
      }
      const updated = await this.productService.updateVariantStock(productVariantId, delta);
      balanceAfter = Number(updated.stock) || 0;
    } else {
      movementQty = Math.abs(quantity);
      delta = type === 'OUT' || type === 'SALE' || type === 'DAMAGE' ? -movementQty : movementQty;
      const updated = await this.productService.updateVariantStock(productVariantId, delta);
      balanceAfter = Number(updated.stock) || 0;
    }

    const movement = this.repo.create({
      productVariantId,
      productId,
      type,
      quantity: movementQty,
      balanceAfter,
      notes,
      createdBy,
      referenceId,
      referenceType: referenceId ? 'ORDER' : undefined,
    });
    return this.repo.save(movement);
  }

  async setStock(
    productVariantId: string,
    stock: number,
    notes?: string,
    createdBy?: string,
  ) {
    return this.adjust(productVariantId, stock, 'ADJUST', notes, createdBy);
  }

  /** Product-level absolute stock set (independent of colors). */
  async setProductStock(
    productId: string,
    stock: number,
    notes?: string,
    createdBy?: string,
  ) {
    const before = await this.productService.findOne(productId);
    const previous = Number(before.stock) || 0;
    const updated = await this.productService.setProductStock(productId, stock);
    const delta = updated.stock - previous;
    if (delta === 0) {
      return { productId, stock: updated.stock, message: 'بدون تغییر' };
    }
    const movement = this.repo.create({
      productId,
      productVariantId: null,
      type: 'ADJUST',
      quantity: Math.abs(delta),
      balanceAfter: updated.stock,
      notes: notes ?? 'تنظیم موجودی محصول',
      createdBy,
    });
    await this.repo.save(movement);
    return {
      productId: updated.id,
      sku: updated.sku,
      name: updated.name,
      stock: updated.stock,
      minOrderQty: updated.minOrderQty,
      updatedAt: updated.updatedAt,
    };
  }

  async setProductStockBySku(sku: string, stock: number, notes?: string, createdBy?: string) {
    const product = await this.productService.findBySku(sku);
    return this.setProductStock(product.id, stock, notes, createdBy);
  }

  async bulkSetBySku(
    items: Array<{ sku: string; stock: number }>,
    notes?: string,
    createdBy?: string,
  ) {
    if (!items?.length) throw new BadRequestException('لیست موجودی خالی است');
    const results: Array<Record<string, unknown>> = [];
    const errors: Array<{ sku: string; error: string }> = [];
    for (const item of items) {
      try {
        const res = await this.setProductStockBySku(item.sku, item.stock, notes, createdBy);
        results.push(res);
      } catch (e: unknown) {
        errors.push({
          sku: item.sku,
          error: e instanceof Error ? e.message : 'خطا',
        });
      }
    }
    return {
      updated: results.length,
      failed: errors.length,
      results,
      errors,
      syncedAt: new Date().toISOString(),
    };
  }

  async getMovements(productVariantId: string, page = 1, limit = 30) {
    const [data, total] = await this.repo.findAndCount({
      where: { productVariantId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getAllMovements(page = 1, limit = 30) {
    const [data, total] = await this.repo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getStock(page = 1, limit = 50, search?: string, filter?: string) {
    const all = await this.productService.findAllWithVariants(search);

    let filtered = all;
    if (filter === 'LOW') {
      filtered = all.filter((p) => p.totalStock > 0 && p.totalStock < 10);
    } else if (filter === 'ZERO') {
      filtered = all.filter((p) => p.totalStock === 0);
    }

    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      syncedAt: new Date().toISOString(),
    };
  }

  async getSummary() {
    const all = await this.productService.findAllWithVariants();
    const totalProducts = all.length;
    const totalUnits = all.reduce((s, p) => s + p.totalStock, 0);
    const lowStock = all.filter((p) => p.totalStock > 0 && p.totalStock < 10).length;
    const zeroStock = all.filter((p) => p.totalStock === 0).length;
    const totalMovements = await this.repo.count();
    return {
      totalProducts,
      totalUnits,
      lowStock,
      zeroStock,
      totalMovements,
      syncedAt: new Date().toISOString(),
    };
  }
}
