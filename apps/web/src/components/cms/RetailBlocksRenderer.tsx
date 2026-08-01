import type { ReactNode } from 'react';
import type { ContentBlock } from '@/lib/cms/types';
import { arr, str } from '@/lib/cms/fetch';
import { RetailHero } from '@/components/retail/RetailHero';
import { RetailFaq } from '@/components/retail/RetailFaq';
import { RetailProductGrid } from '@/components/retail/RetailProductGrid';
import { RetailCategoryBannerGrid } from '@/components/retail/RetailCategoryBannerGrid';
import {
  filterChromeBlocks,
  heroPropsFromBlock,
  pushCommonBlocks,
} from './block-shared';

/** Retail-only CMS blocks — keeps wholesale client chunks out of .ir bundle. */
export async function RetailBlocksRenderer({
  blocks,
  skipChrome = true,
}: {
  blocks: ContentBlock[];
  skipChrome?: boolean;
}) {
  const list = filterChromeBlocks(blocks, skipChrome);
  const nodes: ReactNode[] = [];

  for (const block of list) {
    const p = block.props;
    switch (block.type) {
      case 'hero':
        nodes.push(<RetailHero key={block.id} {...heroPropsFromBlock(p)} />);
        break;
      case 'stats': {
        const items = arr<{ value: string; label: string; sublabel?: string }>(p, 'items');
        nodes.push(
          <section
            key={block.id}
            className="border-y border-[var(--retail-border)] bg-[var(--retail-surface)]"
          >
            <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
              {items.map((item) => (
                <div key={`${item.value}-${item.label}`} className="text-center md:text-right">
                  <h2 className="text-lg font-extrabold text-[var(--retail-primary)]">{item.value}</h2>
                  <p className="mt-2 text-sm leading-7 text-[var(--retail-muted)]">{item.label}</p>
                </div>
              ))}
            </div>
          </section>,
        );
        break;
      }
      case 'products':
        nodes.push(
          <RetailProductGrid
            key={block.id}
            title={str(p, 'headline') || 'همه محصولات'}
            limit={typeof p.limit === 'number' ? p.limit : 200}
            sort={str(p, 'sort') || 'newest'}
          />,
        );
        break;
      case 'categoryBanners':
        nodes.push(
          <RetailCategoryBannerGrid
            key={block.id}
            title={str(p, 'headline') || 'دسته‌بندی‌ها'}
            body={str(p, 'body') || undefined}
            columns={typeof p.columns === 'number' ? p.columns : 5}
            maxItems={typeof p.maxItems === 'number' ? p.maxItems : 99}
            categoryIds={str(p, 'categoryIds') || undefined}
          />,
        );
        break;
      case 'faq':
        nodes.push(
          <RetailFaq
            key={block.id}
            headline={str(p, 'headline') || undefined}
            body={str(p, 'body') || undefined}
            items={arr(p, 'items')}
          />,
        );
        break;
      case 'features':
      case 'comingSoon':
      case 'process':
      case 'testimonials':
      case 'cta':
        // Wholesale-oriented blocks ignored on retail home
        break;
      default:
        pushCommonBlocks(block, p, nodes);
        break;
    }
  }

  return <>{nodes}</>;
}
