import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationModule } from '../notification/notification.module';
import { UserEntity } from '../auth/entities/user.entity';
import { MarketingConsentEntity } from '../customer-marketing/entities/marketing-consent.entity';
import { MarketingSuppressionEntity } from '../customer-marketing/entities/marketing-suppression.entity';
import { SmsPanelRateLimit } from './sms-panel.rate-limit';
import { SMS_PANEL_ENTITIES } from './entities/sms-panel.entities';
import { SmsPanelController } from './sms-panel.controller';
import { SmsPanelService } from './sms-panel.service';
import { SmsPanelJobs } from './sms-panel.jobs';
import { SmsProviderService } from './provider/sms-provider.service';
import { SmsRolesGuard } from './sms-roles';
import { AudienceService } from './audience/audience.service';
import { SegmentService } from './audience/segment.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    SettingsModule,
    forwardRef(() => NotificationModule),
    TypeOrmModule.forFeature([
      ...SMS_PANEL_ENTITIES,
      MarketingConsentEntity,
      MarketingSuppressionEntity,
      UserEntity,
    ]),
  ],
  controllers: [SmsPanelController],
  providers: [SmsPanelService, SmsPanelJobs, SmsProviderService, SmsRolesGuard, SmsPanelRateLimit, AudienceService, SegmentService],
  exports: [SmsPanelService, SmsProviderService],
})
export class SmsPanelModule {}
