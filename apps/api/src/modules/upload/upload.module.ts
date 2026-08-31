import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadController } from './upload.controller';
import { StorageService } from './storage.service';
import { AuthModule } from '../auth/auth.module';
import { ProductEntity } from '../product/entities/product.entity';
import { CmsPageEntity } from '../cms/entities/cms-page.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([ProductEntity, CmsPageEntity])],
  controllers: [UploadController],
  providers: [StorageService],
  exports: [StorageService],
})
export class UploadModule {}
