import { fetchProductList } from '@/lib/server-api';
import {
  normalizeProductsBlock,
  productsBlockCatalogParams,
  type ProductsBlockChannel,
  type ProductsBlockQuery,
} from './products-block';

export async function fetchProductsBlockCatalog(
  channel: ProductsBlockChannel,
  props: Record<string, unknown>,
): Promise<{
  query: ProductsBlockQuery;
  products: Record<string, unknown>[];
  error: boolean;
  /** Full catalog size for CTA (not rail length). */
  catalogTotal: number;
}> {
  const query = normalizeProductsBlock(props, channel);
  if (!query.enabled) {
    return { query, products: [], error: false, catalogTotal: 0 };
  }
  const params = productsBlockCatalogParams(query);
  const railPromise = fetchProductList({
    channel,
    limit: params.limit,
    sort: params.sort,
    ids: params.ids,
    categoryId: params.categoryId,
    inStockOnly: params.inStockOnly,
  });
  // Curated/manual rails report meta.total for the ID slice only — fetch a
  // one-row catalog count so «مشاهده همه» can show the real storefront size.
  const needsCatalogTotal = query.source === 'manual' || Boolean(params.ids?.length);
  const [result, catalogCount] = await Promise.all([
    railPromise,
    needsCatalogTotal
      ? fetchProductList({ channel, limit: 1, page: 1, sort: 'newest' })
      : Promise.resolve(null),
  ]);
  const catalogTotal =
    catalogCount && catalogCount.meta.failed !== true
      ? catalogCount.meta.total
      : result.meta.total;
  return {
    query,
    products: result.data,
    error: result.meta.failed === true,
    catalogTotal,
  };
}
