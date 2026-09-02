import { resolvePageBlocks } from '@/lib/cms/fetch';
import { SiteBlocksRenderer } from './SiteBlocksRenderer';

export async function CmsPage({
  channel,
  pageKey,
}: {
  channel: 'WHOLESALE' | 'RETAIL';
  pageKey: string;
}) {
  const blocks = await resolvePageBlocks(channel, pageKey);
  return <SiteBlocksRenderer blocks={blocks} channel={channel} />;
}
