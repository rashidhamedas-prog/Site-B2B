import * as assert from 'node:assert/strict';
import {
  canCancelCampaign,
  canConfirmCampaign,
  canPauseCampaign,
  canResumeCampaign,
} from './sms-panel.fsm';

assert.ok(canConfirmCampaign('PREPARED'));
assert.ok(!canConfirmCampaign('DRAFT'));
assert.ok(!canConfirmCampaign('SENDING'));

assert.ok(canPauseCampaign('SENDING'));
assert.ok(canPauseCampaign('SCHEDULED'));
assert.ok(!canPauseCampaign('PAUSED'));
assert.ok(!canPauseCampaign('PREPARED'));

assert.ok(canResumeCampaign('PAUSED'));
assert.ok(!canResumeCampaign('SENDING'));

assert.ok(canCancelCampaign('DRAFT'));
assert.ok(canCancelCampaign('SENDING'));
assert.ok(!canCancelCampaign('COMPLETED'));
assert.ok(!canCancelCampaign('CANCELLED'));

console.log('sms-panel fsm: OK');
