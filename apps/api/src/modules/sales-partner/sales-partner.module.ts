import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AppSettingEntity } from '../settings/entities/app-setting.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { ProductEntity } from '../product/entities/product.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { CustomerModule } from '../customer/customer.module';
import { OrderModule } from '../order/order.module';
import { ShippingModule } from '../shipping/shipping.module';
import {
  SalesCommissionLedgerEntryEntity,
  SalesCommissionRuleEntity,
  SalesCommissionSnapshotEntity,
  SalesPartnerApplicationEntity,
  SalesPartnerAuditEventEntity,
  SalesPartnerOrderDraftEntity,
  SalesPartnerOrderDraftItemEntity,
  SalesPartnerPayoutEntity,
  SalesPartnerPayoutItemEntity,
  SalesPartnerProductEligibilityEntity,
  SalesPartnerProfileEntity,
} from './entities';
import { SalesPartnerService } from './sales-partner.service';
import { SalesPartnerCatalogService } from './sales-partner-catalog.service';
import { SalesPartnerDraftService } from './sales-partner-draft.service';
import { SalesPartnerPublicController } from './sales-partner-public.controller';
import { SalesPartnerAuthController } from './sales-partner-auth.controller';
import { SalesPartnerMeController } from './sales-partner-me.controller';
import { SalesPartnerAdminController } from './sales-partner-admin.controller';
import { SalesPartnerConfirmationController } from './sales-partner-confirmation.controller';

const ENTITIES = [
  SalesPartnerProfileEntity,
  SalesPartnerApplicationEntity,
  SalesPartnerAuditEventEntity,
  SalesCommissionRuleEntity,
  SalesPartnerProductEligibilityEntity,
  SalesPartnerOrderDraftEntity,
  SalesPartnerOrderDraftItemEntity,
  SalesCommissionSnapshotEntity,
  SalesCommissionLedgerEntryEntity,
  SalesPartnerPayoutEntity,
  SalesPartnerPayoutItemEntity,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([...ENTITIES, AppSettingEntity, UserEntity, ProductEntity, ProductVariantEntity]),
    AuthModule,
    CustomerModule,
    OrderModule,
    ShippingModule,
  ],
  controllers: [
    SalesPartnerPublicController,
    SalesPartnerAuthController,
    SalesPartnerMeController,
    SalesPartnerAdminController,
    SalesPartnerConfirmationController,
  ],
  providers: [SalesPartnerService, SalesPartnerCatalogService, SalesPartnerDraftService],
  exports: [SalesPartnerService, SalesPartnerCatalogService, SalesPartnerDraftService],
})
export class SalesPartnerModule {}
