import type { ReactNode } from 'react';
import { Suspense } from 'react';
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

const HOME_PRODUCT_CAP = 12;

function SectionSkeleton({ className = 'h-64' }: { className?: string }) {
  return (
    <div className={`mx-auto max-w-[1200px] animate-pulse px-4 py-12 sm:px-6 lg:px-8`}>
      <div className={`rounded-xl bg-[var(--retail-border)]/40 ${className}`} />
    </div>
  );
}

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
      case 'products': {
        const rawLimit = typeof p.limit === 'number' ? p.limit : HOME_PRODUCT_CAP;
        const limit = Math.min(Math.max(1, rawLimit), HOME_PRODUCT_CAP);
        nodes.push(
          <Suspense key={block.id} fallback={<SectionSkeleton className="h-96" />}>
            <RetailProductGrid
              title={str(p, 'headline') || 'جدیدترین‌ها'}
              limit={limit}
              sort={str(p, 'sort') || 'newest'}
            />
          </Suspense>,
        );
        break;
      }
      case 'categoryBanners':
        nodes.push(
          <Suspense key={block.id} fallback={<SectionSkeleton className="h-80" />}>
            <RetailCategoryBannerGrid
              title={str(p, 'headline') || 'دسته‌بندی‌ها'}
              body={str(p, 'body') || undefined}
              columns={typeof p.columns === 'number' ? p.columns : 5}
              maxItems={Math.min(typeof p.maxItems === 'number' ? p.maxItems : 10, 10)}
              categoryIds={str(p, 'categoryIds') || undefined}
            />
          </Suspense>,
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
        break;
      default:
        pushCommonBlocks(block, p, nodes);
        break;
    }
  }

  return <>{nodes}</>;
}
