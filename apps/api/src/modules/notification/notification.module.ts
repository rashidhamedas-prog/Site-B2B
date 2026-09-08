import { Global, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationJobs } from './notification.jobs';
import { AuthModule } from '../auth/auth.module';
import { PaymentEntity } from '../payment/entities/payment.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { ProductEntity } from '../product/entities/product.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { CartSignalEntity } from '../cart/cart-signal.entity';
import { SmsEventLogEntity } from '../cart/sms-event-log.entity';

// Global so order/payment modules can inject NotificationService without imports.
@Global()
@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([
      PaymentEntity,
      OrderEntity,
      CustomerEntity,
      ProductEntity,
      ProductVariantEntity,
      CartSignalEntity,
      SmsEventLogEntity,
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationJobs],
  exports: [NotificationService],
})
export class NotificationModule {}
