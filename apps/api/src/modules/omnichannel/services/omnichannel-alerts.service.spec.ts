/**
 * Source + pure contract tests for PR-13 alerts service.
 * Local: node …/ts-node/dist/bin.js --transpile-only src/modules/omnichannel/services/omnichannel-alerts.service.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ownerChatIdForDestination } from '../channel-settings';
import {
  evaluateUnansweredAlerts,
  OWNER_NOTIFY_ATTEMPT_CAP,
} from '../unanswered-alert-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const svc = readFileSync(resolve(__dirname, 'omnichannel-alerts.service.ts'), 'utf8');
const ctl = readFileSync(resolve(__dirname, '../controllers/omnichannel-admin.controller.ts'), 'utf8');
const constants = readFileSync(resolve(__dirname, '../omnichannel.constants.ts'), 'utf8');
const channelSettings = readFileSync(resolve(__dirname, '../channel-settings.ts'), 'utf8');

assert(/scanUnanswered/.test(svc), 'scanUnanswered');
assert(/maybeScanFromWorker/.test(svc), 'worker hook');
assert(/ownerChatIdForDestination/.test(svc), 'reads ownerChatId helper');
assert(/owner_chat_id_empty/.test(svc), 'empty owner code');
assert(/telegram_notify_deferred/.test(svc), 'telegram deferred');
assert(/notify_cap_reached|OWNER_NOTIFY_ATTEMPT_CAP/.test(svc), 'notify cap');
assert(/settingsHint/.test(svc), 'panel settings hint');
assert(!/4858359991/.test(svc), 'no canary id hardcoded');
assert(!/TELEGRAM_API_URL/.test(svc), 'no telegram egress URL');
assert(!/\bSMS\b/.test(svc), 'no SMS');
assert(!/OMNICHANNEL_CONNECTORS_ENABLED\s*=\s*['"]true['"]/.test(svc), 'no connector enable');

assert(/Get\('alerts'\)/.test(ctl), 'GET alerts');
assert(/Post\('alerts\/:id\/ack'\)/.test(ctl), 'ack');
assert(/Post\('alerts\/:id\/resolve'\)/.test(ctl), 'resolve');
assert(/unansweredAlertsUi/.test(ctl), 'status flag');

assert(/OMNICHANNEL_UNANSWERED_ALERTS_UI/.test(constants), 'UI env');
assert(/isOmnichannelUnansweredAlertsUiEnabled/.test(constants), 'UI helper');

assert(/ownerChatIdForDestination/.test(channelSettings), 'helper exported');
assert(/never invent/i.test(channelSettings), 'never invent comment');

assert(ownerChatIdForDestination({}) === '', 'empty settings');
assert(ownerChatIdForDestination({ ownerChatId: '  ' }) === '', 'blank id');
assert(ownerChatIdForDestination({ ownerChatId: 'owner-1' }) === 'owner-1', 'flat id');
assert(
  ownerChatIdForDestination({ channelSettings: { ownerChatId: 'nested-9' } }) === 'nested-9',
  'nested channelSettings',
);

const t0 = new Date('2026-10-29T12:00:00.000Z');
const at61 = new Date(t0.getTime() + 61_000);
const raised = evaluateUnansweredAlerts(
  at61,
  [{
    conversationId: 'c1',
    destinationId: 'd1',
    provider: 'BALE',
    status: 'open',
    lastCustomerMessageAt: t0,
    lastStaffReplyAt: null,
  }],
  [],
  60,
);
assert(raised[0]?.action === 'raise', 'policy raise at 61s');
assert(OWNER_NOTIFY_ATTEMPT_CAP === 3, 'cap 3');

{
  const alertsBlock = ctl.slice(
    ctl.indexOf("Get('alerts')"),
    ctl.indexOf("Post('alerts/:id/resolve')") + 200,
  );
  assert(/OmnichannelMinRole\('VIEWER'\)/.test(alertsBlock), 'VIEWER on GET');
  assert(/OmnichannelMinRole\('PUBLISHER'\)/.test(alertsBlock), 'PUBLISHER on resolve');
}

console.log('omnichannel-alerts.service.spec.ts: ok');
