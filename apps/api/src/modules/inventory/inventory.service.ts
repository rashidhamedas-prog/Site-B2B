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

  async adjust(
    productVariantId: string,
    quantity: number,
    type: string,
    notes?: string,
    createdBy?: string,
    referenceId?: string,
  ) {
    const variant = await this.productService.getVariant(productVariantId);
    const minOrderQty = Math.max(1, Number(variant.product?.minOrderQty) || 1);

    let delta: number;
    let movementQty: number;

    if (type === 'ADJUST') {
      if (quantity < 0) throw new BadRequestException('موجودی نمی‌تواند منفی باشد');
      if (quantity % minOrderQty !== 0) {
        throw new BadRequestException(`موجودی باید مضربی از حداقل سفارش (${minOrderQty}) باشد`);
      }
      delta = quantity - variant.stock;
      movementQty = Math.abs(delta);
      if (delta === 0) {
        return { productVariantId, stock: variant.stock, message: 'بدون تغییر' };
      }
    } else {
      movementQty = Math.abs(quantity);
      delta = type === 'OUT' || type === 'SALE' || type === 'DAMAGE' ? -movementQty : movementQty;
    }

    const updated = await this.productService.updateVariantStock(productVariantId, delta);
    const movement = this.repo.create({
      productVariantId,
      type,
      quantity: movementQty,
      balanceAfter: updated.stock,
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
    };
  }

  async getSummary() {
    const all = await this.productService.findAllWithVariants();
    const totalProducts = all.length;
    const totalUnits = all.reduce((s, p) => s + p.totalStock, 0);
    const lowStock = all.filter((p) => p.totalStock > 0 && p.totalStock < 10).length;
    const zeroStock = all.filter((p) => p.totalStock === 0).length;
    const totalMovements = await this.repo.count();
    return { totalProducts, totalUnits, lowStock, zeroStock, totalMovements };
  }
}
