import { resolvePageBlocks } from '@/lib/cms/fetch';
import { CmsPageScope } from '@/lib/cms/page-scope';
import { SiteBlocksRenderer } from './SiteBlocksRenderer';

export async function CmsPage({
  channel,
  pageKey,
}: {
  channel: 'WHOLESALE' | 'RETAIL';
  pageKey: string;
}) {
  const blocks = await resolvePageBlocks(channel, pageKey);
  return (
    <CmsPageScope channel={channel} pageKey={pageKey}>
      <SiteBlocksRenderer blocks={blocks} channel={channel} />
    </CmsPageScope>
  );
}
