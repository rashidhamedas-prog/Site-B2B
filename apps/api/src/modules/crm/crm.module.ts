import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { CrmApiKeyGuard } from './crm-api-key.guard';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [InventoryModule, ProductModule],
  controllers: [CrmController],
  providers: [CrmApiKeyGuard],
})
export class CrmModule {}
