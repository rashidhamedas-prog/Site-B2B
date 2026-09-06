'use client';

import { Fragment, type ReactNode } from 'react';

/* ---------- shared types (mirror the admin API) ---------- */

export type Channel = 'RETAIL' | 'WHOLESALE';
export type OosPolicy = 'UPDATE' | 'HIDE' | 'DELETE';
export type AutoPublishMode = 'OFF' | 'CANARY' | 'LIVE';
export type WithdrawAction = 'DELETE' | 'KEEP';
export type MediaMode = 'album' | 'single' | 'text';
export type ParseMode = 'HTML' | 'PLAIN';

export type TemplateButton = { label: string; url: string };
export type TemplateOptions = {
  mediaMode: MediaMode;
  parseMode: ParseMode;
  buttons: TemplateButton[];
  silent: boolean;
  protectContent: boolean;
  captionAbove: boolean;
  linkPreview: boolean;
};

export type Rendered = {
  text?: string;
  photoUrls?: string[];
  parseMode?: ParseMode;
  buttons?: TemplateButton[];
  silent?: boolean;
  protectContent?: boolean;
  captionAbove?: boolean;
  linkPreview?: boolean;
  mediaMode?: MediaMode;
};

export type Verification = {
  checkedAt: string;
  ok: boolean;
  error?: string;
  chatType?: string;
  title?: string;
  username?: string | null;
  memberCount?: number | null;
  botIsAdmin?: boolean;
  canPost?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

export type Status = {
  autoPublish: boolean;
  connectors: boolean;
  phase: number;
  retailCanaryLimit: number;
  wholesaleCanaryLimit: number;
  retailOosPolicy?: OosPolicy;
  wholesaleOosPolicy?: OosPolicy;
  retailOosChosen?: boolean;
  wholesaleOosChosen?: boolean;
  retailCanaryDestinationId?: string | null;
  wholesaleCanaryDestinationId?: string | null;
  autoPublishEventTypes?: string[];
  autoPublishEventTypesChosen?: boolean;
  retrySlaSeconds?: number;
  retrySlaChosen?: boolean;
  outboxRetentionDays?: number;
  outboxRetentionChosen?: boolean;
  autoPublishMode?: AutoPublishMode;
  autoDailyCap?: number;
  autoMinGapSeconds?: number;
  quietStartHour?: number | null;
  quietEndHour?: number | null;
  withdrawAction?: WithdrawAction;
  outbox?: {
    pending: number;
    processing: number;
    dead: number;
    oldestPendingAgeSec: number;
    staleLocks: number;
  };
};

export type Connection = {
  id: string;
  provider: string;
  channel: string;
  name: string;
  secretRef: string;
  status: string;
};

export type Destination = {
  id: string;
  connectionId: string;
  destinationKey: string;
  displayName: string;
  enabled: boolean;
  isCanary?: boolean;
  verified?: Verification | null;
};

export type Template = {
  id: string;
  provider: string;
  channel: string;
  eventType: string;
  version: number;
  enabled?: boolean;
  body?: string;
};

export type Publication = {
  id: string;
  sourceType?: string;
  sourceId: string;
  channel: string;
  status: string;
  projection?: { name?: string; sku?: string; url?: string };
  createdAt?: string;
};

export type Delivery = {
  id: string;
  publicationId: string;
  destinationId?: string;
  status: string;
  action: string;
  providerMessageId?: string | null;
  attempts?: number;
  nextAttemptAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
};

export type OutboxRow = {
  id: string;
  eventType: string;
  aggregateId: string;
  channel: string | null;
  status: string;
  attempts: number;
  availableAt?: string;
  lastError?: string | null;
  createdAt?: string;
};

export type AuditRow = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  channel: string | null;
  reason: string | null;
  createdAt?: string;
};

export type MediaRow = {
  id: string;
  publicUrl: string;
  altText: string;
  ownerType: string;
};

/* ---------- labels (Persian, human) ---------- */

