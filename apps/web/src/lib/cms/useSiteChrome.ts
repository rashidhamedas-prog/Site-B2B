'use client';

import { useEffect, useState } from 'react';
import type { ContentBlock } from '@/lib/cms/types';
import {
  type SiteChromeData,
  defaultSiteChrome,
  parseChromeBlocks,
} from '@/lib/cms/chrome';

export type { SiteChromeData };
export { chromeStr, chromeLines, parseChromeBlocks, defaultSiteChrome } from '@/lib/cms/chrome';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
const TTL_MS = 60_000;

type CacheEntry = { at: number; data: SiteChromeData };
const cacheByChannel: Partial<Record<'WHOLESALE' | 'RETAIL', CacheEntry>> = {};
const inflightByChannel: Partial<
  Record<'WHOLESALE' | 'RETAIL', Promise<SiteChromeData> | null>
> = {};

/** Seed module cache from SSR so sibling hooks skip network. */
export function seedSiteChromeCache(
  channel: 'WHOLESALE' | 'RETAIL',
  data: SiteChromeData,
): void {
  cacheByChannel[channel] = { at: Date.now(), data };
}

async function loadChrome(channel: 'WHOLESALE' | 'RETAIL'): Promise<SiteChromeData> {
  const defaults = defaultSiteChrome(channel);
  const hit = cacheByChannel[channel];
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const existing = inflightByChannel[channel];
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/cms/site-content/${channel}/chrome`, {
        credentials: 'omit',
      });
      if (!res.ok) return defaults;
      const json = await res.json();
      const blocks = Array.isArray(json?.blocks) ? (json.blocks as ContentBlock[]) : [];
      const parsed = blocks.length ? parseChromeBlocks(blocks) : defaults;
      cacheByChannel[channel] = { at: Date.now(), data: parsed };
      return parsed;
    } catch {
      return defaults;
    } finally {
      inflightByChannel[channel] = null;
    }
  })();

  inflightByChannel[channel] = promise;
  return promise;
}

/**
 * CMS chrome for header/footer/float.
 * Pass `initial` (e.g. from WholesaleChromeProvider) to skip the network fetch.
 */
export function useSiteChrome(
  channel: 'WHOLESALE' | 'RETAIL' = 'WHOLESALE',
  initial?: SiteChromeData | null,
): SiteChromeData {
  const defaults = defaultSiteChrome(channel);
  const cached = cacheByChannel[channel];
  const [data, setData] = useState<SiteChromeData>(
    initial ?? cached?.data ?? defaults,
  );

  useEffect(() => {
    if (initial) {
      seedSiteChromeCache(channel, initial);
      setData(initial);
      return;
    }
    let cancelled = false;
    void loadChrome(channel).then((parsed) => {
      if (!cancelled) setData(parsed);
    });
    return () => {
      cancelled = true;
    };
  }, [channel, initial]);

  return data;
}
