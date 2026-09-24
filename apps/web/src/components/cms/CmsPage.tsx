import { resolvePageBlocks } from '@/lib/cms/fetch';
import { CmsPageScope } from '@/lib/cms/page-scope';
import { SiteBlocksRenderer } from './SiteBlocksRenderer';

function blocksIncludeH1(blocks: Array<{ type?: string; props?: Record<string, unknown> }>): boolean {
  return blocks.some((b) => {
    const t = String(b?.type || '');
    if (t === 'heading' || t === 'h1' || t === 'page-title') return true;
    const level = Number((b?.props as { level?: number } | undefined)?.level || 0);
    if (t === 'richText' || t === 'text') {
      const html = String((b?.props as { html?: string; body?: string } | undefined)?.html
        || (b?.props as { body?: string } | undefined)?.body
        || '');
      if (/<h1[\s>]/i.test(html)) return true;
    }
    return level === 1;
  });
}

export async function CmsPage({
  channel,
  pageKey,
  title,
}: {
  channel: 'WHOLESALE' | 'RETAIL';
  pageKey: string;
  /** Visible H1 when CMS blocks do not already include one. */
  title?: string;
}) {
  const blocks = await resolvePageBlocks(channel, pageKey);
  const needH1 = Boolean(title?.trim()) && !blocksIncludeH1(blocks as Array<{ type?: string; props?: Record<string, unknown> }>);
  return (
    <CmsPageScope channel={channel} pageKey={pageKey}>
      {needH1 ? (
        <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold text-[var(--retail-ink,#0F2F28)]">{title}</h1>
        </div>
      ) : null}
      <SiteBlocksRenderer blocks={blocks} channel={channel} />
    </CmsPageScope>
  );
}
