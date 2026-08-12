import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../order/entities/order.entity';
import { ProductEntity } from '../product/entities/product.entity';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { TorobController } from './torob.controller';
import { TorobHealthController } from './torob-health.controller';
import { TorobService } from './torob.service';
import { TorobAuthGuard } from './torob-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, ProductEntity]), SettingsModule, AuthModule],
  controllers: [TorobController, TorobHealthController],
  providers: [TorobService, TorobAuthGuard],
  exports: [TorobService],
})
export class TorobModule {}
