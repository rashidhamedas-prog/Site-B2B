import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const dialog = readFileSync(join(__dirname, 'WholesaleQuickOrder.tsx'), 'utf8');
const card = readFileSync(join(__dirname, 'WholesaleProductCard.tsx'), 'utf8');

assert(card.includes('hover:-translate-y-0.5'), 'card hover lift is the fixed-position containing block');
assert(card.includes('overflow-hidden'), 'card clips descendants, including a trapped fixed dialog');
assert(
  /orderOpen[\s\S]*hover:-translate-y-0\.5/.test(card) || card.includes('orderOpen\n          ?'),
  'card must disable hover translate while quick-order is open',
);
assert(
  /<\/article>\s*<WholesaleQuickOrder/.test(card),
  'quick-order must mount outside the transformed article',
);
assert(dialog.includes('createPortal'), 'quick-order dialog must leave the card');
assert(dialog.includes('document.body'), 'quick-order dialog must portal to document.body');
assert(/return createPortal\(/.test(dialog), 'the open dialog must be the portaled tree');

console.log('WholesaleQuickOrder.portal.spec.ts OK');
