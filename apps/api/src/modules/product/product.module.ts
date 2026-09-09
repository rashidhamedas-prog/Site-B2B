import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { OptionalJwtAuthGuard } from './optional-jwt.guard';
import { ProductSearchIndexer } from './product-search-indexer';
import { ProductEntity } from './entities/product.entity';
import { ProductVariantEntity } from './entities/product-variant.entity';
import { VariantColorEntity } from './entities/variant-color.entity';
import { VariantSizeEntity } from './entities/variant-size.entity';
import { ProductSpecMemoryEntity } from './entities/product-spec-memory.entity';
import { ProductRelatedEntity } from './entities/product-related.entity';
import { ProductInternalLinkEntity } from './entities/product-internal-link.entity';
import { CategoryEntity } from '../category/entities/category.entity';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SeoRedirectEntity } from '../blog/entities/seo-redirect.entity';
import { VendorEntity } from '../vendor/entities/vendor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    ProductEntity,
    ProductVariantEntity,
    ProductRelatedEntity,
    ProductInternalLinkEntity,
    CategoryEntity,
    VariantColorEntity,
    VariantSizeEntity,
    ProductSpecMemoryEntity,
    SeoRedirectEntity,
    VendorEntity,
  ]), AuthModule, UploadModule, forwardRef(() => InventoryModule)],
  controllers: [ProductController],
  providers: [ProductService, ProductSearchIndexer, OptionalJwtAuthGuard],
  exports: [ProductService],
})
export class ProductModule {}
