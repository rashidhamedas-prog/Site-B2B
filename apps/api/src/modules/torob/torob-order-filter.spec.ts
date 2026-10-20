import { torobPurchaseAfterGt } from './torob-order-filter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const gt = '2026-10-20T10:15:31.774681+00:00';

assert(
  torobPurchaseAfterGt('2026-10-20T10:02:22.108000+00:00', gt) === false,
  'panel failure case: purchase before gt must be excluded',
);
assert(
  torobPurchaseAfterGt('2026-10-20T10:15:31.774681+00:00', gt) === false,
  'equal to gt is not greater-than',
);
assert(
  torobPurchaseAfterGt('2026-10-20T10:15:32.000000+00:00', gt) === true,
  'purchase after gt included',
);
assert(
  torobPurchaseAfterGt(new Date('2026-10-20T11:00:00.000Z'), new Date(gt)) === true,
  'Date objects work',
);
assert(torobPurchaseAfterGt(null, gt) === false, 'null purchase excluded');
assert(torobPurchaseAfterGt('nope', gt) === false, 'invalid purchase excluded');

console.log('torob-order-filter.spec ok');
