import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { OrderEntity } from '../order/entities/order.entity';
import { OrderItemEntity } from '../order/entities/order-item.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { ProductEntity } from '../product/entities/product.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      CustomerEntity,
      InvoiceEntity,
      ProductVariantEntity,
      ProductEntity,
    ]),
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
