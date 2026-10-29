/**
 * npx tsx apps/web/src/components/admin/admin-omnichannel-channel-settings.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  channelSettingsDefaults,
  channelSettingsSourceHasInventedIds,
} from './admin-omnichannel-channel-settings';

const src = readFileSync(join(__dirname, 'admin-omnichannel-channel-settings.tsx'), 'utf8');
const admin = readFileSync(join(__dirname, 'AdminOmnichannel.tsx'), 'utf8');

const defaults = channelSettingsDefaults();
assert.equal(defaults.showPriceDefault, false, 'showPriceDefault default false');
assert.equal(defaults.contactId, '', 'empty contactId');
assert.equal(defaults.ownerChatId, '', 'empty ownerChatId');
assert.equal(defaults.orderBotId, '', 'empty orderBotId');
assert.equal(defaults.footerText, '', 'empty footer');
assert.equal(defaults.utmSource, '', 'empty utm');

assert.equal(channelSettingsSourceHasInventedIds(src), false, 'no invented LIVE ids in source');
assert.match(src, /آی‌دی مقصد هدایت پیام‌ها/);
assert.match(src, /goRef/);
assert.match(src, /emergency-hold|emergencyHold/);
assert.match(src, /PR-14/);
assert.match(admin, /AdminOmnichannelChannelSettings/);
assert.match(admin, /channelSettingsUi|تنظیمات کانال/);

console.log('admin-omnichannel-channel-settings.spec.ts OK');
