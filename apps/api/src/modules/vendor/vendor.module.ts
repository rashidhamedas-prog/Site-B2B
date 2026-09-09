import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserEntity } from '../auth/entities/user.entity';
import { VendorEntity } from './entities/vendor.entity';
import { VendorLedgerEntryEntity } from './entities/vendor-ledger-entry.entity';
import { PartnerController } from './partner.controller';
import { VendorAdminController } from './vendor-admin.controller';
import { VendorService } from './vendor.service';
import { VendorLedgerService } from './vendor-ledger.service';
import { VendorLedgerJobs } from './vendor-ledger.jobs';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([VendorEntity, VendorLedgerEntryEntity, UserEntity]),
  ],
  controllers: [VendorAdminController, PartnerController],
  providers: [VendorService, VendorLedgerService, VendorLedgerJobs],
  exports: [VendorService, VendorLedgerService],
})
export class VendorModule {}
