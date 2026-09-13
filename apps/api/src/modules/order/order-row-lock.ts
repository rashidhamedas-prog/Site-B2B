import { EntityManager } from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';

/**
 * Lock only the `orders` row.
 *
 * PostgreSQL rejects `FOR UPDATE` on the nullable side of an outer join.
 * TypeORM `find({ lock, relations: ['items'] })` LEFT JOINs `order_items`
 * and then applies FOR UPDATE to that join — verify/capture then rolls back
 * after the PSP has already taken the money.
 */
export async function lockOrderRow(
  manager: EntityManager,
  orderId: string,
): Promise<OrderEntity | null> {
  return manager
    .getRepository(OrderEntity)
    .createQueryBuilder('o')
    .where('o.id = :id', { id: orderId })
    .setLock('pessimistic_write')
    .getOne();
}

export async function lockOrderRowWithItems(
  manager: EntityManager,
  orderId: string,
): Promise<OrderEntity | null> {
  const order = await lockOrderRow(manager, orderId);
  if (!order) return null;
  order.items = await manager.getRepository(OrderItemEntity).find({
    where: { orderId: order.id },
  });
  return order;
}
