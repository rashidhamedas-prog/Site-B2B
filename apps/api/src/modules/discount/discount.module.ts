import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountCodeEntity } from './entities/discount-code.entity';
import { TieredDiscountEntity } from './entities/tiered-discount.entity';
import { SideDiscountEntity } from './entities/side-discount.entity';
import { DiscountService } from './discount.service';
import { DiscountController } from './discount.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([DiscountCodeEntity, TieredDiscountEntity, SideDiscountEntity]), AuthModule],
  controllers: [DiscountController],
  providers: [DiscountService],
  exports: [DiscountService],
})
export class DiscountModule {}
