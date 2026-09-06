import type { ReactNode } from 'react';
import { Suspense } from 'react';
import type { ContentBlock } from '@/lib/cms/types';
import { arr, str } from '@/lib/cms/fetch';
import { RetailFaq } from '@/components/retail/RetailFaq';
import { RetailCtaBanner } from '@/components/retail/RetailCtaBanner';
import { RETAIL_TRUST_FALLBACK, type TrustItem } from '@/components/retail/RetailTrustStrip';
import {
  filterChromeBlocks,
  heroPropsFromBlock,
  pushCommonBlocks,
} from '@/components/cms/block-shared';
import { BoutiqueHero } from './BoutiqueHero';
import { BoutiqueCategoryRow } from './BoutiqueCategoryRow';
import { BoutiqueSaleRail, BoutiqueProductRail } from './BoutiqueSaleRail';
import { BoutiqueTrustStrip } from './BoutiqueTrustStrip';

const HOME_PRODUCT_CAP = 12;

function SectionSkeleton({ className = 'h-64' }: { className?: string }) {
  return (
    <div className={`bq-container animate-pulse py-8`}>
      <div className={`rounded-2xl bg-white/10 ${className}`} />
    </div>
  );
}

function statsItems(p: Record<string, unknown>): TrustItem[] {
  return arr<{ value: string; label: string; sublabel?: string }>(p, 'items').filter(
    (item) => item.value || item.label,
  );
}

export async function BoutiqueBlocksRenderer({
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
  const nodes: ReactNode[] = [];
  let extrasRendered = false;

  for (const block of list) {
    const p = block.props;
    if (looksLikeHome && block.type === 'stats') continue;
    switch (block.type) {
      case 'hero':
        nodes.push(<BoutiqueHero key={block.id} {...heroPropsFromBlock(p)} />);
        if (looksLikeHome && !extrasRendered) {
          const items = statsBlock ? statsItems(statsBlock.props) : RETAIL_TRUST_FALLBACK;
          nodes.push(<BoutiqueTrustStrip key="bq-trust" items={items} />);
          nodes.push(
            <Suspense key="bq-cats" fallback={<SectionSkeleton className="h-40" />}>
              <BoutiqueCategoryRow />
            </Suspense>,
          );
          nodes.push(
            <Suspense key="bq-sale" fallback={<SectionSkeleton className="h-72" />}>
              <BoutiqueSaleRail />
            </Suspense>,
          );
          extrasRendered = true;
        }
        break;
      case 'products': {
        const rawLimit = typeof p.limit === 'number' ? p.limit : HOME_PRODUCT_CAP;
        const limit = Math.min(Math.max(1, rawLimit), HOME_PRODUCT_CAP);
        nodes.push(
          <Suspense key={block.id} fallback={<SectionSkeleton className="h-96" />}>
            <BoutiqueProductRail title={str(p, 'headline') || 'جدیدترین‌های ترنم'} limit={limit} />
          </Suspense>,
        );
        break;
      }
      case 'categoryBanners':
        break;
      case 'faq':
        nodes.push(
          <div key={block.id} className="bq-container pb-4">
            <div className="bq-light-panel rounded-3xl bg-white text-neutral-900">
              <RetailFaq
                headline={str(p, 'headline') || undefined}
                body={str(p, 'body') || undefined}
                items={arr(p, 'items')}
              />
            </div>
          </div>,
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

  if (looksLikeHome && !extrasRendered) {
    nodes.unshift(
      <Suspense key="bq-cats-fb" fallback={<SectionSkeleton className="h-40" />}>
        <BoutiqueCategoryRow />
      </Suspense>,
    );
  }

  if (looksLikeHome && !list.some((block) => block.type === 'faq')) {
    nodes.push(
      <div key="bq-faq" className="bq-container pb-6">
        <div className="bq-light-panel rounded-3xl bg-white text-neutral-900">
          <RetailFaq />
        </div>
      </div>,
    );
  }

  if (looksLikeHome && !list.some((block) => block.type === 'cta')) {
    nodes.push(
      <RetailCtaBanner
        key="bq-cta"
        eyebrow="بوتیک"
        headline="بوتیک دارید؟"
        body="اگر برای فروشگاه سفارش می‌دهید، از سایت بوتیک‌داران ترنم قیمت و موجودی عمده را ببینید."
        ctaLabel="ورود به سایت بوتیک‌داران"
        ctaHref="https://poshaktaranom.com"
      />,
    );
  }

  return <>{nodes}</>;
}
