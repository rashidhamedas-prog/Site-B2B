/**
 * npx ts-node --transpile-only src/modules/omnichannel/gate-block-reason.spec.ts
 */
import {
  isChannelPublishEventType,
  resolveGateBlockReason,
  summarizeDeadByEventType,
  type GateBlockInput,
} from './gate-block-reason';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function base(over: Partial<GateBlockInput> = {}): GateBlockInput {
  return {
    mode: 'LIVE',
    connectorsEnabled: true,
    autoPublishFlag: true,
    hasCanary: true,
    hasReadyDestination: true,
    sentToday: 0,
    dailyCap: 10,
    quietStartHour: null,
    quietEndHour: null,
    tehranHourNow: 12,
    ...over,
  };
}

assert(resolveGateBlockReason(base({ mode: 'OFF' })) === 'mode_off', 'mode_off');
assert(resolveGateBlockReason(base({ connectorsEnabled: false })) === 'flags_off', 'flags connectors');
assert(resolveGateBlockReason(base({ autoPublishFlag: false })) === 'flags_off', 'flags auto');
assert(
  resolveGateBlockReason(base({ mode: 'CANARY', hasCanary: false })) === 'no_canary',
  'no_canary',
);
assert(
  resolveGateBlockReason(base({ mode: 'LIVE', hasReadyDestination: false })) === 'no_destination',
  'no_destination',
);
assert(resolveGateBlockReason(base({ sentToday: 10, dailyCap: 10 })) === 'daily_cap', 'daily_cap');
assert(
  resolveGateBlockReason(
    base({ quietStartHour: 22, quietEndHour: 8, tehranHourNow: 23 }),
  ) === 'quiet',
  'quiet',
);
assert(resolveGateBlockReason(base()) === 'none', 'none');

assert(isChannelPublishEventType('publication.deliver.requested'), 'channel deliver');
assert(isChannelPublishEventType('product.created'), 'channel product');
assert(!isChannelPublishEventType('marketing.send.requested'), 'not marketing');
assert(!isChannelPublishEventType('order.created.notification'), 'not sms');

const dead = summarizeDeadByEventType(
  [
    { eventType: 'marketing.send.requested', status: 'DEAD' },
    { eventType: 'marketing.send.requested', status: 'DEAD' },
    { eventType: 'publication.deliver.requested', status: 'DEAD' },
    { eventType: 'product.created', status: 'PENDING' },
  ],
  { channelOnly: true },
);
assert(dead.length === 1, 'channel-only length');
assert(dead[0].eventType === 'publication.deliver.requested', 'channel-only type');
assert(dead[0].count === 1, 'channel-only count');

const all = summarizeDeadByEventType(
  [
    { eventType: 'marketing.send.requested', status: 'DEAD' },
    { eventType: 'marketing.send.requested', status: 'DEAD' },
    { eventType: 'publication.deliver.requested', status: 'DEAD' },
  ],
  { channelOnly: false },
);
assert(all[0].eventType === 'marketing.send.requested', 'all top type');
assert(all[0].count === 2, 'all top count');

console.log('gate-block-reason.spec.ts: ok');
