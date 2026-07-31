import type { ContentBlock } from '@/lib/cms/types';

/**
 * Channel-aware CMS renderer.
 * Dynamically imports only the matching channel module so retail/.ir
 * does not pull wholesale client islands (and vice versa).
 */
export async function SiteBlocksRenderer({
  blocks,
  skipChrome = true,
  channel = 'WHOLESALE',
}: {
  blocks: ContentBlock[];
  skipChrome?: boolean;
  channel?: 'WHOLESALE' | 'RETAIL';
}) {
  if (channel === 'RETAIL') {
    const { RetailBlocksRenderer } = await import('./RetailBlocksRenderer');
    return <RetailBlocksRenderer blocks={blocks} skipChrome={skipChrome} />;
  }
  const { WholesaleBlocksRenderer } = await import('./WholesaleBlocksRenderer');
  return <WholesaleBlocksRenderer blocks={blocks} skipChrome={skipChrome} />;
}
