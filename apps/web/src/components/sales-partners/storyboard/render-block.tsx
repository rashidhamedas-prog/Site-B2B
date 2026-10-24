import type { ReactNode } from 'react';
import type { ContentBlock } from '@/lib/cms/types';
import { EarningExample } from './EarningExample';
import { MoneyTimeline } from './MoneyTimeline';
import { RolesCard } from './RolesCard';
import { Storyboard } from './Storyboard';

export function renderSalesStoryBlock(block: ContentBlock): ReactNode | null {
  switch (block.type) {
    case 'storyboard':
      return <Storyboard key={block.id} props={block.props} />;
    case 'moneyTimeline':
      return <MoneyTimeline key={block.id} props={block.props} />;
    case 'earningExample':
      return <EarningExample key={block.id} props={block.props} />;
    case 'roles':
      return <RolesCard key={block.id} props={block.props} />;
    default:
      return null;
  }
}
