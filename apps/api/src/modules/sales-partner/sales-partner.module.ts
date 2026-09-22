import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AppSettingEntity } from '../settings/entities/app-setting.entity';
import { UserEntity } from '../auth/entities/user.entity';
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
import { SalesPartnerPublicController } from './sales-partner-public.controller';
import { SalesPartnerAuthController } from './sales-partner-auth.controller';
import { SalesPartnerAdminController } from './sales-partner-admin.controller';

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
  imports: [TypeOrmModule.forFeature([...ENTITIES, AppSettingEntity, UserEntity]), AuthModule],
  controllers: [SalesPartnerPublicController, SalesPartnerAuthController, SalesPartnerAdminController],
  providers: [SalesPartnerService],
  exports: [SalesPartnerService],
})
export class SalesPartnerModule {}
