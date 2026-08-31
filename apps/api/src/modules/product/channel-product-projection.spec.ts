/**
 * npx ts-node --transpile-only src/modules/product/channel-product-projection.spec.ts
 */
import {
  channelAvailability,
  channelUnitStock,
  isChannelVisible,
  projectChannelProduct,
} from './channel-product-projection';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const mixed = {
  status: 'ACTIVE',
  showOnRetail: true,
  showOnWholesale: true,
  retailPrice: 1_000_000,
  wholesalePrice: 800_000,
  stock: 99,
  wholesaleStock: 40,
  retailStock: 3,
  variants: [
    { stock: 80, wholesaleStock: 25, retailStock: 1 },
    { stock: 19, wholesaleStock: 15, retailStock: 2 },
  ],
};

{
  const retail = channelAvailability(mixed, 'RETAIL');
  assert(retail.stock === 3, `retail variant sum: ${retail.stock}`);
  assert(retail.available === true, 'retail available');
  const wholesale = channelAvailability(mixed, 'WHOLESALE');
  assert(wholesale.stock === 40, `wholesale variant sum: ${wholesale.stock}`);
}

{
  const noVariants = { ...mixed, variants: [] };
  assert(channelAvailability(noVariants, 'RETAIL').stock === 3, 'product retailStock');
  assert(channelAvailability(noVariants, 'WHOLESALE').stock === 40, 'product wholesaleStock');
}

{
  const leaked = {
    status: 'ACTIVE',
    showOnRetail: true,
    retailPrice: 100,
    stock: 500,
    wholesaleStock: 500,
    retailStock: 0,
    variants: [{ stock: 500, wholesaleStock: 500, retailStock: 0 }],
  };
  const retail = projectChannelProduct(leaked, 'RETAIL');
  assert(retail.stock === 0, 'legacy/wholesale stock must not leak into retail');
  assert(retail.available === false, 'retail out of stock');
}

{
  assert(channelUnitStock({ stock: 9 }, 'RETAIL') === 0, 'missing retailStock is 0');
  assert(channelUnitStock({ stock: 9 }, 'WHOLESALE') === 0, 'missing wholesaleStock is 0');
}

{
  assert(isChannelVisible({ ...mixed, showOnRetail: false }, 'RETAIL') === false, 'hidden retail');
  assert(isChannelVisible({ ...mixed, status: 'DRAFT' }, 'RETAIL') === false, 'draft hidden');
  assert(isChannelVisible({ ...mixed, retailPrice: 0 }, 'RETAIL') === false, 'zero retail price hidden');
}

console.log('channel-product-projection.spec.ts: ok');
