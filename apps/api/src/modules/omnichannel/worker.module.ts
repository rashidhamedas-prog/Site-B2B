import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from '../../config/database.config';
import { SearchModule } from '../search/search.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationModule } from '../notification/notification.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { ProductEntity } from '../product/entities/product.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { PublicationDeliveryEntity } from './entities/publication-delivery.entity';
import { ChannelDestinationEntity } from './entities/channel-destination.entity';
import { ChannelConnectionEntity } from './entities/channel-connection.entity';
import { OmnichannelModule } from './omnichannel.module';
import { OutboxWorkerService } from './services/outbox-worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: databaseConfig,
    }),
    TypeOrmModule.forFeature([
      ProductEntity,
      OrderEntity,
      CustomerEntity,
      PublicationDeliveryEntity,
      ChannelDestinationEntity,
      ChannelConnectionEntity,
    ]),
    SearchModule,
    SettingsModule,
    NotificationModule,
    AffiliateModule,
    OmnichannelModule,
  ],
  providers: [OutboxWorkerService],
})
export class WorkerModule {}
