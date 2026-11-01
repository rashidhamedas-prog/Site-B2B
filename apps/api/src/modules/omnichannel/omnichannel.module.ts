import { Global, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ChannelConnectionEntity } from './entities/channel-connection.entity';
import { ChannelDestinationEntity } from './entities/channel-destination.entity';
import { ChannelTemplateEntity } from './entities/channel-template.entity';
import { OutboxEventEntity } from './entities/outbox-event.entity';
import { PublicationEntity } from './entities/publication.entity';
import { PublicationDeliveryEntity } from './entities/publication-delivery.entity';
import { OmnichannelPostBackupEntity } from './entities/omnichannel-post-backup.entity';
import { OmnichannelDeliveryMessageEntity } from './entities/omnichannel-delivery-message.entity';
import { OmnichannelCoverageAbsenceEntity } from './entities/omnichannel-coverage-absence.entity';
import { OmnichannelBotConversationEntity } from './entities/omnichannel-bot-conversation.entity';
import { OmnichannelBotMessageEntity } from './entities/omnichannel-bot-message.entity';
import { OmnichannelAlertEntity } from './entities/omnichannel-alert.entity';
import { OmnichannelAdminController } from './controllers/omnichannel-admin.controller';
import { OmnichannelBotWebhookController } from './controllers/omnichannel-bot-webhook.controller';
import { OmnichannelService } from './services/omnichannel.service';
import { OmnichannelDeleteService } from './services/omnichannel-delete.service';
import { OmnichannelEditService } from './services/omnichannel-edit.service';
import { OmnichannelHealthService } from './services/omnichannel-health';
import { OmnichannelCoverageService } from './services/omnichannel-coverage.service';
import { OmnichannelComposerService } from './services/omnichannel-composer.service';
import { OmnichannelSettingsService } from './services/omnichannel-settings.service';
import { OmnichannelMediaService } from './services/omnichannel-media.service';
import { OmnichannelAlertsService } from './services/omnichannel-alerts.service';
import { OmnichannelBotInboundService } from './services/omnichannel-bot-inbound.service';
import { OmnichannelBotInboxService } from './services/omnichannel-bot-inbox.service';
import { OmnichannelBotPollerService } from './services/omnichannel-bot-poller.service';
import { OutboxService } from './services/outbox.service';
import { ChannelProjectionService } from './services/channel-projection.service';
import { TelegramAdapter } from './adapters/telegram.adapter';
import { BaleAdapter } from './adapters/bale.adapter';
import { RubikaAdapter } from './adapters/rubika.adapter';
import { ChannelAdapterRegistry } from './adapters/adapter-registry';
import { ProductEntity } from '../product/entities/product.entity';
import { ProductCategoryMembershipEntity } from '../product/entities/product-category-membership.entity';
import { CmsPageEntity } from '../cms/entities/cms-page.entity';
import { BlogPostEntity } from '../blog/entities/blog-post.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { OmnichannelAuditEntity } from './entities/omnichannel-audit.entity';
import { OmnichannelMediaAssetEntity } from './entities/omnichannel-media-asset.entity';
import { OmnichannelAdminGuard } from './guards/omnichannel-admin.guard';
import { OmnichannelRoleGuard } from './guards/omnichannel-role.guard';
import { OmnichannelTokenVaultService } from './services/omnichannel-token-vault.service';
import { AppSettingEntity } from '../settings/entities/app-setting.entity';
import { UploadModule } from '../upload/upload.module';
import { StorageService } from '../upload/storage.service';
import { ProductModule } from '../product/product.module';
import { CustomerModule } from '../customer/customer.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Global()
@Module({
  imports: [
    AuthModule,
    UploadModule,
    forwardRef(() => ProductModule),
    forwardRef(() => CustomerModule),
    forwardRef(() => InvoiceModule),
    TypeOrmModule.forFeature([
      ChannelConnectionEntity,
      ChannelDestinationEntity,
      ChannelTemplateEntity,
      OutboxEventEntity,
      PublicationEntity,
      PublicationDeliveryEntity,
      OmnichannelPostBackupEntity,
      OmnichannelDeliveryMessageEntity,
      OmnichannelCoverageAbsenceEntity,
      OmnichannelBotConversationEntity,
      OmnichannelBotMessageEntity,
      OmnichannelAlertEntity,
      OmnichannelAuditEntity,
      OmnichannelMediaAssetEntity,
      ProductEntity,
      ProductCategoryMembershipEntity,
      CmsPageEntity,
      BlogPostEntity,
      UserEntity,
      AppSettingEntity,
    ]),
  ],
  controllers: [OmnichannelAdminController, OmnichannelBotWebhookController],
  providers: [
    OmnichannelService,
    OmnichannelDeleteService,
    OmnichannelEditService,
    OmnichannelHealthService,
    OmnichannelCoverageService,
    OmnichannelComposerService,
    OmnichannelSettingsService,
    OmnichannelMediaService,
    OmnichannelAlertsService,
    OmnichannelBotInboundService,
    OmnichannelBotInboxService,
    OmnichannelBotPollerService,
    OutboxService,
    ChannelProjectionService,
    {
      provide: TelegramAdapter,
      useFactory: (storage: StorageService) => {
        const adapter = new TelegramAdapter();
        adapter.images = storage;
        return adapter;
      },
      inject: [StorageService],
    },
    {
      provide: BaleAdapter,
      useFactory: (storage: StorageService) => {
        const adapter = new BaleAdapter();
        adapter.images = storage;
        return adapter;
      },
      inject: [StorageService],
    },
    RubikaAdapter,
    ChannelAdapterRegistry,
    OmnichannelAdminGuard,
    OmnichannelRoleGuard,
    OmnichannelTokenVaultService,
  ],
  exports: [
    OmnichannelService,
    OutboxService,
    ChannelProjectionService,
    TelegramAdapter,
    ChannelAdapterRegistry,
    OmnichannelTokenVaultService,
    OmnichannelAlertsService,
    OmnichannelBotInboundService,
    OmnichannelBotInboxService,
    OmnichannelBotPollerService,
  ],
})
export class OmnichannelModule {}
