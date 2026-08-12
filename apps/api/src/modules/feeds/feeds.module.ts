import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from '../product/entities/product.entity';
import { FeedsController } from './feeds.controller';
import { FeedsHealthController } from './feeds-health.controller';
import { FeedsHealthHook } from './feeds-health.hook';
import { FeedsHealthService } from './feeds-health.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  controllers: [FeedsController, FeedsHealthController],
  providers: [FeedsHealthService, FeedsHealthHook],
})
export class FeedsModule {}
