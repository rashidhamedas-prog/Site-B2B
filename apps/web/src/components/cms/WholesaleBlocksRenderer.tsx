import type { ReactNode } from 'react';
import type { ContentBlock } from '@/lib/cms/types';
import { arr, str } from '@/lib/cms/fetch';
import { HeroSection } from '@/components/wholesale/HeroSection';
import { WholesaleStats } from '@/components/wholesale/WholesaleStats';
import { WhyTaranom } from '@/components/wholesale/WhyTaranom';
import { FeaturedProducts } from '@/components/wholesale/FeaturedProducts';
import { ComingSoonSection } from '@/components/wholesale/ComingSoonSection';
import { HowItWorks } from '@/components/wholesale/HowItWorks';
import { Testimonials } from '@/components/wholesale/Testimonials';
import { WholesaleFaq } from '@/components/wholesale/WholesaleFaq';
import { CtaBanner } from '@/components/wholesale/CtaBanner';
import {
  filterChromeBlocks,
  heroPropsFromBlock,
  pushCommonBlocks,
} from './block-shared';

/** Wholesale-only CMS blocks — keeps retail client chunks out of .com bundle. */
export async function WholesaleBlocksRenderer({
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
        nodes.push(<HeroSection key={block.id} {...heroPropsFromBlock(p)} />);
        break;
      case 'stats':
        nodes.push(
          <WholesaleStats
            key={block.id}
            items={arr<{ value: string; label: string; sublabel?: string }>(p, 'items')}
          />,
        );
        break;
      case 'features':
        nodes.push(
          <WhyTaranom
            key={block.id}
            eyebrow={str(p, 'eyebrow') || undefined}
            headline={str(p, 'headline') || undefined}
            body={str(p, 'body') || undefined}
            items={arr(p, 'items')}
          />,
        );
        break;
      case 'products':
        nodes.push(
          <FeaturedProducts
            key={block.id}
            eyebrow={str(p, 'eyebrow') || undefined}
            headline={str(p, 'headline') || undefined}
            body={str(p, 'body') || undefined}
            ctaLabel={str(p, 'ctaLabel') || undefined}
            ctaHref={str(p, 'ctaHref') || undefined}
            viewAllLabel={str(p, 'viewAllLabel') || undefined}
            limit={typeof p.limit === 'number' ? p.limit : 6}
          />,
        );
        break;
      case 'comingSoon':
        nodes.push(
          <ComingSoonSection
            key={block.id}
            eyebrow={str(p, 'eyebrow') || undefined}
            headline={str(p, 'headline') || undefined}
            body={str(p, 'body') || undefined}
            callout={str(p, 'callout') || undefined}
            ctaLabel={str(p, 'ctaLabel') || undefined}
            ctaHref={str(p, 'ctaHref') || undefined}
          />,
        );
        break;
      case 'process':
        nodes.push(
          <HowItWorks
            key={block.id}
            eyebrow={str(p, 'eyebrow') || undefined}
            headline={str(p, 'headline') || undefined}
            body={str(p, 'body') || undefined}
            steps={arr(p, 'steps')}
          />,
        );
        break;
      case 'testimonials':
        nodes.push(
          <Testimonials
            key={block.id}
            eyebrow={str(p, 'eyebrow') || undefined}
            headline={str(p, 'headline') || undefined}
            body={str(p, 'body') || undefined}
            items={arr(p, 'items')}
            footerStats={arr(p, 'footerStats')}
          />,
        );
        break;
      case 'faq':
        nodes.push(
          <WholesaleFaq
            key={block.id}
            headline={str(p, 'headline') || undefined}
            body={str(p, 'body') || undefined}
            items={arr(p, 'items')}
          />,
        );
        break;
      case 'cta':
        nodes.push(
          <CtaBanner
            key={block.id}
            eyebrow={str(p, 'eyebrow') || undefined}
            headline={str(p, 'headline') || undefined}
            body={str(p, 'body') || undefined}
            ctaLabel={str(p, 'ctaLabel') || undefined}
            ctaHref={str(p, 'ctaHref') || undefined}
            ctaSecondaryLabel={str(p, 'ctaSecondaryLabel') || undefined}
            ctaSecondaryHref={str(p, 'ctaSecondaryHref') || undefined}
            ctaTertiaryLabel={str(p, 'ctaTertiaryLabel') || undefined}
            ctaTertiaryHref={str(p, 'ctaTertiaryHref') || undefined}
          />,
        );
        break;
      case 'categoryBanners':
        // Retail-only block
        break;
      default:
        pushCommonBlocks(block, p, nodes);
        break;
    }
  }

  return <>{nodes}</>;
}
