import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { CustomerModule } from './modules/customer/customer.module';
import { ProductModule } from './modules/product/product.module';
import { OrderModule } from './modules/order/order.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UploadModule } from './modules/upload/upload.module';
import { DiscountModule } from './modules/discount/discount.module';
import { PaymentModule } from './modules/payment/payment.module';
import { NotificationModule } from './modules/notification/notification.module';
import { BlogModule } from './modules/blog/blog.module';
import { CmsModule } from './modules/cms/cms.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SearchModule } from './modules/search/search.module';
import { databaseConfig } from './config/database.config';
import { CategoryModule } from './modules/category/category.module';
import { CrmModule } from './modules/crm/crm.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: databaseConfig,
    }),
    AuthModule,
    SearchModule,
    CustomerModule,
    CategoryModule,
    ProductModule,
    OrderModule,
    InvoiceModule,
    InventoryModule,
    CrmModule,
    DashboardModule,
    UploadModule,
    DiscountModule,
    PaymentModule,
    NotificationModule,
    BlogModule,
    CmsModule,
    ShippingModule,
    SettingsModule,
  ],
})
export class AppModule {}
