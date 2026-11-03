import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadController } from './upload.controller';
import { StorageService } from './storage.service';
import { AuthModule } from '../auth/auth.module';
import { ProductEntity } from '../product/entities/product.entity';
import { CmsPageEntity } from '../cms/entities/cms-page.entity';
import { ProductVideoEntity } from '../product/entities/product-video.entity';
import { ProductVideoController } from './product-video.controller';
import { ProductVideoService } from './product-video.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([ProductEntity, ProductVideoEntity, CmsPageEntity])],
  controllers: [UploadController, ProductVideoController],
  providers: [StorageService, ProductVideoService],
  exports: [StorageService, ProductVideoService],
})
export class UploadModule {}
