import type { ContentBlock, SiteContentDoc } from './types';
import { getDefaultBlocks } from './defaults';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export async function fetchSiteContent(
  channel: 'WHOLESALE' | 'RETAIL',
  pageKey: string,
  opts?: { revalidate?: number | false },
): Promise<SiteContentDoc | null> {
  try {
    const res = await fetch(`${API_BASE}/cms/site-content/${channel}/${pageKey}`, {
      next:
        opts?.revalidate === false
          ? { revalidate: 0 }
          : { revalidate: opts?.revalidate ?? 60 },
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
