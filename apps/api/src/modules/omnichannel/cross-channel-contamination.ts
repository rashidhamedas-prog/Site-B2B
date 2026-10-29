/**
 * PR-10 — detect when destination A's caption/settings embed another destination's ids/links.
 * Soft warn on draft save; hard fail on template activate (D-9).
 */
import type { ChannelContentSettings } from './channel-settings';

export type SiblingChannelMarkers = {
  destinationId: string;
  contactId?: string;
  orderBotUsername?: string;
  channelLink?: string;
  botUsername?: string;
  ownerChatId?: string;
};

export type ContaminationHit = {
  siblingDestinationId: string;
  field: string;
  marker: string;
};

function normalizeMarker(raw: string): string {
  return String(raw || '').trim();
}

function collectMarkers(sibling: SiblingChannelMarkers): Array<{ field: string; marker: string }> {
  const out: Array<{ field: string; marker: string }> = [];
  const push = (field: string, value: string | undefined) => {
    const marker = normalizeMarker(value || '');
    if (!marker || marker.length < 3) return;
    out.push({ field, marker });
    if (field === 'orderBotUsername' || field === 'botUsername') {
      out.push({ field, marker: `@${marker.replace(/^@+/, '')}` });
    }
  };
  push('contactId', sibling.contactId);
  push('orderBotUsername', sibling.orderBotUsername);
  push('botUsername', sibling.botUsername);
  push('channelLink', sibling.channelLink);
  push('ownerChatId', sibling.ownerChatId);
  return out;
}

/** Scan free text for sibling destination markers (case-sensitive for ids/URLs). */
export function findCrossChannelContamination(
  text: string,
  targetDestinationId: string,
  siblings: SiblingChannelMarkers[],
): ContaminationHit[] {
  const hay = String(text || '');
  if (!hay.trim()) return [];
  const hits: ContaminationHit[] = [];
  const seen = new Set<string>();
  for (const sibling of siblings) {
    if (!sibling.destinationId || sibling.destinationId === targetDestinationId) continue;
    for (const { field, marker } of collectMarkers(sibling)) {
      if (!hay.includes(marker)) continue;
      const key = `${sibling.destinationId}:${field}:${marker}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        siblingDestinationId: sibling.destinationId,
        field,
        marker,
      });
    }
  }
  return hits;
}

export function channelSettingsTextBlob(content: ChannelContentSettings): string {
  return [
    content.captionIntro,
    content.footerText,
    content.ctaText,
    content.hashtags,
    content.channelLink,
    content.contactId,
    content.orderBotUsername ? `@${content.orderBotUsername}` : '',
    content.botUsername ? `@${content.botUsername}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function contaminationWarnings(hits: ContaminationHit[]): string[] {
  return hits.map(
    (hit) =>
      `نشانهٔ کانال دیگر (${hit.field}=${hit.marker}) در متن این مقصد دیده شد — قبل از فعال‌سازی پاک کنید`,
  );
}

export function assertNoCrossChannelContamination(
  text: string,
  targetDestinationId: string,
  siblings: SiblingChannelMarkers[],
): void {
  const hits = findCrossChannelContamination(text, targetDestinationId, siblings);
  if (!hits.length) return;
  const err = new Error(contaminationWarnings(hits)[0] || 'آلودگی بین کانالی');
  (err as Error & { code?: string; hits?: ContaminationHit[] }).code = 'cross_channel_contamination';
  (err as Error & { hits?: ContaminationHit[] }).hits = hits;
  throw err;
}