export const EVENT_LABELS: Array<{ key: string; label: string; group: 'create' | 'update' | 'remove' | 'manual'; hint?: string }> = [
  { key: 'product.created', label: 'محصول جدید ثبت شد', group: 'create', hint: 'پست جدید در کانال' },
  { key: 'product.content_changed', label: 'نام، توضیح یا مشخصات تغییر کرد', group: 'update', hint: 'ویرایش پست موجود' },
  { key: 'product.price_changed', label: 'قیمت تغییر کرد', group: 'update', hint: 'ویرایش پست موجود' },
  { key: 'product.media_changed', label: 'عکس‌ها تغییر کرد', group: 'update', hint: 'ویرایش متن پست؛ عکس آلبوم قابل تعویض نیست' },
  { key: 'product.visibility_changed', label: 'محصول نمایش داده یا مخفی شد', group: 'update', hint: 'مخفی = حذف پست، نمایش = پست جدید' },
  { key: 'product.withdrawn', label: 'محصول از سایت حذف شد', group: 'remove', hint: 'طبق «رفتار حذف» پایین' },
  { key: 'blog.published', label: 'مقاله بلاگ منتشر شد', group: 'manual', hint: 'فعلاً فقط با انتشار دستی' },
  { key: 'cms.published', label: 'صفحه CMS منتشر شد', group: 'manual', hint: 'فعلاً فقط با انتشار دستی' },
];

const PUBLICATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'پیش‌نویس', tone: 'off' },
  READY: { label: 'در صف ارسال', tone: 'info' },
  PARTIAL: { label: 'ناقص', tone: 'warn' },
  PUBLISHED: { label: 'منتشر شده', tone: 'ok' },
  FAILED: { label: 'ناموفق', tone: 'danger' },
  WITHDRAWN: { label: 'برداشته شده', tone: 'off' },
};

const DELIVERY_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'در انتظار', tone: 'info' },
  PROCESSING: { label: 'در حال ارسال', tone: 'info' },
  SUCCEEDED: { label: 'ارسال شد', tone: 'ok' },
  RETRY: { label: 'تلاش مجدد', tone: 'warn' },
  DEAD: { label: 'متوقف', tone: 'danger' },
  FAILED: { label: 'ناموفق', tone: 'danger' },
};

const OUTBOX_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'در صف', tone: 'info' },
  PROCESSING: { label: 'در حال اجرا', tone: 'info' },
  DONE: { label: 'انجام شد', tone: 'ok' },
  DEAD: { label: 'متوقف', tone: 'danger' },
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'ارسال پست',
  UPDATE: 'ویرایش پست',
  DELETE: 'حذف پست',
};

const ERROR_LABELS: Record<string, string> = {
  invalid_credential: 'توکن ربات نامعتبر است یا ربات از کانال حذف شده',
  rate_limited: 'تلگرام محدودیت نرخ داد؛ خودکار دوباره تلاش می‌شود',
  provider_unavailable: 'تلگرام در دسترس نبود؛ دوباره تلاش می‌شود',
  timeout: 'پاسخ تلگرام دیر شد؛ دوباره تلاش می‌شود',
  duplicate: 'قبلاً همین محتوا ارسال/ویرایش شده بود',
  validate_failed: 'تلگرام درخواست را رد کرد (شناسه یا محتوای پست را بررسی کنید)',
  chat_not_found: 'چت پیدا نشد؛ ربات را به کانال اضافه کنید یا شناسه را درست وارد کنید',
  destination_missing: 'شناسه مقصد خالی است',
  provider_message_missing: 'شناسه پیام تلگرام ثبت نشده بود',
};

export function channelLabel(channel?: string | null) {
  return channel === 'WHOLESALE' ? 'عمده' : channel === 'RETAIL' ? 'تکی' : channel || '—';
}

export function publicationStatus(status: string) {
  return PUBLICATION_STATUS[status] || { label: status, tone: 'off' as Tone };
}

export function deliveryStatus(status: string) {
  return DELIVERY_STATUS[status] || { label: status, tone: 'off' as Tone };
}

export function outboxStatus(status: string) {
  return OUTBOX_STATUS[status] || { label: status, tone: 'off' as Tone };
}

export function actionLabel(action: string) {
  return ACTION_LABELS[action] || action;
}

export function errorLabel(error?: string | null) {
  if (!error) return '';
  const key = String(error).trim();
  return ERROR_LABELS[key] || key;
}

export function eventLabel(eventType: string) {
  return EVENT_LABELS.find((row) => row.key === eventType)?.label || eventType;
}

export function chatTypeLabel(type?: string) {
  if (type === 'channel') return 'کانال';
  if (type === 'supergroup' || type === 'group') return 'گروه';
  if (type === 'private') return 'چت خصوصی';
  return type || '—';
}

export function faNumber(value: number | string | null | undefined) {
  if (value == null || value === '') return '—';
  return Number(value).toLocaleString('fa-IR');
}

