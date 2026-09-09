import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserEntity } from '../auth/entities/user.entity';
import { VendorEntity } from './entities/vendor.entity';
import { PartnerController } from './partner.controller';
import { VendorAdminController } from './vendor-admin.controller';
import { VendorService } from './vendor.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([VendorEntity, UserEntity])],
  controllers: [VendorAdminController, PartnerController],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}
