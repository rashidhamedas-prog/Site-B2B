import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { AuthModule } from '../auth/auth.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { OrderEntity } from '../order/entities/order.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, OrderEntity, InvoiceEntity]),
    AuthModule,
    AffiliateModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
