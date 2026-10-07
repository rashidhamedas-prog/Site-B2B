/**
 * npx ts-node --transpile-only src/modules/sales-partner/sales-partner-admin-draft-detail.spec.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function read(rel: string) {
  return readFileSync(join(__dirname, rel), 'utf8');
}

const controller = read('sales-partner-admin.controller.ts');
const draft = read('sales-partner-draft.service.ts');
const adminUi = readFileSync(
  join(__dirname, '../../../../web/src/components/admin/sales-partners/AdminSalesPartners.tsx'),
  'utf8',
);
const dashboard = readFileSync(
  join(__dirname, '../../../../web/src/components/admin/sales-partners/SpAdminDashboard.tsx'),
  'utf8',
);
const drawer = readFileSync(
  join(__dirname, '../../../../web/src/components/admin/sales-partners/SpOrderDetailDrawer.tsx'),
  'utf8',
);

assert(/Get\('orders\/:id'\)/.test(controller), 'admin GET order by id');
assert(/this\.drafts\.getAdmin\(id\)/.test(controller), 'controller calls getAdmin');
assert(/async getAdmin\(/.test(draft), 'getAdmin exists');
assert(/toDraftDetail\(/.test(draft), 'shared draft detail');
assert(/maskCustomerPhone\(draft\.customerPhone\)/.test(draft), 'customer phone masked');
const getAdminFn = draft.slice(draft.indexOf('async getAdmin'), draft.indexOf('async publicByToken'));
assert(!/confirmationTokenHash/.test(getAdminFn), 'getAdmin omits confirmation hash');
assert(/SpOrderDetailDrawer/.test(adminUi), 'drawer wired');
assert(/openOrder/.test(adminUi), 'openOrder helper');
assert(/مشاهده جزئیات/.test(adminUi), 'details action on list');
assert(/\/admin\/sales-partners\/orders\/\$\{id\}/.test(adminUi), 'fetches admin order detail');
assert(/onOpenOrder/.test(dashboard), 'dashboard opens detail');
assert(!/confirmationToken/.test(drawer), 'drawer has no token');
assert(/role="dialog"/.test(drawer), 'dialog semantics');
assert(/Escape/.test(drawer), 'escape closes');

console.log('sales-partner-admin-draft-detail.spec.ts ok');
