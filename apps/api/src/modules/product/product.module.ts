import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductSearchIndexer } from './product-search-indexer';
import { ProductEntity } from './entities/product.entity';
import { ProductVariantEntity } from './entities/product-variant.entity';
import { CategoryEntity } from '../category/entities/category.entity';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity, ProductVariantEntity, CategoryEntity]), AuthModule, UploadModule],
  controllers: [ProductController],
  providers: [ProductService, ProductSearchIndexer],
  exports: [ProductService],
})
export class ProductModule {}