export function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function relativeTime(value?: string | null) {
  if (!value) return '—';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Math.round((Date.now() - t) / 1000);
  if (Math.abs(diff) < 60) return diff >= 0 ? 'همین حالا' : 'چند ثانیه دیگر';
  const abs = Math.abs(diff);
  const unit = abs < 3600 ? [Math.round(abs / 60), 'دقیقه'] : abs < 86400 ? [Math.round(abs / 3600), 'ساعت'] : [Math.round(abs / 86400), 'روز'];
  return diff >= 0 ? `${faNumber(unit[0])} ${unit[1]} پیش` : `${faNumber(unit[0])} ${unit[1]} دیگر`;
}

export function templateLooksReady(body?: string) {
  const raw = String(body || '').trim();
  if (!raw.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(raw) as { v?: unknown; blocks?: Array<{ type?: string; enabled?: boolean }> };
    return parsed?.v === 1 && Array.isArray(parsed.blocks) && parsed.blocks.some((row) => row.type === 'title' && row.enabled !== false);
  } catch {
    return false;
  }
}

/** Destination that automation may post to: canary, or verified with post rights. */
export function destinationReady(dest: Destination) {
  if (dest.isCanary) return true;
  const v = dest.verified;
  if (!v || !v.ok) return false;
  return v.chatType === 'private' ? true : v.canPost === true;
}

/* ---------- primitives ---------- */

export type Tone = 'ok' | 'warn' | 'off' | 'info' | 'danger';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warn: 'bg-amber-50 text-amber-800 border-amber-200',
  off: 'bg-gray-100 text-gray-600 border-gray-200',
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
};

export function Badge({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

export function Metric({ label, value, hint, tone = 'info' }: { label: string; value: ReactNode; hint?: string; tone?: Tone }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900 truncate">{value}</p>
      {hint && <p className="mt-1"><Badge tone={tone}>{hint}</Badge></p>}
    </div>
  );
}

export function Section({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {description && <p className="text-xs text-gray-500 mt-1 leading-5 max-w-3xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Callout({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 text-sm leading-6 ${TONE_CLASS[tone]}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
      <span className="pt-0.5">
        <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span aria-hidden className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${checked ? 'justify-end bg-emerald-500' : 'justify-start bg-gray-300'}`}>
          <span className="block h-4 w-4 rounded-full bg-white shadow" />
        </span>
      </span>
      <span className="space-y-0.5">
        <span className="block font-medium text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500 leading-5">{hint}</span>}
      </span>
    </label>
  );
}

export function RadioCards<T extends string>({
  name,
  value,
  onChange,
  options,
  columns = 3,
}: {
  name: string;
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; title: string; hint?: string; badge?: string; tone?: Tone; disabled?: boolean }>;
  columns?: 2 | 3;
}) {
  return (
    <div className={`grid gap-2 ${columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`} role="radiogroup">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <label
            key={opt.value}
            className={`rounded-xl border p-3 text-sm transition-colors ${opt.disabled ? 'opacity-50' : 'cursor-pointer'} ${active ? 'border-gray-900 bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`}
          >
            <input type="radio" name={name} className="sr-only" checked={active} disabled={opt.disabled} onChange={() => onChange(opt.value)} />
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">{opt.title}</span>
              {opt.badge && <Badge tone={active ? 'off' : opt.tone || 'info'}>{opt.badge}</Badge>}
            </span>
            {opt.hint && <span className={`block mt-1 text-xs leading-5 ${active ? 'text-white/75' : 'text-gray-500'}`}>{opt.hint}</span>}
          </label>
        );
      })}
    </div>
  );
}

/* ---------- stepper ---------- */

export type StepState = 'done' | 'todo' | 'warn';

