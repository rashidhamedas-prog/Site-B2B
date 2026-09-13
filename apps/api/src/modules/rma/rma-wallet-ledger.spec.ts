/**
 * npx ts-node --transpile-only src/modules/rma/rma-wallet-ledger.spec.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(join(__dirname, 'rma.service.ts'), 'utf8');
assert(/customerService\.updateBalance/.test(src), 'RMA must credit via updateBalance');
assert(/reasonCode:\s*'RMA'/.test(src), 'RMA ledger reason must be RMA');
assert(!/UPDATE customers SET balance/.test(src), 'RMA must not raw-update customers.balance');

console.log('rma-wallet-ledger.spec.ts: ok');
