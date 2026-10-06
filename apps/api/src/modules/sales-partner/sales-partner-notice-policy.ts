export const NOTICE_TONES = ['info', 'important', 'urgent'] as const;
export type NoticeTone = (typeof NOTICE_TONES)[number];

export type NoticeDraftInput = {
  title?: string;
  body?: string;
  linkLabel?: string;
  linkUrl?: string;
  tone?: string;
  expiresAt?: string | null;
};

export type PreparedNotice = {
  title: string;
  body: string;
  linkLabel: string | null;
  linkUrl: string | null;
  tone: NoticeTone;
  expiresAt: Date | null;
  audience: 'ACTIVE';
};

export type NoticeVisibility = {
  publishedAt: Date | string;
  expiresAt?: Date | string | null;
  archivedAt?: Date | string | null;
};

export type BannerCandidate = {
  id: string;
  tone: NoticeTone;
  publishedAt: Date | string;
  dismissed: boolean;
};

const TITLE_MAX = 120;
const BODY_MAX = 2000;
const LABEL_MAX = 40;
const URL_MAX = 500;
const TONE_RANK: Record<NoticeTone, number> = { urgent: 3, important: 2, info: 1 };

export function prepareSalesPartnerNotice(
  input: NoticeDraftInput,
  now: Date,
): { ok: true; value: PreparedNotice } | { ok: false; error: string } {
  const title = plainLine(input.title, TITLE_MAX);
  const body = plainBody(input.body, BODY_MAX);
  if (title.length < 2) return { ok: false, error: 'عنوان اطلاعیه را بنویسید' };
  if (body.length < 2) return { ok: false, error: 'متن اطلاعیه را بنویسید' };

  const tone = input.tone;
  if (tone !== 'info' && tone !== 'important' && tone !== 'urgent') {
    return { ok: false, error: 'اهمیت اطلاعیه نامعتبر است' };
  }

  const link = resolveNoticeLink(input.linkLabel, input.linkUrl);
  if (link.ok === false) return { ok: false, error: link.error };

  let expiresAt: Date | null = null;
  const rawExpiry = (input.expiresAt || '').trim();
  if (rawExpiry) {
    const parsed = new Date(rawExpiry);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: 'تاریخ پایان نامعتبر است' };
    if (parsed.getTime() <= now.getTime()) {
      return { ok: false, error: 'تاریخ پایان باید جلوتر از الان باشد' };
    }
    expiresAt = parsed;
  }

  return {
    ok: true,
    value: {
      title,
      body,
      linkLabel: link.linkLabel,
      linkUrl: link.linkUrl,
      tone,
      expiresAt,
      audience: 'ACTIVE',
    },
  };
}

export function noticeIsVisible(notice: NoticeVisibility, now: Date): boolean {
  if (notice.archivedAt) return false;
  const published = new Date(notice.publishedAt).getTime();
  if (Number.isNaN(published) || published > now.getTime()) return false;
  if (!notice.expiresAt) return true;
  const expires = new Date(notice.expiresAt).getTime();
  return !Number.isNaN(expires) && expires > now.getTime();
}

export function pickNoticeBanner<T extends BannerCandidate>(items: T[]): T | null {
  const open = items.filter((item) => !item.dismissed);
  open.sort((a, b) => {
    const rank = TONE_RANK[b.tone] - TONE_RANK[a.tone];
    if (rank !== 0) return rank;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
  return open[0] ?? null;
}

function resolveNoticeLink(
  labelRaw: string | undefined,
  urlRaw: string | undefined,
): { ok: true; linkLabel: string | null; linkUrl: string | null } | { ok: false; error: string } {
  const linkUrl = safeNoticeHref(urlRaw);
  const label = plainLine(labelRaw, LABEL_MAX);
  const hadUrl = Boolean((urlRaw || '').trim());
  if (hadUrl && !linkUrl) {
    return { ok: false, error: 'لینک باید با / شروع شود یا یک آدرس https باشد' };
  }
  if (!linkUrl && label) return { ok: false, error: 'برای برچسب لینک، آدرس هم لازم است' };
  if (!linkUrl) return { ok: true, linkLabel: null, linkUrl: null };
  return { ok: true, linkLabel: label || 'مشاهده', linkUrl };
}

export function safeNoticeHref(raw: string | undefined): string | null {
  const value = (raw || '').trim();
  if (!value || value.length > URL_MAX) return null;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) {
    if (!/^\/[A-Za-z0-9\-._~%/?#&=+]*$/.test(value)) return null;
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    const href = url.toString();
    return href.length <= URL_MAX ? href : null;
  } catch {
    return null;
  }
}

function plainLine(raw: string | undefined, max: number): string {
  return clip(stripMarkup(raw).replace(/\s+/g, ' ').trim(), max);
}

function plainBody(raw: string | undefined, max: number): string {
  const cleaned = stripMarkup(raw)
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return clip(cleaned, max);
}

function stripMarkup(raw: string | undefined): string {
  return (raw || '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function clip(value: string, max: number): string {
  return Array.from(value).slice(0, max).join('');
}
