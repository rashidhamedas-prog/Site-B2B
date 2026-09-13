import type { Metadata } from 'next';
import { getServerApiBase } from '@/lib/server-api-base';
import type { ContentBlock, SiteContentDoc } from './types';
import { getDefaultBlocks } from './defaults';
import { metadataFromCmsSeo, normalizeCmsPageSeo } from './page-seo';

/**
 * SSR CMS fetches must use the docker-internal API base.
 * Client chrome (`useSiteChrome`) keeps its own public/same-origin URL.
 */
export async function fetchSiteContent(
  channel: 'WHOLESALE' | 'RETAIL',
  pageKey: string,
  opts?: { revalidate?: number | false },
): Promise<SiteContentDoc | null> {
  try {
    const res = await fetch(`${getServerApiBase()}/cms/site-content/${channel}/${pageKey}`, {
      next:
        opts?.revalidate === false
          ? { revalidate: 0 }
          : { revalidate: opts?.revalidate ?? 60, tags: ['cms', `cms:${channel}:${pageKey}`] },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as SiteContentDoc;
    if (!data || !Array.isArray(data.blocks)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Published CMS blocks, or built-in defaults when empty / missing */
export async function resolvePageBlocks(
  channel: 'WHOLESALE' | 'RETAIL',
  pageKey: string,
): Promise<ContentBlock[]> {
  const doc = await fetchSiteContent(channel, pageKey);
  if (doc?.blocks?.length) return doc.blocks as ContentBlock[];
  return getDefaultBlocks(channel, pageKey);
}

export async function metadataForCmsPage(
  channel: 'WHOLESALE' | 'RETAIL',
  pageKey: string,
  fallback: { title: string; description: string; canonical?: string; ogImage?: string; ogAlt?: string },
): Promise<Metadata> {
  const doc = await fetchSiteContent(channel, pageKey);
  return metadataFromCmsSeo(normalizeCmsPageSeo(doc?.seo), fallback, channel, pageKey);
}

const INTRO_BLOCK_TYPES = new Set<ContentBlock['type']>([
  'text',
  'hero',
  'faq',
  'cta',
  'features',
  'html',
  'image',
  'gallery',
  'contact',
  'links',
  'process',
  'stats',
  'testimonials',
]);

/** Blocks safe to render above a catalog/form page (no chrome, no nested product rails). */
export function introBlocksFrom(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.filter((b) => INTRO_BLOCK_TYPES.has(b.type));
}

export function findBlock<T extends ContentBlock['type']>(
  blocks: ContentBlock[],
  type: T,
): ContentBlock | undefined {
  return blocks.find((b) => b.type === type);
}

export function str(props: Record<string, unknown>, key: string, fallback = ''): string {
  const v = props[key];
  return typeof v === 'string' ? v : fallback;
}

export function bool(props: Record<string, unknown>, key: string, fallback = true): boolean {
  const v = props[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function arr<T>(props: Record<string, unknown>, key: string): T[] {
  return Array.isArray(props[key]) ? (props[key] as T[]) : [];
}
