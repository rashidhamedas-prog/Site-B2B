import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from '../product/entities/product.entity';
import { BasalamService } from './basalam.service';
import { BasalamController } from './basalam.controller';
import { AuthModule } from '../auth/auth.module';
import { BASALAM_HTTP, FetchBasalamHttp } from './basalam-http';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity]), AuthModule],
  controllers: [BasalamController],
  providers: [BasalamService, { provide: BASALAM_HTTP, useClass: FetchBasalamHttp }],
  exports: [BasalamService],
})
export class BasalamModule {}
