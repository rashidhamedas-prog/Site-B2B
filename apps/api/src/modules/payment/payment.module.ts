import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentAttemptEntity } from './entities/payment-attempt.entity';
import { PaymentLedgerEntryEntity } from './entities/payment-ledger-entry.entity';
import { RefundEntity } from './entities/refund.entity';
import { PaymentProviderEntity } from './entities/payment-provider.entity';
import {
  InstallmentContractEntity,
  InstallmentScheduleEntity,
} from './entities/installment-contract.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { AuthModule } from '../auth/auth.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { OrderEntity } from '../order/entities/order.entity';
import { InvoiceEntity } from '../invoice/entities/invoice.entity';
import { ZarinPalAdapter } from './adapters/zarinpal.adapter';
import { DisabledPaymentAdapter } from './adapters/disabled.adapter';
import { PaymentProviderRegistryService } from './payment-provider-registry.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentEntity,
      PaymentAttemptEntity,
      PaymentLedgerEntryEntity,
      RefundEntity,
      PaymentProviderEntity,
      InstallmentContractEntity,
      InstallmentScheduleEntity,
      OrderEntity,
      InvoiceEntity,
    ]),
    AuthModule,
    AffiliateModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentProviderRegistryService,
    ZarinPalAdapter,
    { provide: DisabledPaymentAdapter, useFactory: () => new DisabledPaymentAdapter('DISABLED') },
  ],
  exports: [PaymentService, ZarinPalAdapter, PaymentProviderRegistryService],
})
export class PaymentModule {}
