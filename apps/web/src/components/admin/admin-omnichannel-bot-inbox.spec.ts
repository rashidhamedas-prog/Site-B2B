/**
 * Source-level checks for PR-14 bot inbox UI.
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

const src = readFileSync(join(here, 'admin-omnichannel-bot-inbox.tsx'), 'utf8');
const admin = readFileSync(join(here, 'AdminOmnichannel.tsx'), 'utf8');
const settings = readFileSync(join(here, 'admin-omnichannel-channel-settings.tsx'), 'utf8');

assert(/data-omni-bot-inbox/.test(src), 'inbox root');
assert(/صندوق ربات/.test(src), 'persian title');
assert(/ارجاع به سوشال مدیا/.test(src), 'refer CTA');
assert(/علامت پاسخ‌داده‌شده/.test(src), 'mark answered');
assert(!/botToken|secretRef|4858359991/.test(src), 'no secrets/canary id');

assert(/AdminOmnichannelBotInbox/.test(admin), 'mounted');
assert(/orderBotUi/.test(admin), 'flagged tab');
assert(/صندوق ربات‌ها/.test(admin), 'tab label');

assert(/test-owner-chat/.test(settings), 'test owner endpoint wired');
assert(!/cursor-not-allowed/.test(settings) || /ownerChatId/.test(settings), 'test button enabled path');

console.log('admin-omnichannel-bot-inbox.spec.ts OK');
