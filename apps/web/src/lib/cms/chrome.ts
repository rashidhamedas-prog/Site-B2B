import type { ContentBlock } from '@/lib/cms/types';
import { getDefaultBlocks } from '@/lib/cms/defaults';
import { arr, findBlock, str, bool } from '@/lib/cms/fetch';

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

export function parseChromeBlocks(blocks: ContentBlock[]): SiteChromeData {
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

export function defaultSiteChrome(channel: 'WHOLESALE' | 'RETAIL'): SiteChromeData {
  return parseChromeBlocks(getDefaultBlocks(channel, 'chrome'));
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
