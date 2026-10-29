import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(resolve(__dirname, 'omnichannel-bot-inbox.service.ts'), 'utf8');
const ctl = readFileSync(resolve(__dirname, '../controllers/omnichannel-admin.controller.ts'), 'utf8');

assert(src.includes('listInbox'), 'list');
assert(src.includes('referSocial'), 'refer social');
assert(src.includes('markAnswered'), 'mark answered');
assert(src.includes('resolveOpenForConversation'), 'resolves PR-13 alerts');
assert(src.includes('testOwnerChat'), 'test owner chat');
assert(src.includes('setOrderBotEnabled'), 'order bot enable');
assert(src.includes('isDocumentedBaleCanaryKey'), 'canary dual-role warn reuse');
assert(src.includes('canary_dual_role_warn'), 'warn only');
assert(!src.includes('isCanary = false'), 'never clears canary');
assert(!src.includes('TELEGRAM_API_URL'), 'no telegram egress');
assert(src.includes('ownerChatId خالی'), 'empty ownerChatId 400');

assert(ctl.includes("bots/inbox"), 'admin inbox routes');
assert(ctl.includes('connections/:id/order-bot'), 'order-bot patch');
assert(ctl.includes('test-owner-chat'), 'test owner endpoint');
assert(ctl.includes('orderBotUi'), 'status flag');

console.log('omnichannel-bot-inbox.service.spec.ts: ok');
