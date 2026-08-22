import type { ReactNode } from 'react';
import { Suspense } from 'react';
import type { ContentBlock } from '@/lib/cms/types';
import { arr, str } from '@/lib/cms/fetch';
import { RetailHero } from '@/components/retail/RetailHero';
import { RetailFaq } from '@/components/retail/RetailFaq';
import { RetailProductGrid } from '@/components/retail/RetailProductGrid';
import { RetailCategoryBannerGrid } from '@/components/retail/RetailCategoryBannerGrid';
import { RetailCtaBanner } from '@/components/retail/RetailCtaBanner';
import { RetailTrustStrip, RETAIL_TRUST_FALLBACK, type TrustItem } from '@/components/retail/RetailTrustStrip';
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

function statsItems(p: Record<string, unknown>): TrustItem[] {
  return arr<{ value: string; label: string; sublabel?: string }>(p, 'items').filter(
    (item) => item.value || item.label,
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
  const looksLikeHome =
    list.some((block) => block.type === 'hero') &&
    list.some((block) => block.type === 'products' || block.type === 'categoryBanners');
  const statsBlock = list.find((block) => block.type === 'stats');
  const hoistTrust = looksLikeHome;
  const nodes: ReactNode[] = [];
  let trustRendered = false;

  for (const block of list) {
    const p = block.props;
    if (hoistTrust && block.type === 'stats') {
      continue;
    }
    switch (block.type) {
      case 'hero':
        nodes.push(<RetailHero key={block.id} {...heroPropsFromBlock(p)} />);
        if (hoistTrust && !trustRendered) {
          const items = statsBlock ? statsItems(statsBlock.props) : RETAIL_TRUST_FALLBACK;
          nodes.push(
            <RetailTrustStrip key={statsBlock?.id ?? 'retail-trust-fallback'} items={items} />,
          );
          trustRendered = true;
        }
        break;
      case 'stats': {
        const items = statsItems(p);
        nodes.push(<RetailTrustStrip key={block.id} items={items} />);
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
      case 'cta':
        nodes.push(
          <RetailCtaBanner
            key={block.id}
            eyebrow={str(p, 'eyebrow') || undefined}
            headline={str(p, 'headline') || undefined}
            body={str(p, 'body') || undefined}
            ctaLabel={str(p, 'ctaLabel') || undefined}
            ctaHref={str(p, 'ctaHref') || undefined}
            ctaSecondaryLabel={str(p, 'ctaSecondaryLabel') || undefined}
            ctaSecondaryHref={str(p, 'ctaSecondaryHref') || undefined}
          />,
        );
        break;
      case 'features':
      case 'comingSoon':
      case 'process':
      case 'testimonials':
        break;
      default:
        pushCommonBlocks(block, p, nodes);
        break;
    }
  }

  if (looksLikeHome && !trustRendered) {
    nodes.splice(
      Math.min(1, nodes.length),
      0,
      <RetailTrustStrip key="retail-trust-fallback" items={RETAIL_TRUST_FALLBACK} />,
    );
  }

  if (looksLikeHome && !list.some((block) => block.type === 'faq')) {
    nodes.push(<RetailFaq key="retail-faq-fallback" />);
  }

  if (looksLikeHome && !list.some((block) => block.type === 'cta')) {
    nodes.push(
      <RetailCtaBanner
        key="retail-cta-fallback"
        headline="عمده‌فروش هستید؟"
        body="برای خرید عمده با حداقل سفارش و قیمت ویژه به سایت عمده سر بزنید."
        ctaLabel="ورود به سایت عمده"
        ctaHref="https://poshaktaranom.com"
      />,
    );
  }

  return <>{nodes}</>;
}
