/**
 * npx ts-node --transpile-only src/modules/product/channel-projection.spec.ts
 */
import { channelAvailability, projectChannelProduct } from './channel-product-projection';
import {
  RETAIL_CANONICAL_ORIGIN,
  WHOLESALE_CANONICAL_ORIGIN,
  RETAIL_CANARY_LIMIT,
  WHOLESALE_CANARY_LIMIT,
  buildChannelProjection,
  canaryExceeded,
  storefrontAvailability,
} from './channel-projection';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const fixture = {
  id: 'prod-1',
  sku: 'SKU1',
  slug: 'linen-shirt',
  name: 'مانتو لینن',
  status: 'ACTIVE',
  showOnRetail: true,
  showOnWholesale: true,
  retailPrice: 2_000_000,
  wholesalePrice: 1_200_000,
  retailCompareAtPrice: 2_400_000,
  stock: 99,
  wholesaleStock: 40,
  retailStock: 3,
  retailFullContent: 'متن تکی',
  wholesaleFullContent: 'متن عمده',
  minOrderQty: 2,
  variants: [
    { stock: 80, wholesaleStock: 25, retailStock: 1 },
    { stock: 19, wholesaleStock: 15, retailStock: 2 },
  ],
};

{
  const retail = buildChannelProjection(fixture, 'RETAIL');
  const feed = channelAvailability(fixture, 'RETAIL');
  const store = storefrontAvailability(fixture, 'RETAIL');
  const core = projectChannelProduct(fixture, 'RETAIL');
  assert(retail.stock === 3 && feed.stock === 3 && store.stock === 3 && core.stock === 3, 'same retail stock');
  assert(retail.available === feed.available && retail.available === core.available, 'same availability');
  assert(retail.url === `${RETAIL_CANONICAL_ORIGIN}/products/linen-shirt`, 'retail .ir url');
  assert(retail.content === 'متن تکی', 'retail content');
  assert(retail.orderType === 'RETAIL_WEBSITE' && retail.orderChannel === 'RETAIL', 'retail order side');
  assert(retail.minOrderQty === 2, 'moq is backend value not guessed 1');
  assert(retail.publishable === true, 'visible retail is publishable');
}

{
  const hidden = buildChannelProjection({ ...fixture, showOnRetail: false }, 'RETAIL');
  assert(hidden.publishable === false && hidden.rejectReason === 'hidden_on_retail', 'hidden not published');
}

{
  const draft = buildChannelProjection({ ...fixture, status: 'DRAFT' }, 'RETAIL');
  assert(draft.publishable === false && draft.rejectReason === 'status_not_public', 'draft not published');
}

{
  const leaked = buildChannelProjection(
    {
      ...fixture,
      retailStock: 0,
      wholesaleStock: 500,
      stock: 500,
      variants: [{ stock: 500, wholesaleStock: 500, retailStock: 0 }],
    },
    'RETAIL',
  );
  assert(leaked.stock === 0, 'wholesale stock does not leak');
  assert(leaked.available === false && leaked.publishable === true, 'oos stays publishable');
}

{
  const wholesale = buildChannelProjection(fixture, 'WHOLESALE');
  assert(wholesale.stock === 40, 'wholesale stock only');
  assert(wholesale.url === `${WHOLESALE_CANONICAL_ORIGIN}/products/linen-shirt`, 'wholesale .com url');
  assert(wholesale.content === 'متن عمده', 'wholesale content');
  assert(wholesale.minOrderQty === 2, 'pack moq preserved');
  assert(wholesale.payable !== buildChannelProjection(fixture, 'RETAIL').payable, 'prices stay channel-isolated');
}

{
  const hidden = buildChannelProjection({ ...fixture, showOnWholesale: false }, 'WHOLESALE');
  assert(hidden.publishable === false && hidden.rejectReason === 'hidden_on_wholesale', 'hidden wholesale not published');
}

{
  assert(RETAIL_CANARY_LIMIT === 10 && WHOLESALE_CANARY_LIMIT === 10, 'canary 10');
  assert(canaryExceeded(10, 10) === true && canaryExceeded(9, 10) === false, 'canary cap');
}

console.log('channel-projection.spec.ts: ok');
