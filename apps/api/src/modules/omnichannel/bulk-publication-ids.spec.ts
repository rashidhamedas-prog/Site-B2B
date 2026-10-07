import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BULK_WITHDRAW_PUBLICATION_MAX,
  normalizeBulkPublicationIds,
} from './bulk-publication-ids';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const empty = normalizeBulkPublicationIds([]);
assert('error' in empty, 'empty list rejected');

const notArray = normalizeBulkPublicationIds(null);
assert('error' in notArray, 'non-array rejected');

const ok = normalizeBulkPublicationIds([' a ', 'a', 'b']);
assert('ids' in ok && ok.ids[0] === 'a' && ok.ids[1] === 'b' && ok.ids.length === 2, 'trim + unique');

const tooMany = normalizeBulkPublicationIds(
  Array.from({ length: BULK_WITHDRAW_PUBLICATION_MAX + 1 }, (_, i) => `id-${i}`),
);
assert('error' in tooMany, 'over max rejected');

const atMax = normalizeBulkPublicationIds(
  Array.from({ length: BULK_WITHDRAW_PUBLICATION_MAX }, (_, i) => `id-${i}`),
);
assert('ids' in atMax && atMax.ids.length === BULK_WITHDRAW_PUBLICATION_MAX, 'max allowed');

const controllerSrc = readFileSync(
  join(__dirname, 'controllers', 'omnichannel-admin.controller.ts'),
  'utf8',
);
assert(controllerSrc.includes("publications/bulk-withdraw"), 'bulk withdraw route');
assert(controllerSrc.includes('bulkWithdrawPublications'), 'bulk withdraw handler');
assert(
  controllerSrc.indexOf("publications/bulk-withdraw")
    < controllerSrc.indexOf("publications/:id/withdraw"),
  'bulk route before :id withdraw',
);
const bulkFn = controllerSrc.slice(
  controllerSrc.indexOf('bulkWithdrawPublications'),
  controllerSrc.indexOf('publications/:id/withdraw'),
);
assert(bulkFn.includes('assertNoPlaintextSecrets'), 'bulk withdraw scans reason/body for secrets');
const singleWithdraw = controllerSrc.slice(
  controllerSrc.indexOf("@Post('publications/:id/withdraw')"),
  controllerSrc.indexOf("@Post('reconcile')"),
);
assert(singleWithdraw.includes('assertNoPlaintextSecrets'), 'single withdraw scans reason/body for secrets');

const serviceSrc = readFileSync(join(__dirname, 'services', 'omnichannel.service.ts'), 'utf8');
assert(/async bulkWithdraw\(/.test(serviceSrc), 'bulkWithdraw service method');

console.log('bulk-publication-ids.spec.ts: ok');
