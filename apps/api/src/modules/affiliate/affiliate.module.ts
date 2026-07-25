import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../order/entities/order.entity';
import { AffiliatePostbackService } from './affiliate-postback.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity])],
  providers: [AffiliatePostbackService],
  exports: [AffiliatePostbackService],
})
export class AffiliateModule {}
