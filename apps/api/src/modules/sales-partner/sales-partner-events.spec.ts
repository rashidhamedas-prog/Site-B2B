import { salesPartnerOutboxPayload } from './sales-partner-events';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const clean = salesPartnerOutboxPayload({
  applicationId: 'a1',
  status: 'PENDING_REVIEW',
  iban: 'IR120170000000123456789001',
  phone: '09151234567',
  token: 'secret',
});
assert(clean.applicationId === 'a1', 'keeps id');
assert(clean.status === 'PENDING_REVIEW', 'keeps status');
assert(clean.iban === undefined && clean.phone === undefined && clean.token === undefined, 'strips secrets');

console.log('sales-partner-events.spec.ts: OK');
