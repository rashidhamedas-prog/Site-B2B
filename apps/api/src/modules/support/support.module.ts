import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicketEntity } from './entities/support-ticket.entity';
import { SupportTicketMessageEntity } from './entities/support-ticket-message.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { SupportTicketService } from './support-ticket.service';
import { SupportTicketController } from './support-ticket.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupportTicketEntity,
      SupportTicketMessageEntity,
      OrderEntity,
      UserEntity,
    ]),
  ],
  controllers: [SupportTicketController],
  providers: [SupportTicketService],
  exports: [SupportTicketService],
})
export class SupportModule {}
