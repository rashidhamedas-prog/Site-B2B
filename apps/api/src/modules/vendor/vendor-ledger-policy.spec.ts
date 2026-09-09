/**
 * npx tsx src/modules/vendor/vendor-ledger-policy.spec.ts
 */
import {
  canPartnerDeliverStatus,
  ledgerAvailableAt,
  resolveLedgerStatus,
  vendorNetPayableIrr,
} from './vendor-ledger-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(vendorNetPayableIrr(1000, 150) === 850, 'net after commission');
assert(vendorNetPayableIrr(100, 200) === 0, 'commission cannot exceed goods');
assert(canPartnerDeliverStatus('SHIPPED') && !canPartnerDeliverStatus('ACCEPTED'), 'deliver gate');

const delivered = new Date('2026-09-01T00:00:00.000Z');
const avail = ledgerAvailableAt(delivered, 7);
assert(avail.toISOString() === '2026-09-08T00:00:00.000Z', '7 day hold');
assert(resolveLedgerStatus('HELD', avail, new Date('2026-09-07T00:00:00.000Z')) === 'HELD', 'still held');
assert(resolveLedgerStatus('HELD', avail, new Date('2026-09-09T00:00:00.000Z')) === 'AVAILABLE', 'released');
assert(resolveLedgerStatus('PAID', avail, new Date('2026-09-09T00:00:00.000Z')) === 'PAID', 'paid sticky');

console.log('vendor-ledger-policy.spec.ts: ok');
