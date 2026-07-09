import { Injectable } from '@nestjs/common';
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
    const delta = type === 'OUT' || type === 'SALE' ? -Math.abs(quantity) : Math.abs(quantity);
    const variant = await this.productService.updateVariantStock(productVariantId, delta);
    const movement = this.repo.create({
      productVariantId,
      type,
      quantity: Math.abs(quantity),
      balanceAfter: variant.stock,
      notes,
      createdBy,
      referenceId,
      referenceType: referenceId ? 'ORDER' : undefined,
    });
    return this.repo.save(movement);
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
