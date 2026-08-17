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
import { WarehouseEntity } from '../modules/inventory/entities/warehouse.entity';
import { DiscountCodeEntity } from '../modules/discount/entities/discount-code.entity';
import { TieredDiscountEntity } from '../modules/discount/entities/tiered-discount.entity';
import { SideDiscountEntity } from '../modules/discount/entities/side-discount.entity';
import { PaymentEntity } from '../modules/payment/entities/payment.entity';
import { PaymentAttemptEntity } from '../modules/payment/entities/payment-attempt.entity';
import { PaymentLedgerEntryEntity } from '../modules/payment/entities/payment-ledger-entry.entity';
import { RefundEntity } from '../modules/payment/entities/refund.entity';
import { PaymentEventEntity } from '../modules/payment/entities/payment-event.entity';
import { PaymentProviderEntity } from '../modules/payment/entities/payment-provider.entity';
import {
  InstallmentContractEntity,
  InstallmentScheduleEntity,
} from '../modules/payment/entities/installment-contract.entity';
import { BlogPostEntity } from '../modules/blog/entities/blog-post.entity';
import { BlogCategoryEntity } from '../modules/blog/entities/blog-category.entity';
import { BlogTagEntity } from '../modules/blog/entities/blog-tag.entity';
import { BlogAuthorEntity } from '../modules/blog/entities/blog-author.entity';
import { SeoRedirectEntity } from '../modules/blog/entities/seo-redirect.entity';
import { BlogSettingsEntity } from '../modules/blog/entities/blog-settings.entity';
import { SeoAuditLogEntity } from '../modules/blog/entities/seo-audit-log.entity';
import { BlogMediaAssetEntity } from '../modules/blog/entities/blog-media-asset.entity';
import { BlogArticleRevisionEntity } from '../modules/blog/entities/blog-article-revision.entity';
import { BlogCommentEntity } from '../modules/blog/entities/blog-comment.entity';
import { BlogAnalyticsEntity } from '../modules/blog/entities/blog-analytics.entity';
import { CmsPageEntity } from '../modules/cms/entities/cms-page.entity';
import { SiteContentEntity } from '../modules/cms/entities/site-content.entity';
import { AppSettingEntity } from '../modules/settings/entities/app-setting.entity';
import { CategoryEntity } from '../modules/category/entities/category.entity';
import { ProductSpecMemoryEntity } from '../modules/product/entities/product-spec-memory.entity';
import { ProductRelatedEntity } from '../modules/product/entities/product-related.entity';
import { ReturnRequestEntity } from '../modules/rma/entities/return-request.entity';
import { CollectionEntity } from '../modules/collection/entities/collection.entity';

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
    CollectionEntity,
    ProductEntity, ProductVariantEntity, VariantColorEntity, VariantSizeEntity,
    ProductSpecMemoryEntity,
    ProductRelatedEntity,
    OrderEntity, OrderItemEntity,
    InvoiceEntity,
    InventoryMovementEntity,
    WarehouseEntity,
    DiscountCodeEntity, TieredDiscountEntity, SideDiscountEntity,
    PaymentEntity,
    PaymentAttemptEntity,
    PaymentLedgerEntryEntity,
    RefundEntity,
    PaymentEventEntity,
    PaymentProviderEntity,
    InstallmentContractEntity,
    InstallmentScheduleEntity,
    BlogPostEntity,
    BlogCategoryEntity,
    BlogTagEntity,
    BlogAuthorEntity,
    SeoRedirectEntity,
    BlogSettingsEntity,
    SeoAuditLogEntity,
    BlogMediaAssetEntity,
    BlogArticleRevisionEntity,
    BlogCommentEntity,
    BlogAnalyticsEntity,
    CmsPageEntity,
    SiteContentEntity,
    AppSettingEntity,
    ReturnRequestEntity,
  ],
  migrations: ['dist/database/migrations/*.js'],
  migrationsRun: config.get('NODE_ENV') === 'production' && config.get('DB_SYNC') !== 'true',
  synchronize: config.get('DB_SYNC') === 'true' || config.get('NODE_ENV') !== 'production',
  logging: config.get('NODE_ENV') === 'development',
  ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
});
