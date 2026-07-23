import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from '../product/entities/product.entity';
import { FeedsController } from './feeds.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  controllers: [FeedsController],
})
export class FeedsModule {}
