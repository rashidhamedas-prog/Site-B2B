import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentAttemptEntity } from './entities/payment-attempt.entity';
import { PaymentLedgerEntryEntity } from './entities/payment-ledger-entry.entity';
import { RefundEntity } from './entities/refund.entity';
import { PaymentEventEntity } from './entities/payment-event.entity';
import { PaymentProviderEntity } from './entities/payment-provider.entity';
import {
  InstallmentContractEntity,
  InstallmentScheduleEntity,
} from './entities/installment-contract.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { InstallmentService } from './installment.service';
import { InstallmentController } from './installment.controller';
import { InstallmentOverdueJob } from './installment-overdue.job';
import { PaymentMetrics } from './payment-metrics';
import { AuthModule } from '../auth/auth.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { OrderEntity } from '../order/entities/order.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { ZarinPalAdapter } from './adapters/zarinpal.adapter';
import { DigiPayAdapter } from './adapters/digipay.adapter';
import { DisabledPaymentAdapter } from './adapters/disabled.adapter';
import { PaymentProviderRegistryService } from './payment-provider-registry.service';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentEntity,
      PaymentAttemptEntity,
      PaymentLedgerEntryEntity,
      RefundEntity,
      PaymentEventEntity,
      PaymentProviderEntity,
      InstallmentContractEntity,
      InstallmentScheduleEntity,
      OrderEntity,
      InvoiceEntity,
      CustomerEntity,
    ]),
    AuthModule,
    AffiliateModule,
    forwardRef(() => OrderModule),
  ],
  controllers: [PaymentController, InstallmentController],
  providers: [
    PaymentService,
    InstallmentService,
    InstallmentOverdueJob,
    PaymentMetrics,
    PaymentProviderRegistryService,
    ZarinPalAdapter,
    DigiPayAdapter,
    { provide: DisabledPaymentAdapter, useFactory: () => new DisabledPaymentAdapter('DISABLED') },
  ],
  exports: [
    PaymentService,
    InstallmentService,
    ZarinPalAdapter,
    DigiPayAdapter,
    PaymentProviderRegistryService,
  ],
})
export class PaymentModule {}
