/**
 * Source-level checks for PR-13 alerts UI (no React runtime).
 * Run from apps/web: node ../../apps/api/node_modules/ts-node/dist/bin.js --transpile-only …
 * or: node --import tsx … when available.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const here = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

const src = readFileSync(join(here, 'admin-omnichannel-alerts.tsx'), 'utf8');
const admin = readFileSync(join(here, 'AdminOmnichannel.tsx'), 'utf8');

assert(/data-omni-alerts/.test(src), 'alerts root');
assert(/data-omni-alert-owner-hint/.test(src), 'owner hint marker');
assert(/settingsHint/.test(src), 'settingsHint field');
assert(/باز کردن تنظیمات کانال/.test(src), 'settings CTA');
assert(/ownerChatConfigured/.test(src), 'owner configured flag');
assert(/هشدارها/.test(src), 'persian tab copy');
assert(/export function alertAgeLabel/.test(src), 'age helper exported');
assert(!/4858359991/.test(src), 'no canary id');

assert(/AdminOmnichannelAlerts/.test(admin), 'mounted in AdminOmnichannel');
assert(/unansweredAlertsUi/.test(admin), 'flagged tab');
assert(/هشدارها/.test(admin), 'alerts tab label');

console.log('admin-omnichannel-alerts.spec.ts OK');
