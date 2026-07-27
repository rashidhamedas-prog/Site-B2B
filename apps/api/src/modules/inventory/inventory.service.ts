import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryMovementEntity } from './entities/inventory-movement.entity';
import { WarehouseEntity } from './entities/warehouse.entity';
import { ProductService } from '../product/product.service';

type StockChannel = 'WHOLESALE' | 'RETAIL';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovementEntity)
    private readonly repo: Repository<InventoryMovementEntity>,
    @InjectRepository(WarehouseEntity)
    private readonly warehouseRepo: Repository<WarehouseEntity>,
    private readonly productService: ProductService,
  ) {}

  private normalizeChannel(channel?: string): StockChannel {
    const c = String(channel || 'WHOLESALE').toUpperCase();
    return c === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
  }

  private variantChannelStock(variant: { stock?: number; wholesaleStock?: number; retailStock?: number }, channel: StockChannel) {
    if (channel === 'RETAIL') return Number(variant.retailStock) || 0;
    return Number(variant.wholesaleStock) || Number(variant.stock) || 0;
  }

  private productChannelStock(product: { stock?: number; wholesaleStock?: number; retailStock?: number }, channel: StockChannel) {
    if (channel === 'RETAIL') return Number(product.retailStock) || 0;
    return Number(product.wholesaleStock) || Number(product.stock) || 0;
  }

  /** Legacy per-variant adjust — updates channel stock and syncs product. */
  async adjust(
    productVariantId: string,
    quantity: number,
    type: string,
    notes?: string,
    createdBy?: string,
    referenceId?: string,
    channel: string = 'WHOLESALE',
    warehouseId?: string | null,
  ) {
    const ch = this.normalizeChannel(channel);
    const variant = await this.productService.getVariant(productVariantId);
    const productId = variant.productId;
    const current = this.variantChannelStock(variant, ch);

    let delta: number;
    let movementQty: number;
    let balanceAfter: number;

    if (type === 'ADJUST') {
      if (quantity < 0) throw new BadRequestException('موجودی نمی‌تواند منفی باشد');
      delta = quantity - current;
      movementQty = Math.abs(delta);
      if (delta === 0) {
        return { productId, productVariantId, stock: current, channel: ch, message: 'بدون تغییر' };
      }
      const updated = await this.productService.updateVariantStock(productVariantId, delta, ch);
      balanceAfter = this.variantChannelStock(updated, ch);
    } else {
      movementQty = Math.abs(quantity);
      delta = type === 'OUT' || type === 'SALE' || type === 'DAMAGE' ? -movementQty : movementQty;
      const updated = await this.productService.updateVariantStock(productVariantId, delta, ch);
      balanceAfter = this.variantChannelStock(updated, ch);
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
      channel: ch,
      warehouseId: warehouseId ?? null,
    });
    return this.repo.save(movement);
  }

  async setStock(
    productVariantId: string,
    stock: number,
    notes?: string,
    createdBy?: string,
    channel: string = 'WHOLESALE',
    warehouseId?: string | null,
  ) {
    return this.adjust(productVariantId, stock, 'ADJUST', notes, createdBy, undefined, channel, warehouseId);
  }

  /** Product-level absolute stock set (independent of colors). */
  async setProductStock(
    productId: string,
    stock: number,
    notes?: string,
    createdBy?: string,
    channel: string = 'WHOLESALE',
    warehouseId?: string | null,
  ) {
    const ch = this.normalizeChannel(channel);
    const before = await this.productService.findOne(productId);
    const previous = this.productChannelStock(before, ch);
    const updated = await this.productService.setProductStock(productId, stock, ch);
    const next = this.productChannelStock(updated, ch);
    const delta = next - previous;
    if (delta === 0) {
      return { productId, stock: next, channel: ch, message: 'بدون تغییر' };
    }
    const movement = this.repo.create({
      productId,
      productVariantId: null,
      type: 'ADJUST',
      quantity: Math.abs(delta),
      balanceAfter: next,
      notes: notes ?? 'تنظیم موجودی محصول',
      createdBy,
      channel: ch,
      warehouseId: warehouseId ?? null,
    });
    await this.repo.save(movement);
    return {
      productId: updated.id,
      sku: updated.sku,
      name: updated.name,
      stock: next,
      wholesaleStock: Number(updated.wholesaleStock) || Number(updated.stock) || 0,
      retailStock: Number(updated.retailStock) || 0,
      channel: ch,
      minOrderQty: updated.minOrderQty,
      updatedAt: updated.updatedAt,
    };
  }

  async setProductStockBySku(
    sku: string,
    stock: number,
    notes?: string,
    createdBy?: string,
    channel: string = 'WHOLESALE',
    warehouseId?: string | null,
  ) {
    const product = await this.productService.findBySku(sku);
    return this.setProductStock(product.id, stock, notes, createdBy, channel, warehouseId);
  }

  async bulkSetBySku(
    items: Array<{ sku: string; stock: number }>,
    notes?: string,
    createdBy?: string,
    channel: string = 'WHOLESALE',
  ) {
    if (!items?.length) throw new BadRequestException('لیست موجودی خالی است');
    const ch = this.normalizeChannel(channel);
    const results: Array<Record<string, unknown>> = [];
    const errors: Array<{ sku: string; error: string }> = [];
    for (const item of items) {
      try {
        const res = await this.setProductStockBySku(item.sku, item.stock, notes, createdBy, ch);
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
      channel: ch,
      syncedAt: new Date().toISOString(),
    };
  }

  async getMovements(productVariantId: string, page = 1, limit = 30, channel?: string) {
    const where: any = { productVariantId };
    if (channel) where.channel = this.normalizeChannel(channel);
    const [data, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getAllMovements(page = 1, limit = 30, channel?: string) {
    const where: any = {};
    if (channel) where.channel = this.normalizeChannel(channel);
    const [data, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /** Hard-delete a movement history row — does NOT reverse stock. */
  async deleteMovement(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('تحرک انبار یافت نشد');
    await this.repo.remove(row);
    return { deleted: true, id };
  }

  async getStock(page = 1, limit = 50, search?: string, filter?: string, channel?: string) {
    const ch = this.normalizeChannel(channel);
    const all = await this.productService.findAllWithVariants(search, ch);

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
      channel: ch,
      syncedAt: new Date().toISOString(),
    };
  }

  async getSummary(channel?: string) {
    const ch = this.normalizeChannel(channel);
    const all = await this.productService.findAllWithVariants(undefined, ch);
    const totalProducts = all.length;
    const totalUnits = all.reduce((s, p) => s + p.totalStock, 0);
    const lowStock = all.filter((p) => p.totalStock > 0 && p.totalStock < 10).length;
    const zeroStock = all.filter((p) => p.totalStock === 0).length;
    const totalMovements = await this.repo.count({ where: { channel: ch } });
    return {
      totalProducts,
      totalUnits,
      lowStock,
      zeroStock,
      totalMovements,
      channel: ch,
      syncedAt: new Date().toISOString(),
    };
  }

  // ── Warehouses ─────────────────────────────────────────────

  async ensureDefaults() {
    const defaults: Array<{ name: string; code: string; channel: StockChannel }> = [
      { name: 'انبار عمده', code: 'WH-WHOLESALE', channel: 'WHOLESALE' },
      { name: 'انبار تکی', code: 'WH-RETAIL', channel: 'RETAIL' },
    ];
    const out: WarehouseEntity[] = [];
    for (const d of defaults) {
      let row = await this.warehouseRepo.findOne({ where: { code: d.code } });
      if (!row) {
        row = await this.warehouseRepo.findOne({ where: { channel: d.channel, isDefault: true } });
      }
      if (!row) {
        row = await this.warehouseRepo.save(
          this.warehouseRepo.create({
            name: d.name,
            code: d.code,
            channel: d.channel,
            isActive: true,
            isDefault: true,
          }),
        );
      }
      out.push(row);
    }
    return out;
  }

  async listWarehouses(channel?: string) {
    await this.ensureDefaults();
    const where: any = {};
    if (channel) where.channel = this.normalizeChannel(channel);
    return this.warehouseRepo.find({ where, order: { isDefault: 'DESC', name: 'ASC' } });
  }

  async createWarehouse(data: Partial<WarehouseEntity>) {
    const channel = this.normalizeChannel(data.channel);
    if (!data.name?.trim()) throw new BadRequestException('نام انبار الزامی است');
    const code = (data.code || `WH-${channel}-${Date.now().toString(36)}`).toUpperCase();
    const exists = await this.warehouseRepo.findOne({ where: { code } });
    if (exists) throw new BadRequestException('کد انبار تکراری است');
    return this.warehouseRepo.save(
      this.warehouseRepo.create({
        name: data.name.trim(),
        code,
        channel,
        address: data.address ?? null,
        notes: data.notes ?? null,
        isActive: data.isActive ?? true,
        isDefault: !!data.isDefault,
      }),
    );
  }

  async updateWarehouse(id: string, data: Partial<WarehouseEntity>) {
    const row = await this.warehouseRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('انبار یافت نشد');
    if (data.name !== undefined) row.name = String(data.name).trim();
    if (data.code !== undefined) row.code = String(data.code).trim().toUpperCase();
    if (data.channel !== undefined) row.channel = this.normalizeChannel(data.channel);
    if (data.address !== undefined) row.address = data.address;
    if (data.notes !== undefined) row.notes = data.notes;
    if (data.isActive !== undefined) row.isActive = !!data.isActive;
    if (data.isDefault !== undefined) row.isDefault = !!data.isDefault;
    return this.warehouseRepo.save(row);
  }

  async deleteWarehouse(id: string) {
    const row = await this.warehouseRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('انبار یافت نشد');
    if (row.isDefault) {
      throw new BadRequestException('انبار پیش‌فرض قابل حذف نیست');
    }
    await this.warehouseRepo.remove(row);
    return { deleted: true, id };
  }
}
