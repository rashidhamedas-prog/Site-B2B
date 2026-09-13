/**
 * npx ts-node --transpile-only src/modules/order/order-row-lock.spec.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { lockOrderRow, lockOrderRowWithItems } from './order-row-lock';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const calls: string[] = [];
  const order = { id: 'ord-1', items: undefined as unknown };
  const items = [{ id: 'it-1', orderId: 'ord-1' }];

  const qb = {
    where(sql: string, params: { id: string }) {
      calls.push(`where:${sql}:${params.id}`);
      return this;
    },
    setLock(mode: string) {
      calls.push(`setLock:${mode}`);
      return this;
    },
    async getOne() {
      calls.push('getOne');
      return order;
    },
  };

  const manager = {
    getRepository(entity: unknown) {
      if (entity === OrderEntity) {
        return {
          createQueryBuilder(alias: string) {
            calls.push(`qb:${alias}`);
            return qb;
          },
        };
      }
      if (entity === OrderItemEntity) {
        return {
          async find(opts: { where: { orderId: string } }) {
            calls.push(`findItems:${opts.where.orderId}`);
            return items;
          },
        };
      }
      throw new Error('unexpected repository');
    },
  };

  const locked = await lockOrderRow(manager as any, 'ord-1');
  assert(locked?.id === 'ord-1', 'locks the order row');
  assert(calls.includes('qb:o'), 'uses orders alias only');
  assert(calls.includes('setLock:pessimistic_write'), 'pessimistic lock on main row');
  assert(calls.includes('where:o.id = :id:ord-1'), 'filters by id');
  assert(!calls.some((c) => /left join|items/i.test(c)), 'lock query does not join items');

  const withItems = await lockOrderRowWithItems(manager as any, 'ord-1');
  assert(withItems?.items?.[0]?.id === 'it-1', 'items loaded in a second query');
  assert(calls.includes('findItems:ord-1'), 'items are not locked via join');

  const orderSrc = readFileSync(join(__dirname, 'order.service.ts'), 'utf8');
  assert(
    !/lock:\s*\{\s*mode:\s*'pessimistic_write'[\s\S]{0,120}relations:\s*\['items'\]/.test(orderSrc),
    'order.service must not FOR UPDATE a joined items query',
  );

  console.log('order-row-lock.spec ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
