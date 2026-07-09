import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { OrderEntity } from '../order/entities/order.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, CustomerEntity, InvoiceEntity, ProductVariantEntity]), AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
