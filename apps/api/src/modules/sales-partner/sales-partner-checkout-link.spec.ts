/**
 * npx ts-node --transpile-only src/modules/sales-partner/sales-partner-checkout-link.spec.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  SALES_PARTNER_SETTINGS_TABLE,
  salesPartnerCheckoutAttributionOpen,
  salesPartnerProgramSettingsSql,
  softFailSalesPartnerLinkQuery,
} from './sales-partner-checkout-link';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(SALES_PARTNER_SETTINGS_TABLE === 'app_settings', 'settings table is app_settings');
const { sql, params } = salesPartnerProgramSettingsSql();
assert(!/\bsystem_settings\b/i.test(sql), 'sql must not mention system_settings');
assert(/\bapp_settings\b/.test(sql), 'sql reads app_settings');
assert(params[0] === 'salesPartners', 'key is salesPartners');

assert(salesPartnerCheckoutAttributionOpen(null).open === false, 'missing row → no attribution');
assert(salesPartnerCheckoutAttributionOpen({ enabled: true, mode: 'OFF' }).open === false, 'OFF closed');
assert(salesPartnerCheckoutAttributionOpen({ enabled: true, mode: 'PREVIEW' }).open === false, 'PREVIEW closed');
assert(salesPartnerCheckoutAttributionOpen({ enabled: true, mode: 'LIVE' }).open === true, 'LIVE open');
const canary = salesPartnerCheckoutAttributionOpen({
  enabled: true,
  mode: 'CANARY',
  canaryPhone: '09151234567',
});
assert(canary.open === true, 'CANARY open');
assert(canary.canaryPhone === '09151234567', 'canary phone');

assert(
  softFailSalesPartnerLinkQuery('relation "system_settings" does not exist'),
  'legacy table name is soft',
);
assert(
  softFailSalesPartnerLinkQuery('relation "app_settings" does not exist'),
  'missing app_settings is soft',
);
assert(!softFailSalesPartnerLinkQuery('invalid input syntax for type uuid'), 'uuid errors stay hard');

const orderService = readFileSync(join(__dirname, '../order/order.service.ts'), 'utf8');
assert(!/\bsystem_settings\b/.test(orderService), 'OrderService must not query system_settings');
assert(
  orderService.includes('salesPartnerProgramSettingsSql'),
  'OrderService uses the shared settings SQL helper',
);
assert(
  orderService.includes('softFailSalesPartnerLinkQuery'),
  'OrderService swallows settings/table errors',
);

console.log('sales-partner-checkout-link.spec.ts: ok');
