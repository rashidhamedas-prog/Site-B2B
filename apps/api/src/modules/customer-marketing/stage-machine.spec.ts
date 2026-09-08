/**
 * npx ts-node --transpile-only src/modules/customer-marketing/stage-machine.spec.ts
 */
import { resolveStage, isSettledOrderStatus } from './stage-machine';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isSettledOrderStatus('CONFIRMED') && !isSettledOrderStatus('PENDING_REVIEW'), 'settled filter');

assert(resolveStage({
  channel: 'RETAIL', customerStatus: 'ACTIVE', settledOrderCount: 0,
  daysSinceLastSettledOrder: null, dormantAfterDays: 30,
}) === 'REGISTERED', 'retail new');

assert(resolveStage({
  channel: 'RETAIL', customerStatus: 'ACTIVE', settledOrderCount: 1,
  daysSinceLastSettledOrder: 2, dormantAfterDays: 30,
}) === 'ACTIVE_BUYER', 'retail first order');

assert(resolveStage({
  channel: 'RETAIL', customerStatus: 'ACTIVE', settledOrderCount: 2,
  daysSinceLastSettledOrder: 5, dormantAfterDays: 30,
}) === 'REPEAT', 'retail repeat');

assert(resolveStage({
  channel: 'RETAIL', customerStatus: 'ACTIVE', settledOrderCount: 1,
  daysSinceLastSettledOrder: 40, dormantAfterDays: 30,
}) === 'DORMANT', 'retail silent');

assert(resolveStage({
  channel: 'WHOLESALE', customerStatus: 'PENDING', settledOrderCount: 0,
  daysSinceLastSettledOrder: null, dormantAfterDays: 45,
}) === 'APPLIED', 'ws pending');

assert(resolveStage({
  channel: 'WHOLESALE', customerStatus: 'ACTIVE', settledOrderCount: 0,
  daysSinceLastSettledOrder: null, dormantAfterDays: 45,
}) === 'APPROVED', 'ws approved');

assert(resolveStage({
  channel: 'WHOLESALE', customerStatus: 'ACTIVE', settledOrderCount: 1,
  daysSinceLastSettledOrder: 3, dormantAfterDays: 45,
}) === 'FIRST_ORDER', 'ws first invoice');

assert(resolveStage({
  channel: 'WHOLESALE', customerStatus: 'PENDING', settledOrderCount: 0,
  daysSinceLastSettledOrder: null, dormantAfterDays: 45, current: 'NEEDS_DOCS',
}) === 'NEEDS_DOCS', 'manual docs kept');

console.log('stage-machine.spec.ts: ok');
