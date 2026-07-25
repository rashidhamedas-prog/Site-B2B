import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from '../product/entities/product.entity';
import { BasalamService } from './basalam.service';
import { BasalamController } from './basalam.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity]), AuthModule],
  controllers: [BasalamController],
  providers: [BasalamService],
  exports: [BasalamService],
})
export class BasalamModule {}
