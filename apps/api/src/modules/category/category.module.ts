import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity } from './entities/category.entity';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { SeoRedirectEntity } from '../blog/entities/seo-redirect.entity';
import { ProductEntity } from '../product/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity, SeoRedirectEntity, ProductEntity])],
  providers: [CategoryService],
  controllers: [CategoryController],
  exports: [CategoryService],
})
export class CategoryModule {}

