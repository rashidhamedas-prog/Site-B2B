import { fetchSiteContent, introBlocksFrom, resolvePageBlocks } from '@/lib/cms/fetch';
import { CmsPageScope } from '@/lib/cms/page-scope';
import { SiteBlocksRenderer } from './SiteBlocksRenderer';

export async function CmsPageIntro({
  channel,
  pageKey,
  storedOnly = false,
}: {
  channel: 'WHOLESALE' | 'RETAIL';
  pageKey: string;
  /** When true, do not fall back to code defaults (use for designed pages). */
  storedOnly?: boolean;
}) {
  const blocks = storedOnly
    ? introBlocksFrom((await fetchSiteContent(channel, pageKey))?.blocks ?? [])
    : introBlocksFrom(await resolvePageBlocks(channel, pageKey));
  if (!blocks.length) return null;
  return (
    <CmsPageScope channel={channel} pageKey={pageKey}>
      <SiteBlocksRenderer blocks={blocks} channel={channel} />
    </CmsPageScope>
  );
}
