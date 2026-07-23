import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CustomerEntity } from '../modules/customer/entities/customer.entity';
import { UserEntity } from '../modules/auth/entities/user.entity';
import { ProductEntity } from '../modules/product/entities/product.entity';
import { ProductVariantEntity } from '../modules/product/entities/product-variant.entity';
import { VariantColorEntity } from '../modules/product/entities/variant-color.entity';
import { VariantSizeEntity } from '../modules/product/entities/variant-size.entity';
import { OrderEntity } from '../modules/order/entities/order.entity';
import { OrderItemEntity } from '../modules/order/entities/order-item.entity';
import { InvoiceEntity } from '../modules/invoice/entities/invoice.entity';
import { InventoryMovementEntity } from '../modules/inventory/entities/inventory-movement.entity';
import { DiscountCodeEntity } from '../modules/discount/entities/discount-code.entity';
import { TieredDiscountEntity } from '../modules/discount/entities/tiered-discount.entity';
import { SideDiscountEntity } from '../modules/discount/entities/side-discount.entity';
import { PaymentEntity } from '../modules/payment/entities/payment.entity';
import { BlogPostEntity } from '../modules/blog/entities/blog-post.entity';
import { CmsPageEntity } from '../modules/cms/entities/cms-page.entity';
import { AppSettingEntity } from '../modules/settings/entities/app-setting.entity';
import { CategoryEntity } from '../modules/category/entities/category.entity';
import { ProductSpecMemoryEntity } from '../modules/product/entities/product-spec-memory.entity';
import { ReturnRequestEntity } from '../modules/rma/entities/return-request.entity';

export const databaseConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.get('DB_HOST', 'localhost'),
  port: config.get<number>('DB_PORT', 5432),
  username: config.get('DB_USER', 'taranom'),
  password: config.get('DB_PASS', 'taranom_pass'),
  database: config.get('DB_NAME', 'taranom_db'),
  entities: [
    UserEntity, CustomerEntity,
    CategoryEntity,
    ProductEntity, ProductVariantEntity, VariantColorEntity, VariantSizeEntity,
    ProductSpecMemoryEntity,
    OrderEntity, OrderItemEntity,
    InvoiceEntity,
    InventoryMovementEntity,
    DiscountCodeEntity, TieredDiscountEntity, SideDiscountEntity,
    PaymentEntity,
    BlogPostEntity,
    CmsPageEntity,
    AppSettingEntity,
    ReturnRequestEntity,
  ],
  migrations: ['dist/database/migrations/*.js'],
  migrationsRun: config.get('NODE_ENV') === 'production' && config.get('DB_SYNC') !== 'true',
  synchronize: config.get('DB_SYNC') === 'true' || config.get('NODE_ENV') !== 'production',
  logging: config.get('NODE_ENV') === 'development',
  ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
});
