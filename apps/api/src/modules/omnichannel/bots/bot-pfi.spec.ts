import {
  botPfiAuditSummary,
  buildBotOrderPayload,
  buildBotProformaPayload,
  formatPfiCustomerMessage,
} from './bot-pfi';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

let threw = false;
try {
  buildBotOrderPayload({
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

const order = buildBotOrderPayload({
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
assert(order.channel === 'WHOLESALE', 'wholesale');
assert(order.items[0].quantity === 10, 'qty');
assert(!/token|botToken|secret/i.test(JSON.stringify(order)), 'no secrets in payload');

const inv = buildBotProformaPayload({
  customerId: 'c1',
  orderId: 'o1',
  subtotal: 1000,
  conversationId: 'conv1',
});
assert(inv.type === 'PROFORMA', 'proforma type');

assert(/PFI-2026-00001/.test(formatPfiCustomerMessage('PFI-2026-00001')), 'pfi in message');

const audit = botPfiAuditSummary({
  conversationId: 'conv1',
  invoiceNumber: 'PFI-1',
});
assert(audit.conversationId === 'conv1', 'audit ids only');
assert(!JSON.stringify(audit).includes('0912'), 'no phone in audit');

console.log('bot-pfi.spec.ts: ok');
