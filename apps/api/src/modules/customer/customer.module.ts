import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerController } from './customer.controller';
import { CustomerSelfController } from './customer-self.controller';
import { CustomerService } from './customer.service';
import { CustomerEntity } from './entities/customer.entity';
import { CustomerWalletEntryEntity } from './entities/customer-wallet-entry.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerEntity, CustomerWalletEntryEntity]), AuthModule],
  controllers: [CustomerSelfController, CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
