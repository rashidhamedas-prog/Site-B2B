import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { UserEntity } from '../auth/entities/user.entity';
import {
  MarketingActivityEntity,
  MarketingCampaignEntity,
  MarketingConsentEntity,
  MarketingEnrollmentEntity,
  MarketingFunnelEntity,
  MarketingFunnelStepEntity,
  MarketingSendEntity,
  MarketingSuppressionEntity,
  MarketingTemplateEntity,
} from './entities';
import { CustomerMarketingService } from './customer-marketing.service';
import { MarketingSmsSender } from './marketing-sms.sender';
import { MarketingSeedService } from './marketing-seed.service';
import { CustomerMarketingJobs } from './customer-marketing.jobs';
import { MarketingController } from './marketing.controller';
import { CustomerMarketingController } from './customer-marketing.controller';

const ENTITIES = [
  MarketingConsentEntity,
  MarketingSuppressionEntity,
  MarketingFunnelEntity,
  MarketingFunnelStepEntity,
  MarketingEnrollmentEntity,
  MarketingTemplateEntity,
  MarketingCampaignEntity,
  MarketingSendEntity,
  MarketingActivityEntity,
  CustomerEntity,
  OrderEntity,
  UserEntity,
];

@Global()
@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  controllers: [MarketingController, CustomerMarketingController],
  providers: [
    CustomerMarketingService,
    MarketingSmsSender,
    MarketingSeedService,
    CustomerMarketingJobs,
  ],
  exports: [CustomerMarketingService, MarketingSmsSender],
})
export class CustomerMarketingModule {}
