'use client';

import { useEffect, useState } from 'react';
import type { ContentBlock } from '@/lib/cms/types';
import { getDefaultBlocks } from '@/lib/cms/defaults';
import { arr, findBlock, str, bool } from '@/lib/cms/fetch';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export interface SiteChromeData {
  announcement?: {
    enabled: boolean;
    text: string;
    phoneLabel: string;
    phoneHref: string;
    telegramLabel: string;
    telegramHref: string;
  };
  chrome?: Record<string, unknown>;
}

function parseChrome(blocks: ContentBlock[]): SiteChromeData {
  const ann = findBlock(blocks, 'announcement');
  const chrome = findBlock(blocks, 'chrome');
  return {
    announcement: ann
      ? {
          enabled: bool(ann.props, 'enabled', true),
          text: str(ann.props, 'text'),
          phoneLabel: str(ann.props, 'phoneLabel'),
          phoneHref: str(ann.props, 'phoneHref'),
          telegramLabel: str(ann.props, 'telegramLabel'),
          telegramHref: str(ann.props, 'telegramHref'),
        }
      : undefined,
    chrome: chrome?.props,
  };
}

let cache: { at: number; data: SiteChromeData } | null = null;

export function useSiteChrome(channel: 'WHOLESALE' | 'RETAIL' = 'WHOLESALE'): SiteChromeData {
  const defaults = parseChrome(getDefaultBlocks(channel, 'chrome'));
  const [data, setData] = useState<SiteChromeData>(cache?.data ?? defaults);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (cache && Date.now() - cache.at < 60_000) {
        setData(cache.data);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/cms/site-content/${channel}/chrome`, {
          credentials: 'omit',
        });
        if (!res.ok) {
          setData(defaults);
          return;
        }
        const json = await res.json();
        const blocks = Array.isArray(json?.blocks) ? (json.blocks as ContentBlock[]) : [];
        const parsed = blocks.length ? parseChrome(blocks) : defaults;
        cache = { at: Date.now(), data: parsed };
        if (!cancelled) setData(parsed);
      } catch {
        if (!cancelled) setData(defaults);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [channel]);

  return data;
}

export function chromeStr(chrome: Record<string, unknown> | undefined, key: string, fallback = '') {
  if (!chrome) return fallback;
  return str(chrome, key, fallback);
}

export function chromeLines(chrome: Record<string, unknown> | undefined): string[] {
  if (!chrome) return [];
  const lines = arr<string>(chrome, 'addressLines');
  if (lines.length) return lines.filter(Boolean);
  return [];
}
