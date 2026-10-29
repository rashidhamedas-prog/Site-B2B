import {
  assertBotNeverUsesCredit,
  botPfiAuditSummary,
  buildBotProformaDraft,
  buildBotProformaPayload,
  formatPfiCustomerMessage,
} from './bot-pfi';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

let threw = false;
try {
  buildBotProformaDraft({
    customerId: 'c1',
    productId: 'p1',
    qty: 2,
    minOrderQty: 10,
    unitPrice: 100,
    sku: 'S',
    productName: 'N',
    conversationId: 'conv1',
  });
} catch {
  threw = true;
}
assert(threw, 'moq reject throws');

const draft = buildBotProformaDraft({
  customerId: 'c1',
  productId: 'p1',
  productVariantId: 'v1',
  qty: 10,
  minOrderQty: 5,
  unitPrice: 100,
  sku: 'S',
  productName: 'N',
  conversationId: 'conv1',
  customerPhoneMasked: '0912***89',
});
assert(draft.type === 'PROFORMA', 'proforma only');
assert(draft.orderId == null, 'no order link by default');
assert(draft.status === 'DRAFT', 'draft');
assert(!/CREDIT/i.test(JSON.stringify(draft)), 'no CREDIT');
assert(!/token|botToken|secret/i.test(JSON.stringify(draft)), 'no secrets');

const inv = buildBotProformaPayload({
  customerId: 'c1',
  orderId: null,
  subtotal: 1000,
  conversationId: 'conv1',
});
assert(inv.type === 'PROFORMA', 'proforma type');

assert(/PFI-2026-00001/.test(formatPfiCustomerMessage('PFI-2026-00001')), 'pfi in message');

let creditBlocked = false;
try {
  assertBotNeverUsesCredit('CREDIT');
} catch {
  creditBlocked = true;
}
assert(creditBlocked, 'CREDIT forbidden');
assertBotNeverUsesCredit('ONLINE');

const audit = botPfiAuditSummary({
  conversationId: 'conv1',
  invoiceNumber: 'PFI-1',
});
assert(audit.conversationId === 'conv1', 'audit ids only');
assert(!JSON.stringify(audit).includes('0912'), 'no phone in audit');

console.log('bot-pfi.spec.ts: ok');
