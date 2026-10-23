/**
 * Free-caption posts (FREE_POST).
 *
 * Network path (Iran): this module does not talk to Telegram. A live send is a
 * normal publication row plus the existing outbox event
 * `publication.deliver.requested`. The omnichannel worker delivers it through the
 * same channel adapter PRODUCT / BLOG_POST / CMS_PAGE already use. Do not add a
 * direct Bot API client here.
 */
import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { inQuietHours } from '../../lib/tehran-time';
import { assertNoPlaintextSecrets } from './omnichannel-secrets';
import { isOmnichannelFreePostEnabled } from './omnichannel.constants';
import {
  TELEGRAM_CAPTION_LIMIT,
  TELEGRAM_TEXT_LIMIT,
  publicProductPhotoUrl,
  type RenderedPublication,
} from './publication-template';

export const FREE_POST_SOURCE_TYPE = 'FREE_POST' as const;

/** Same outbox event the catalog publish gateway already consumes. */
export const FREE_POST_DELIVERY_EVENT = 'publication.deliver.requested' as const;

export const FREE_POST_DISABLED_MESSAGE =
  'ارسال متن آزاد خاموش است (OMNICHANNEL_FREE_POST_ENABLED).';

const FREE_POST_SOURCE_ID =
  /^free:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FreePostChannel = 'RETAIL' | 'WHOLESALE';

export type FreePostDraft = {
  channel: FreePostChannel;
  sourceId: string;
  caption: string;
  mediaUrl: string | null;
};

export type FreePostProjection = {
  channel: FreePostChannel;
  sourceType: typeof FREE_POST_SOURCE_TYPE;
  sourceId: string;
  name: string;
  visible: true;
  publishable: true;
  rejectReason: null;
  content: string;
  caption: string;
  url: string;
  mediaUrl: string | null;
  available: true;
};

export function newFreePostSourceId(): string {
  return `free:${randomUUID()}`;
}

export function isFreePostSourceId(value: unknown): boolean {
  return FREE_POST_SOURCE_ID.test(String(value || '').trim());
}

/** Flag default is off. Only the exact string `true` enables the path. */
export function assertFreePostEnabled(): void {
  if (!isOmnichannelFreePostEnabled()) {
    throw new ForbiddenException(FREE_POST_DISABLED_MESSAGE);
  }
}

export function assertFreePostReason(reason: unknown): string {
  const text = String(reason ?? '').trim();
  if (!text) throw new BadRequestException('برای متن آزاد دلیل حسابرسی الزامی است');
  if (text.length > 240) throw new BadRequestException('دلیل حسابرسی طولانی است');
  assertNoPlaintextSecrets({ reason: text });
  return text;
}

function cleanCaption(raw: unknown): string {
  return String(raw ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}

export function parseFreePostInput(input: {
  channel: FreePostChannel;
  caption?: string | null;
  mediaUrl?: string | null;
  sourceId?: string | null;
}): FreePostDraft {
  const caption = cleanCaption(input.caption);
  if (!caption) throw new BadRequestException('متن پست الزامی است');
  const mediaRaw = String(input.mediaUrl ?? '').trim();
  const mediaUrl = mediaRaw ? publicProductPhotoUrl(input.channel, mediaRaw) : null;
  if (mediaRaw && !mediaUrl) {
    throw new BadRequestException('آدرس تصویر معتبر نیست؛ فقط HTTPS روی دامنه ترنم');
  }
  const limit = mediaUrl ? TELEGRAM_CAPTION_LIMIT : TELEGRAM_TEXT_LIMIT;
  if (caption.length > limit) {
    throw new BadRequestException(mediaUrl
      ? 'متن همراه عکس حداکثر ۱۰۲۴ نویسه است'
      : 'متن بدون عکس حداکثر ۴۰۹۶ نویسه است');
  }
  const requestedId = String(input.sourceId ?? '').trim();
  const sourceId = requestedId || newFreePostSourceId();
  if (!isFreePostSourceId(sourceId)) {
    throw new BadRequestException('شناسه متن آزاد باید به شکل free:<uuid> باشد');
  }
  assertNoPlaintextSecrets({ caption, mediaUrl, sourceId });
  return { channel: input.channel, sourceId, caption, mediaUrl };
}

export function buildFreePostProjection(draft: FreePostDraft): FreePostProjection {
  const firstLine = draft.caption.split('\n').map((line) => line.trim()).find(Boolean) || 'متن آزاد';
  return {
    channel: draft.channel,
    sourceType: FREE_POST_SOURCE_TYPE,
    sourceId: draft.sourceId,
    name: firstLine.slice(0, 80),
    visible: true,
    publishable: true,
    rejectReason: null,
    content: draft.caption,
    caption: draft.caption,
    url: '',
    mediaUrl: draft.mediaUrl,
    available: true,
  };
}

/** Plain text only. Rendering stays local; the worker adapter performs the send. */
export function renderFreePost(projection: {
  caption?: unknown;
  content?: unknown;
  mediaUrl?: unknown;
  channel?: unknown;
}): RenderedPublication {
  const channel = projection.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
  const caption = cleanCaption(projection.caption ?? projection.content);
  const mediaRaw = String(projection.mediaUrl ?? '').trim();
  const mediaUrl = mediaRaw ? publicProductPhotoUrl(channel, mediaRaw) : null;
  const limit = mediaUrl ? TELEGRAM_CAPTION_LIMIT : TELEGRAM_TEXT_LIMIT;
  return {
    text: caption.slice(0, limit),
    photoUrls: mediaUrl ? [mediaUrl] : [],
    parseMode: 'PLAIN',
    buttons: [],
    silent: false,
    protectContent: false,
    captionAbove: false,
    linkPreview: false,
    mediaMode: mediaUrl ? 'single' : 'text',
  };
}

/**
 * New FREE_POST creates respect quiet hours only when that bot's automation mode is LIVE.
 * Updates of an existing free post are not a new create.
 */
export function freePostQuietBlock(input: {
  mode: string;
  quietStartHour: number | null;
  quietEndHour: number | null;
  tehranHourNow: number;
  creating: boolean;
}): string | null {
  if (!input.creating) return null;
  if (input.mode !== 'LIVE') return null;
  if (!inQuietHours(input.tehranHourNow, input.quietStartHour, input.quietEndHour)) return null;
  return 'ساعت سکوت حالت زنده است؛ ارسال زندهٔ متن آزاد تا پایان این بازه انجام نمی‌شود';
}

/** Drop free posts before catalog reconcile so a product withdraw cannot target them. */
export function catalogPublicationsForReconcile<T extends { sourceType?: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => String(row.sourceType || '').toUpperCase() !== FREE_POST_SOURCE_TYPE);
}
