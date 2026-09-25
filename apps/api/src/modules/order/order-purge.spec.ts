/**
 * npx ts-node --transpile-only src/modules/order/order-purge.spec.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const serviceSrc = readFileSync(join(__dirname, 'order.service.ts'), 'utf8');
const controllerSrc = readFileSync(join(__dirname, 'order.controller.ts'), 'utf8');

assert(/async purgeOrder\(/.test(serviceSrc), 'purgeOrder service method');
assert(serviceSrc.includes('فقط سفارش حذف‌شده را می‌توان کامل پاک کرد'), 'blocks purge of active orders');
assert(serviceSrc.includes('DELETE FROM return_requests'), 'clears RMA FK before order delete');
assert(/async bulkVoidOrders\(/.test(serviceSrc), 'bulk void');
assert(/async bulkPurgeOrders\(/.test(serviceSrc), 'bulk purge');
assert(serviceSrc.includes('cleaned.length > 50'), 'bulk id cap');
assert(serviceSrc.includes('UPDATE payments SET "orderId" = NULL'), 'detaches payments instead of deleting ledger history');

assert(controllerSrc.includes("@Post('bulk/void')"), 'bulk void route');
assert(controllerSrc.includes("@Post('bulk/purge')"), 'bulk purge route');
assert(controllerSrc.includes("@Delete(':id/permanent')"), 'permanent delete route');
assert(controllerSrc.includes("@Roles('ADMIN')"), 'admin role on destructive routes');

console.log('order-purge.spec.ts: ok');
