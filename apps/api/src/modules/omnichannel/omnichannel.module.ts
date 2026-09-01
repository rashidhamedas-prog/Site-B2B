import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ChannelConnectionEntity } from './entities/channel-connection.entity';
import { ChannelDestinationEntity } from './entities/channel-destination.entity';
import { ChannelTemplateEntity } from './entities/channel-template.entity';
import { OutboxEventEntity } from './entities/outbox-event.entity';
import { PublicationEntity } from './entities/publication.entity';
import { PublicationDeliveryEntity } from './entities/publication-delivery.entity';
import { OmnichannelAdminController } from './controllers/omnichannel-admin.controller';
import { OmnichannelService } from './services/omnichannel.service';
import { OutboxService } from './services/outbox.service';
import { ChannelProjectionService } from './services/channel-projection.service';
import { TelegramAdapter } from './adapters/telegram.adapter';
import { BaleAdapter } from './adapters/bale.adapter';
import { RubikaAdapter } from './adapters/rubika.adapter';
import { ProductEntity } from '../product/entities/product.entity';
import { CmsPageEntity } from '../cms/entities/cms-page.entity';
import { BlogPostEntity } from '../blog/entities/blog-post.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { OmnichannelAuditEntity } from './entities/omnichannel-audit.entity';
import { OmnichannelMediaAssetEntity } from './entities/omnichannel-media-asset.entity';
import { OmnichannelAdminGuard } from './guards/omnichannel-admin.guard';
import { AppSettingEntity } from '../settings/entities/app-setting.entity';

@Global()
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ChannelConnectionEntity,
      ChannelDestinationEntity,
      ChannelTemplateEntity,
      OutboxEventEntity,
      PublicationEntity,
      PublicationDeliveryEntity,
      OmnichannelAuditEntity,
      OmnichannelMediaAssetEntity,
      ProductEntity,
      CmsPageEntity,
      BlogPostEntity,
      UserEntity,
      AppSettingEntity,
    ]),
  ],
  controllers: [OmnichannelAdminController],
  providers: [
    OmnichannelService,
    OutboxService,
    ChannelProjectionService,
    TelegramAdapter,
    BaleAdapter,
    RubikaAdapter,
    OmnichannelAdminGuard,
  ],
  exports: [OmnichannelService, OutboxService, ChannelProjectionService, TelegramAdapter],
})
export class OmnichannelModule {}
