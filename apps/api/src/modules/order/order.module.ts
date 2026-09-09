import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { FulfillmentPartnerController } from './fulfillment-partner.controller';
import { OrderService } from './order.service';
import { FulfillmentService } from './fulfillment.service';
import { FulfillmentJobs } from './fulfillment.jobs';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { FulfillmentOrderEntity } from './entities/fulfillment-order.entity';
import { FulfillmentOrderItemEntity } from './entities/fulfillment-order-item.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { VendorEntity } from '../vendor/entities/vendor.entity';
import { CustomerModule } from '../customer/customer.module';
import { ProductModule } from '../product/product.module';
import { AuthModule } from '../auth/auth.module';
import { DiscountModule } from '../discount/discount.module';
import { PaymentModule } from '../payment/payment.module';
import { ShippingModule } from '../shipping/shipping.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderItemEntity,
      FulfillmentOrderEntity,
      FulfillmentOrderItemEntity,
      InvoiceEntity,
      UserEntity,
      VendorEntity,
    ]),
    CustomerModule,
    ProductModule,
    AuthModule,
    DiscountModule,
    forwardRef(() => PaymentModule),
    ShippingModule,
    AffiliateModule,
    InventoryModule,
  ],
  controllers: [OrderController, FulfillmentPartnerController],
  providers: [OrderService, FulfillmentService, FulfillmentJobs],
  exports: [OrderService, FulfillmentService],
})
export class OrderModule {}
