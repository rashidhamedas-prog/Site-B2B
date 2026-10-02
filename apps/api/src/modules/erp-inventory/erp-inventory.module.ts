import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpInventoryController } from './erp-inventory.controller';
import { ErpInventoryService } from './erp-inventory.service';
import { ErpInventoryApiKeyGuard } from './erp-inventory-api-key.guard';
import { ErpVariantMapEntity } from './entities/erp-variant-map.entity';
import { ErpProductMapEntity } from './entities/erp-product-map.entity';
import { ErpInventoryIdempotencyEntity } from './entities/erp-inventory-idempotency.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ErpVariantMapEntity,
      ErpProductMapEntity,
      ErpInventoryIdempotencyEntity,
      ProductVariantEntity,
    ]),
    InventoryModule,
    ProductModule,
  ],
  controllers: [ErpInventoryController],
  providers: [ErpInventoryService, ErpInventoryApiKeyGuard],
  exports: [ErpInventoryService],
})
export class ErpInventoryModule {}
