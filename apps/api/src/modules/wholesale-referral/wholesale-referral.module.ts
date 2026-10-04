import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AppSettingEntity } from '../settings/entities/app-setting.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { OrderItemEntity } from '../order/entities/order-item.entity';
import { PaymentEntity } from '../payment/entities/payment.entity';
import { RefundEntity } from '../payment/entities/refund.entity';
import { ReturnRequestEntity } from '../rma/entities/return-request.entity';
import { WholesaleReferralPartnerEntity } from './entities/wholesale-referral-partner.entity';
import { WholesaleReferralIntroductionEntity } from './entities/wholesale-referral-introduction.entity';
import { WholesaleReferralEventEntity } from './entities/wholesale-referral-event.entity';
import { WholesaleReferralLedgerEntryEntity } from './entities/wholesale-referral-ledger-entry.entity';
import { WholesaleReferralDisputeEntity } from './entities/wholesale-referral-dispute.entity';
import { WholesaleReferralAuditEntity } from './entities/wholesale-referral-audit.entity';
import { WholesaleReferralTermsAcceptanceEntity } from './entities/wholesale-referral-terms-acceptance.entity';
import { WholesaleReferralClickEntity } from './entities/wholesale-referral-click.entity';
import { WholesaleReferralService } from './wholesale-referral.service';
import {
  WholesaleReferralAdminController,
  WholesaleReferralPartnerController,
  WholesaleReferralPublicController,
} from './wholesale-referral.controller';
import { WHOLESALE_REFERRAL_CAPTURE } from './wholesale-referral-capture';

const ENTITIES = [
  WholesaleReferralPartnerEntity,
  WholesaleReferralIntroductionEntity,
  WholesaleReferralEventEntity,
  WholesaleReferralLedgerEntryEntity,
  WholesaleReferralDisputeEntity,
  WholesaleReferralAuditEntity,
  WholesaleReferralTermsAcceptanceEntity,
  WholesaleReferralClickEntity,
  AppSettingEntity,
  UserEntity,
  CustomerEntity,
  OrderEntity,
  OrderItemEntity,
  PaymentEntity,
  RefundEntity,
  ReturnRequestEntity,
];

@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES), forwardRef(() => AuthModule)],
  controllers: [
    WholesaleReferralPublicController,
    WholesaleReferralPartnerController,
    WholesaleReferralAdminController,
  ],
  providers: [
    WholesaleReferralService,
    { provide: WHOLESALE_REFERRAL_CAPTURE, useExisting: WholesaleReferralService },
  ],
  exports: [WholesaleReferralService, WHOLESALE_REFERRAL_CAPTURE],
})
export class WholesaleReferralModule {}
