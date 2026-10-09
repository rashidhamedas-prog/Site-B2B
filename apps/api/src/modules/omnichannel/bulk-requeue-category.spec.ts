/**
 * npx ts-node --transpile-only src/modules/omnichannel/bulk-requeue-category.spec.ts
 */
import {
  CLEAR_WAITING_ERROR,
  REQUEUE_BY_CATEGORY_MAX,
  REQUEUE_GAP_FLOOR_SECONDS,
  normalizeClearWaitingInput,
  normalizeRequeueByCategoryInput,
  staggeredAvailableAt,
} from './bulk-requeue-category';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const cat = '11111111-1111-4111-8111-111111111111';

assert(REQUEUE_BY_CATEGORY_MAX === 100, 'batch cap 100');
assert(CLEAR_WAITING_ERROR === 'cancelled_by_admin', 'cancel marker');

{
  const bad = normalizeClearWaitingInput({ reason: 'x', confirm: false });
  assert('error' in bad, 'confirm required');
  const ok = normalizeClearWaitingInput({ reason: 'پاک‌سازی صف', confirm: true });
  assert('ok' in ok && ok.reason === 'پاک‌سازی صف', 'clear ok');
}

{
  const bad = normalizeRequeueByCategoryInput({
    channel: 'WHOLESALE',
    categoryId: cat,
    reason: 'شروع دوباره',
    confirm: false,
  });
  assert('error' in bad, 'live needs confirm');
  const dry = normalizeRequeueByCategoryInput({
    channel: 'WHOLESALE',
    categoryId: cat,
    reason: 'پیش‌نمایش',
    dryRun: true,
  });
  assert('ok' in dry && dry.dryRun === true, 'dryRun skips confirm');
  const live = normalizeRequeueByCategoryInput({
    channel: 'RETAIL',
    categoryId: cat,
    reason: 'ارسال',
    confirm: true,
    offset: 50,
  });
  assert('ok' in live && live.channel === 'RETAIL' && live.offset === 50, 'live ok');
}

{
  const now = new Date('2026-10-10T00:00:00.000Z');
  const a = staggeredAvailableAt(0, 30, now);
  const b = staggeredAvailableAt(2, 30, now);
  assert(a.getTime() === now.getTime(), 'first immediate');
  assert(b.getTime() === now.getTime() + 60_000, 'third at 2*gap');
  const floor = staggeredAvailableAt(1, 1, now);
  assert(
    floor.getTime() === now.getTime() + REQUEUE_GAP_FLOOR_SECONDS * 1000,
    'gap floor 5s',
  );
}

console.log('bulk-requeue-category.spec.ts: ok');
