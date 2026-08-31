import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReturnRequestEntity } from './entities/return-request.entity';
import { ReturnRequestAuditEntity } from './entities/return-request-audit.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { OrderItemEntity } from '../order/entities/order-item.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { RmaService } from './rma.service';
import { RmaController } from './rma.controller';
import { ProductModule } from '../product/product.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReturnRequestEntity,
      ReturnRequestAuditEntity,
      OrderEntity,
      OrderItemEntity,
      CustomerEntity,
      UserEntity,
    ]),
    ProductModule,
    InventoryModule,
  ],
  controllers: [RmaController],
  providers: [RmaService],
  exports: [RmaService],
})
export class RmaModule {}
