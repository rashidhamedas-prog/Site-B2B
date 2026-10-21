/**
 * npx ts-node --transpile-only src/modules/payment/ga4-purchase.error-path.spec.ts
 *
 * An unexpected error after the PENDING insert must hand the row to the client
 * atomically; otherwise a later verify claims it and GA4 gets two purchases.
 */
import 'reflect-metadata';
import * as assert from 'assert';
import { Ga4PurchaseService } from './ga4-purchase.service';

process.env.GA4_SERVER_PURCHASE_ENABLED = 'true';
process.env.GA4_MP_RETAIL_API_SECRET = 'secret-12345';

type Row = { id: string; status: string; eventAt: Date };

async function run(failOn: RegExp) {
  const row: Row = { id: 'row-1', status: 'PENDING', eventAt: new Date() };
  const executed: string[] = [];
  const logRepo = {
    query: async (sql: string) => {
      executed.push(sql);
      if (failOn.test(sql)) throw new Error('db hiccup');
      if (/^INSERT/.test(sql.trim())) return [];
      if (/^SELECT/.test(sql.trim())) return [{ ...row }];
      if (/'CLIENT_FALLBACK'/.test(sql) && row.status === 'PENDING') {
        row.status = 'CLIENT_FALLBACK';
        return [[{ id: row.id }], 1];
      }
      return [[], 0];
    },
  };
  const orderRepo = {
    findOne: async () => ({
      id: 'o1',
      orderNumber: 'ORD-2026-00012-A3F9C1',
      total: 1_000_000,
      shippingFee: 0,
      items: [{ sku: 'SKU1', productName: 'Manteau', unitPrice: 1_000_000, quantity: 1 }],
    }),
  };
  const svc = new Ga4PurchaseService(logRepo as never, orderRepo as never);
  (svc as unknown as { logger: { log: () => void; warn: () => void; error: () => void } }).logger = {
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
  const result = await svc.sendPurchaseOnce({
    orderId: 'o1',
    paymentId: 'p1',
    channel: 'RETAIL',
    gaClientId: '1234567890.1761000000',
    gaSessionId: '1761000000',
  });
  return { result, row, executed };
}

(async () => {
  // Claim query throws: row was PENDING → must become CLIENT_FALLBACK, client owns it.
  const a = await run(/"status" = 'SENDING', "attempts" = "attempts" \+ 1/);
  assert.deepStrictEqual(a.result, { serverOwned: false, status: 'CLIENT_FALLBACK' });
  // Out of PENDING, so a later verify's inline claim (WHERE status = 'PENDING') cannot win.
  assert.strictEqual(a.row.status, 'CLIENT_FALLBACK', 'ledger moved out of PENDING');

  console.log('ga4-purchase.error-path.spec ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
