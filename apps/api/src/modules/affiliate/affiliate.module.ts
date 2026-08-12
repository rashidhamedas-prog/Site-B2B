import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../order/entities/order.entity';
import { AuthModule } from '../auth/auth.module';
import { AffiliateController } from './affiliate.controller';
import { AffiliatePostbackService } from './affiliate-postback.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity]), AuthModule],
  controllers: [AffiliateController],
  providers: [AffiliatePostbackService],
  exports: [AffiliatePostbackService],
})
export class AffiliateModule {}
