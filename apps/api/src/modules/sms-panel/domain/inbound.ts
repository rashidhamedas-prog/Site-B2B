import { toLatinDigits } from './phone';

export type InboundIntent = 'UNSUBSCRIBE_11' | 'RESUBSCRIBE_12' | 'UNKNOWN';

/** Parse inbound SMS body for لغو11 / 11 / 12. */
export function parseInboundIntent(rawBody: string): InboundIntent {
  const latin = toLatinDigits(String(rawBody || ''));
  const compact = latin
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

  if (
    compact === '11' ||
    compact === 'stop' ||
    compact === 'لغو' ||
    compact === 'لغو11' ||
    compact === 'لغواشتراک' ||
    /لغو.?11/.test(compact)
  ) {
    return 'UNSUBSCRIBE_11';
  }
  if (compact === '12') return 'RESUBSCRIBE_12';
  return 'UNKNOWN';
}
