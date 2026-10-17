import type { ContentBlock } from './types';
import { insertCategoryBlockAfterHero } from '@/lib/catalog/category-storefront';

export const WHOLESALE_HOME_CATEGORY_BLOCK_ID = 'wholesale-home-categories';

/** Stable block so a saved wholesale home that predates category tiles still shows them. */
export function wholesaleHomeCategoryBlock(): ContentBlock {
  return {
    id: WHOLESALE_HOME_CATEGORY_BLOCK_ID,
    type: 'categoryBanners',
    props: {
      headline: 'دسته‌بندی محصولات',
      body: 'همه دسته‌های فعال کاتالوگ عمده؛ هر لینک به صفحهٔ همان مجموعه می‌رود.',
      columns: 4,
      maxItems: 24,
      categoryIds: '',
    },
  };
}

/**
 * Insert the category index after the hero when editors have not added one.
 * An existing categoryBanners block is left untouched (admin copy wins).
 */
export function ensureWholesaleHomeCategoryBlock(blocks: ContentBlock[]): ContentBlock[] {
  return insertCategoryBlockAfterHero(blocks, wholesaleHomeCategoryBlock());
}
