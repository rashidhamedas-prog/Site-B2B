import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../order/entities/order.entity';
import { ProductEntity } from '../product/entities/product.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { TorobController } from './torob.controller';
import { TorobHealthController } from './torob-health.controller';
import { TorobProductApiController } from './torob-product-api.controller';
import { TorobService } from './torob.service';
import { TorobProductApiService } from './torob-product-api.service';
import { TorobAuthGuard, TorobProductAuthGuard } from './torob-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, ProductEntity, ProductVariantEntity]),
    SettingsModule,
    AuthModule,
  ],
  controllers: [TorobController, TorobHealthController, TorobProductApiController],
  providers: [TorobService, TorobProductApiService, TorobAuthGuard, TorobProductAuthGuard],
  exports: [TorobService, TorobProductApiService],
})
export class TorobModule {}
