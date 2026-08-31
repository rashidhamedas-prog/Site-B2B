/**
 * npx ts-node --transpile-only src/modules/product/channel-stock-isolation.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const root = resolve(__dirname, '../..');
const feed = readFileSync(resolve(root, 'modules/feeds/feeds.controller.ts'), 'utf8');
const basalam = readFileSync(resolve(root, 'modules/basalam/basalam.service.ts'), 'utf8');
const resolver = readFileSync(resolve(root, 'modules/product/channel-product-projection.ts'), 'utf8');
const inventory = readFileSync(resolve(root, 'modules/inventory/inventory.service.ts'), 'utf8');
const order = readFileSync(resolve(root, 'modules/order/order.service.ts'), 'utf8');
const productSvc = readFileSync(resolve(root, 'modules/product/product.service.ts'), 'utf8');

assert(resolver.includes('item.retailStock'), 'retail column only');
assert(!/channel === 'RETAIL'[\s\S]{0,80}item\.stock/.test(resolver), 'retail never reads legacy stock');
assert(feed.includes('Number(v.retailStock)') && feed.includes('Number(p.retailStock)'), 'feed uses retail columns');
assert(!/wholesaleStock/.test(feed), 'feed never reads wholesaleStock');
assert(basalam.includes("channelAvailability(p, 'RETAIL')"), 'basalam uses retail resolver');
assert(!/variant\.stock/.test(feed), 'feed does not read variant.stock');
assert(!/variant\.stock/.test(basalam), 'basalam does not read variant.stock');
assert(inventory.includes('return channelUnitStock(variant, channel)'), 'inventory wholesale uses channel column');
assert(order.includes('return channelUnitStock(variant, channel)'), 'order wholesale uses channel column');
assert(!productSvc.includes('product.stock = next'), 'setProductStock does not mirror wholesale onto stock');
assert(!/wholesaleStock \? \{ stock:/.test(productSvc), 'variant/product deduct does not dual-write stock');
assert(!productSvc.includes('Number(product.stock)'), 'withBadges does not fall back to legacy product.stock');
assert(!productSvc.includes('Number(v.stock)'), 'withBadges does not fall back to legacy variant.stock');
assert(
  productSvc.includes('delete (out as { wholesaleStock?: number }).wholesaleStock'),
  'retail public response drops wholesale stock',
);
assert(
  productSvc.includes('delete (out as { retailStock?: number }).retailStock'),
  'wholesale public response drops retail stock',
);

console.log('channel-stock-isolation.spec.ts: ok');
