import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InventoryMovementEntity } from './entities/inventory-movement.entity';
import { WarehouseEntity } from './entities/warehouse.entity';
import { ProductService } from '../product/product.service';
import { channelUnitStock } from '../product/channel-product-projection';
import { OutboxService } from '../omnichannel/services/outbox.service';
import { OUTBOX_EVENT_TYPES } from '../omnichannel/omnichannel.constants';
import {
  canReverseFromInventoryUi,
  normalizeStockChannel,
  signedDeltaForMovement,
  withAdjustDeltaNote,
  type StockChannel,
} from './inventory-movement.policy';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovementEntity)
    private readonly repo: Repository<InventoryMovementEntity>,
    @InjectRepository(WarehouseEntity)
    private readonly warehouseRepo: Repository<WarehouseEntity>,
    private readonly productService: ProductService,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  private async enqueueStockChanged(
    manager: EntityManager,
    input: {
      operationId: string;
      productId: string;
      productVariantId?: string | null;
      channel: string;
      balanceAfter: number;
    },
  ) {
    await this.outbox.enqueue(
      {
        operationId: input.operationId,
        eventType: OUTBOX_EVENT_TYPES.PRODUCT_STOCK_CHANGED,
        aggregateType: 'PRODUCT',
        aggregateId: input.productId,
        channel: input.channel,
        payload: {
          productId: input.productId,
          productVariantId: input.productVariantId ?? null,
          balanceAfter: input.balanceAfter,
          channel: input.channel,
        },
      },
      manager,
    );
    await this.outbox.enqueue(
      {
        operationId: `${input.operationId}:search`,
        eventType: OUTBOX_EVENT_TYPES.SEARCH_REINDEX_REQUESTED,
        aggregateType: 'PRODUCT',
        aggregateId: input.productId,
        payload: { productId: input.productId },
      },
      manager,
    );
  }

  private normalizeChannel(channel?: string): StockChannel {
    return normalizeStockChannel(channel);
  }

  private variantChannelStock(variant: { stock?: number; wholesaleStock?: number; retailStock?: number }, channel: StockChannel) {
    return channelUnitStock(variant, channel);
  }

  private productChannelStock(product: { stock?: number; wholesaleStock?: number; retailStock?: number }, channel: StockChannel) {
    return channelUnitStock(product, channel);
  }

  async recordMovement(
    data: Partial<InventoryMovementEntity>,
    manager?: EntityManager,
  ) {
    const repo = manager?.getRepository(InventoryMovementEntity) ?? this.repo;
    return repo.save(repo.create(data));
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
    manager?: EntityManager,
  ) {
    const run = async (txn: EntityManager) => {
      const ch = this.normalizeChannel(channel);
      const variant = await this.productService.getVariant(productVariantId);
      const productId = variant.productId;
      const current = this.variantChannelStock(variant, ch);

      let delta: number;
      let movementQty: number;
      let movementNotes = notes;

      if (type === 'ADJUST') {
        if (quantity < 0) throw new BadRequestException('موجودی نمی‌تواند منفی باشد');
        delta = quantity - current;
        movementQty = Math.abs(delta);
        if (delta === 0) {
          return { productId, productVariantId, stock: current, channel: ch, message: 'بدون تغییر' };
        }
        movementNotes = withAdjustDeltaNote(notes, delta);
      } else {
        movementQty = Math.abs(quantity);
        delta = type === 'OUT' || type === 'SALE' || type === 'DAMAGE' ? -movementQty : movementQty;
      }

      const updated = await this.productService.updateVariantStock(productVariantId, delta, ch, txn);
      const balanceAfter = this.variantChannelStock(updated, ch);
      const movement = await this.recordMovement(
        {
          productVariantId,
          productId,
          type,
          quantity: movementQty,
          balanceAfter,
          notes: movementNotes,
          createdBy,
          referenceId,
          referenceType: referenceId ? 'ORDER' : undefined,
          channel: ch,
          warehouseId: warehouseId ?? null,
        },
        txn,
      );
      await this.enqueueStockChanged(txn, {
        operationId: movement.id,
        productId,
        productVariantId,
        channel: ch,
        balanceAfter,
      });
      return movement;
    };

    if (manager) return run(manager);
    return this.dataSource.transaction(run);
  }

  async setStock(
    productVariantId: string,
    stock: number,
    notes?: string,
    createdBy?: string,
    channel: string = 'WHOLESALE',
    warehouseId?: string | null,
    manager?: EntityManager,
  ) {
    return this.adjust(productVariantId, stock, 'ADJUST', notes, createdBy, undefined, channel, warehouseId, manager);
  }

  async applyVariantStocks(
    variantId: string,
    stocks: { wholesale?: number; retail?: number },
    notes: string,
    createdBy?: string,
    manager?: EntityManager,
  ) {
    const run = async (txn: EntityManager) => {
      if (stocks.wholesale !== undefined) {
        await this.setStock(variantId, stocks.wholesale, notes, createdBy, 'WHOLESALE', null, txn);
      }
      if (stocks.retail !== undefined) {
        await this.setStock(variantId, stocks.retail, notes, createdBy, 'RETAIL', null, txn);
      }
    };
    if (manager) return run(manager);
    return this.dataSource.transaction(run);
  }

  async applyPlanToVariants(
    variants: Array<{ id: string; size?: string }>,
    plan: Map<string, { wholesale?: number; retail?: number }>,
    notes: string,
    createdBy?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      for (const variant of variants) {
        const stocks = plan.get(String(variant.size || ''));
        if (!stocks) continue;
        await this.applyVariantStocks(variant.id, stocks, notes, createdBy, manager);
      }
    });
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
    return this.dataSource.transaction(async (manager) => {
    const before = await this.productService.findOne(productId, undefined, { allowNonActive: true });
    const previous = this.productChannelStock(before, ch);
    const updated = await this.productService.setProductStock(productId, stock, ch, manager);
    const next = this.productChannelStock(updated, ch);
    const delta = next - previous;
    if (delta === 0) {
      return { productId, stock: next, channel: ch, message: 'بدون تغییر' };
    }
    const movement = await this.recordMovement({
      productId,
      productVariantId: null,
      type: 'ADJUST',
      quantity: Math.abs(delta),
      balanceAfter: next,
      notes: withAdjustDeltaNote(notes ?? 'تنظیم موجودی محصول', delta),
      createdBy,
      channel: ch,
      warehouseId: warehouseId ?? null,
    }, manager);
    await this.enqueueStockChanged(manager, {
      operationId: movement.id,
      productId,
      channel: ch,
      balanceAfter: next,
    });
    return {
      productId: updated.id,
      sku: updated.sku,
      name: updated.name,
      stock: next,
      wholesaleStock: channelUnitStock(updated, 'WHOLESALE'),
      retailStock: Number(updated.retailStock) || 0,
      channel: ch,
      minOrderQty: updated.minOrderQty,
      updatedAt: updated.updatedAt,
    };
    });
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

  /** Immutable reverse: keep the original row and write a REVERSAL that undoes stock. */
  async reverseMovement(id: string, createdBy?: string) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(InventoryMovementEntity);
      const row = await repo.findOne({ where: { id } });
      if (!row) throw new NotFoundException('تحرک انبار یافت نشد');
      if (!canReverseFromInventoryUi(row)) {
        if (String(row.referenceType || '').toUpperCase() === 'ORDER') {
          throw new BadRequestException('حرکت سفارش فقط از لغو/حذف سفارش برگشت می‌شود');
        }
        if (String(row.referenceType || '').toUpperCase() === 'RMA') {
          throw new BadRequestException('حرکت مرجوعی از مسیر RMA برگشت می‌شود');
        }
        throw new BadRequestException('این حرکت قابل برگشت نیست');
      }
      const existing = await repo.findOne({
        where: { referenceId: row.id, referenceType: 'MOVEMENT', type: 'REVERSAL' },
      });
      if (existing) return existing;

      let undo: number;
      try {
        undo = -signedDeltaForMovement(row.type, row.quantity, row.notes);
      } catch (err) {
        throw new BadRequestException(err instanceof Error ? err.message : 'برگشت ممکن نیست');
      }
      if (undo === 0) {
        throw new BadRequestException('این حرکت موجودی را تغییر نداده است');
      }

      let balanceAfter = 0;
      if (row.productVariantId) {
        const updated = await this.productService.updateVariantStock(
          row.productVariantId,
          undo,
          row.channel,
          manager,
        );
        balanceAfter = this.variantChannelStock(updated, this.normalizeChannel(row.channel));
      } else if (row.productId) {
        const updated = await this.productService.updateProductStock(
          row.productId,
          undo,
          row.channel,
          manager,
        );
        balanceAfter = this.productChannelStock(updated, this.normalizeChannel(row.channel));
      } else {
        throw new BadRequestException('حرکت بدون محصول قابل برگشت نیست');
      }

      const reversal = await this.recordMovement(
        {
          productVariantId: row.productVariantId,
          productId: row.productId,
          type: 'REVERSAL',
          quantity: Math.abs(undo),
          balanceAfter,
          notes: `برگشت حرکت ${row.id}`,
          createdBy,
          referenceId: row.id,
          referenceType: 'MOVEMENT',
          channel: row.channel,
          warehouseId: row.warehouseId,
        },
        manager,
      );
      if (row.productId) {
        await this.enqueueStockChanged(manager, {
          operationId: reversal.id,
          productId: row.productId,
          productVariantId: row.productVariantId,
          channel: row.channel || 'WHOLESALE',
          balanceAfter,
        });
      }
      return reversal;
    });
  }

  /** @deprecated Use reverseMovement — history rows are immutable. */
  async deleteMovement(id: string, createdBy?: string) {
    return this.reverseMovement(id, createdBy);
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
