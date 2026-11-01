import {
  assertQtyMeetsMoq,
  BOT_MOQ_REJECT_COPY,
  parseStartSku,
  transitionBotOrderFsm,
} from './bot-order-fsm';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(parseStartSku('/start ABC-12') === 'ABC-12', 'start sku');
assert(parseStartSku('start=SKU1') === 'SKU1', 'start= sku');
assert(parseStartSku('hello') === null, 'no start');

assert(assertQtyMeetsMoq(5, 10) === false, 'below moq');
assert(assertQtyMeetsMoq(10, 10) === true, 'at moq');

const moqReject = transitionBotOrderFsm(
  {
    state: 'QTY',
    statePayload: { sku: 'X', minOrderQty: 10 },
    tags: [],
    hasPriorPfi: true,
  },
  '3',
);
assert(moqReject.state === 'QTY', 'stay in QTY');
assert(moqReject.reply.includes(BOT_MOQ_REJECT_COPY.split(' ')[0]), 'moq copy');
assert(!moqReject.createPfi, 'no pfi on moq reject');

const sens = transitionBotOrderFsm(
  {
    state: 'QTY',
    statePayload: { sku: 'X', minOrderQty: 1 },
    tags: [],
    hasPriorPfi: true,
  },
  'شکایت دارم',
);
assert(sens.state === 'SENSITIVE_HOLD', 'sensitive hold');
assert(sens.tags.includes('sensitive'), 'sensitive tag');
assert(!sens.createPfi, 'no pfi on sensitive');

const menu = transitionBotOrderFsm(
  { state: 'MENU', statePayload: {}, tags: [], hasPriorPfi: true },
  'سلام',
);
assert(menu.state === 'MENU' && /محصولات/.test(menu.reply), 'welcome menu');

console.log('bot-order-fsm.spec.ts: ok');