export function Stepper<T extends string>({
  steps,
  current,
  onSelect,
}: {
  steps: Array<{ id: T; label: string; state: StepState; hint?: string }>;
  current: T;
  onSelect: (id: T) => void;
}) {
  return (
    <ol className="grid gap-2 md:grid-cols-5" role="tablist" aria-label="مراحل راه‌اندازی">
      {steps.map((step, index) => {
        const active = step.id === current;
        const dot = step.state === 'done' ? 'bg-emerald-500 text-white' : step.state === 'warn' ? 'bg-amber-400 text-gray-900' : 'bg-gray-200 text-gray-700';
        return (
          <li key={step.id}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className={`w-full text-right rounded-xl border p-3 transition-colors cursor-pointer ${active ? 'border-gray-900 bg-white shadow-sm' : 'bg-white/70 hover:bg-white'}`}
              onClick={() => onSelect(step.id)}
            >
              <span className="flex items-center gap-2">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${dot}`}>
                  {step.state === 'done' ? '✓' : faNumber(index + 1)}
                </span>
                <span className="text-sm font-semibold text-gray-900">{step.label}</span>
              </span>
              {step.hint && <span className="block mt-1 text-[11px] text-gray-500 leading-4 truncate">{step.hint}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Telegram-like preview ---------- */

function unescapeHtml(value: string) {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Renders `<b>` from HTML parse mode as real bold; everything else stays literal text. */
export function renderTelegramText(text: string, parseMode: ParseMode = 'HTML'): ReactNode {
  if (!text) return null;
  if (parseMode !== 'HTML') return text;
  const parts = text.split(/(<b>|<\/b>)/);
  let bold = false;
  return parts.map((part, index) => {
    if (part === '<b>') { bold = true; return null; }
    if (part === '</b>') { bold = false; return null; }
    if (!part) return null;
    const value = unescapeHtml(part);
    return bold ? <strong key={index}>{value}</strong> : <Fragment key={index}>{value}</Fragment>;
  });
}

export function TelegramPreview({
  rendered,
  title,
  placeholders = 0,
  compact = false,
}: {
  rendered: Rendered | null | undefined;
  title?: string;
  placeholders?: number;
  compact?: boolean;
}) {
  const photos = rendered?.photoUrls || [];
  const mediaMode = rendered?.mediaMode || (photos.length > 1 ? 'album' : photos.length === 1 ? 'single' : 'text');
  const slots = photos.length ? photos : Array.from({ length: mediaMode === 'text' ? 0 : placeholders }).map(() => '');
  const text = rendered?.text || '';
  const buttons = rendered?.buttons || [];
  const buttonsShown = buttons.length > 0 && mediaMode !== 'album';
  return (
    <div className="rounded-3xl bg-[#0e1621] p-4 text-white" dir="rtl">
      <div className="flex items-center justify-between text-[11px] text-white/60 mb-3">
        <span>{title || 'پیش‌نمایش تلگرام'}</span>
        <span className="flex gap-2">
          {rendered?.silent && <span title="بی‌صدا">🔕</span>}
          {rendered?.protectContent && <span title="ضد فوروارد">🔒</span>}
          {photos.length > 0 && <span>{faNumber(photos.length)} عکس</span>}
        </span>
      </div>
      <div className={`mx-auto max-w-[22rem] rounded-2xl bg-[#182533] overflow-hidden shadow ${compact ? '' : 'min-h-[18rem]'}`}>
        {rendered?.captionAbove && text && (
          <div className="px-3 pt-3 text-[13px] leading-6 whitespace-pre-wrap">{renderTelegramText(text, rendered.parseMode)}</div>
        )}
        {slots.length > 0 && (
          <div className={`grid gap-0.5 ${slots.length === 1 ? 'grid-cols-1' : 'grid-cols-6'} ${rendered?.captionAbove ? 'mt-2' : ''}`}>
            {slots.slice(0, 10).map((href, index) => {
              const span = slots.length === 1 ? 'col-span-1 h-56' : index < 2 ? 'col-span-3 h-32' : 'col-span-2 h-20';
              return (
                <div key={`${href}-${index}`} className={`${span} bg-white/10 overflow-hidden`}>
                  {href ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={href} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white/30 text-xs">عکس محصول</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!rendered?.captionAbove && (
          <div className="px-3 py-3 text-[13px] leading-6 whitespace-pre-wrap">
            {text ? renderTelegramText(text, rendered?.parseMode) : <span className="text-white/40">متن پست خالی است</span>}
          </div>
        )}
        <div className="px-3 pb-2 text-[10px] text-white/40 text-left">۱۲:۳۰ · 👁 ۱٫۲k</div>
        {buttonsShown && (
          <div className="flex flex-col gap-0.5 px-0.5 pb-0.5">
            {buttons.map((button) => (
              <span key={`${button.label}-${button.url}`} className="block rounded-lg bg-white/10 py-2 text-center text-[13px] text-sky-300">{button.label}</span>
            ))}
          </div>
        )}
      </div>
      {buttons.length > 0 && !buttonsShown && (
        <p className="mt-2 text-center text-[11px] text-amber-300/90">تلگرام زیر آلبوم دکمه نمایش نمی‌دهد؛ برای دکمه، حالت «یک عکس» یا «فقط متن» را انتخاب کنید.</p>
      )}
    </div>
  );
}
