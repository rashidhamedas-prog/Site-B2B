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
): Promise<{ query: ProductsBlockQuery; products: Record<string, unknown>[]; error: boolean }> {
  const query = normalizeProductsBlock(props, channel);
  if (!query.enabled) {
    return { query, products: [], error: false };
  }
  const params = productsBlockCatalogParams(query);
  const result = await fetchProductList({
    channel,
    limit: params.limit,
    sort: params.sort,
    ids: params.ids,
    categoryId: params.categoryId,
    inStockOnly: params.inStockOnly,
  });
  return { query, products: result.data, error: result.meta.failed === true };
}
