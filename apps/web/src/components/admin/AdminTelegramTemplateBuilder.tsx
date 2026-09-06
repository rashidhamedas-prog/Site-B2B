'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Callout,
  RadioCards,
  TelegramPreview,
  Toggle,
  faNumber,
  type Channel,
  type MediaMode,
  type ParseMode,
  type Rendered,
  type Template,
  type TemplateButton,
  type TemplateOptions,
} from './admin-omnichannel-ui';

type Token =
  | 'name' | 'sku' | 'fabric' | 'sizes' | 'colors' | 'colorCount'
  | 'length' | 'price' | 'packQty' | 'packPrice' | 'url';

type Block =
  | { id: string; type: 'photos'; enabled: boolean; maxPhotos: number }
  | { id: string; type: 'title'; enabled: boolean; emoji: string; token: Token }
  | { id: string; type: 'field'; enabled: boolean; emoji: string; label: string; token: Token; suffix?: string }
  | { id: string; type: 'trust'; enabled: boolean; emoji: string; text: string }
  | { id: string; type: 'text'; enabled: boolean; text: string };

type Layout = { v: 1; blocks: Block[]; options: TemplateOptions };

const CAPTION_LIMIT = 1024;
const TEXT_LIMIT = 4096;
const BUTTON_LIMIT = 4;
const BUTTON_HOSTS = ['poshaktaranom.com', 'www.poshaktaranom.com', 'poshaktaranom.ir', 'www.poshaktaranom.ir', 'api.poshaktaranom.com', 'storage.poshaktaranom.com', 't.me', 'telegram.me'];

const TOKENS: Array<{ key: Token; label: string }> = [
  { key: 'name', label: 'نام محصول' },
  { key: 'sku', label: 'کد' },
  { key: 'fabric', label: 'جنس' },
  { key: 'sizes', label: 'سایزبندی' },
  { key: 'colors', label: 'رنگ‌ها' },
  { key: 'colorCount', label: 'تعداد رنگ' },
  { key: 'length', label: 'قد' },
  { key: 'price', label: 'قیمت' },
  { key: 'packQty', label: 'تعداد در سری' },
  { key: 'packPrice', label: 'قیمت سری' },
  { key: 'url', label: 'لینک محصول' },
];

const SAMPLE: Record<Channel, Record<Token, string>> = {
  RETAIL: {
    name: 'مانتو جلوباز کتان مدل کیان',
    sku: '332',
    fabric: 'کتان ۴۳۰ گرم کجراه',
    sizes: 'فری سایز (مناسب از ۳۸ تا ۴۸)',
    colors: 'مشکی، زیتونی، زرشکی، خاکی، کرمی',
    colorCount: '۵ رنگ',
    length: '۷۵ سانتی متر',
    price: '1/207/000',
    packQty: '',
    packPrice: '',
    url: 'https://www.poshaktaranom.ir/products/kian',
  },
  WHOLESALE: {
    name: 'مانتو جلوباز کتان مدل کیان',
    sku: '332',
    fabric: 'کتان ۴۳۰ گرم کجراه',
    sizes: 'فری سایز (مناسب از ۳۸ تا ۴۸)',
    colors: 'مشکی، زیتونی، زرشکی، خاکی، کرمی',
    colorCount: '۵ رنگ',
    length: '۷۵ سانتی متر',
    price: '1/207/000',
    packQty: '۵ عدد',
    packPrice: '6/035/000',
    url: 'https://www.poshaktaranom.com/products/kian',
  },
};

const BUTTON_PRESETS: Record<Channel, TemplateButton[]> = {
  RETAIL: [
    { label: '🛍 خرید در سایت', url: '{url}' },
    { label: '💬 مشاوره در تلگرام', url: 'https://t.me/Taranomrashid' },
  ],
  WHOLESALE: [
    { label: '📩 ثبت سفارش همکاری', url: 'https://t.me/Taranomrashid' },
    { label: '🌐 مشاهده در سایت', url: '{url}' },
  ],
};

function nid() {
  return `b${Math.random().toString(36).slice(2, 8)}`;
}

function defaultOptions(): TemplateOptions {
  return { mediaMode: 'album', parseMode: 'HTML', buttons: [], silent: false, protectContent: false, captionAbove: false, linkPreview: false };
}

function wholesale(): Layout {
  return {
    v: 1,
    options: defaultOptions(),
    blocks: [
      { id: 'p1', type: 'photos', enabled: true, maxPhotos: 5 },
      { id: 't1', type: 'title', enabled: true, emoji: '🌿', token: 'name' },
      { id: 'f1', type: 'field', enabled: true, emoji: '▫️', label: 'جنس', token: 'fabric' },
      { id: 'f2', type: 'field', enabled: true, emoji: '▫️', label: 'سایزبندی', token: 'sizes' },
      { id: 'f3', type: 'field', enabled: true, emoji: '▫️', label: 'قد کار', token: 'length' },
      { id: 'f4', type: 'field', enabled: true, emoji: '▫️', label: 'رنگبندی', token: 'colorCount' },
      { id: 'f5', type: 'field', enabled: true, emoji: '▫️', label: 'کد', token: 'sku' },
      { id: 'f6', type: 'field', enabled: true, emoji: '💵', label: 'قیمت', token: 'price', suffix: ' تومان' },
      { id: 'f7', type: 'field', enabled: true, emoji: '📦', label: 'تعداد در هر سری', token: 'packQty' },
      { id: 'q1', type: 'trust', enabled: true, emoji: '✅', text: 'پارچه شست شده' },
      { id: 'q2', type: 'trust', enabled: true, emoji: '✅', text: 'بدون آبرفت پس از شستشو' },
      { id: 'q3', type: 'trust', enabled: true, emoji: '✅', text: 'بدون رنگ‌دهی' },
      { id: 'q4', type: 'trust', enabled: true, emoji: '✅', text: 'دوخت تمیز و کیفیت تضمین‌شده' },
      { id: 'q5', type: 'trust', enabled: true, emoji: '✅', text: 'تولید مستقیم از تولیدی ترنم' },
      { id: 'x1', type: 'text', enabled: true, text: '📦 فروش به صورت عمده' },
      { id: 'x2', type: 'text', enabled: true, text: '🚚 ارسال به سراسر ایران' },
      { id: 'x3', type: 'text', enabled: true, text: '📩 ثبت سفارش و استعلام قیمت همکاری:' },
      { id: 'x4', type: 'text', enabled: true, text: '@Taranomrashid' },
      { id: 'x5', type: 'text', enabled: true, text: '☎️ تماس:09152424624' },
      { id: 'x6', type: 'text', enabled: true, text: '📢 کانال تولیدی ترنم:' },
      { id: 'x7', type: 'text', enabled: true, text: '@toliditaranom' },
      { id: 'x8', type: 'text', enabled: true, text: '#تولیدی_ترنم #فروش_عمده #پوشاک_زنانه' },
    ],
  };
}

function retail(): Layout {
  return {
    v: 1,
    options: defaultOptions(),
    blocks: [
      { id: 'p1', type: 'photos', enabled: true, maxPhotos: 5 },
      { id: 't1', type: 'title', enabled: true, emoji: '🌿', token: 'name' },
      { id: 'f1', type: 'field', enabled: true, emoji: '▫️', label: 'جنس', token: 'fabric' },
      { id: 'f2', type: 'field', enabled: true, emoji: '▫️', label: 'سایزبندی', token: 'sizes' },
      { id: 'f3', type: 'field', enabled: true, emoji: '▫️', label: 'قد کار', token: 'length' },
      { id: 'f4', type: 'field', enabled: true, emoji: '▫️', label: 'رنگبندی', token: 'colors' },
      { id: 'f5', type: 'field', enabled: true, emoji: '▫️', label: 'کد', token: 'sku' },
      { id: 'f6', type: 'field', enabled: true, emoji: '💵', label: 'قیمت', token: 'price', suffix: ' تومان' },
      { id: 'x1', type: 'text', enabled: true, text: '{url}' },
    ],
  };
}

function defaults(channel: Channel) {
  return channel === 'WHOLESALE' ? wholesale() : retail();
}

function compact(value: string) {
  return value.replace(/\s+/g, '');
}

function isLegacy(body?: string): boolean {
  const raw = String(body || '').trim();
  if (!raw) return true;
  if (compact(raw) === compact('{name} — {price} تومان\n{url}')) return true;
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { v?: unknown; blocks?: Array<{ type?: unknown; text?: unknown }> };
      if (parsed.v === 1 && Array.isArray(parsed.blocks) && parsed.blocks.length === 1 && parsed.blocks[0]?.type === 'text') {
        return isLegacy(String(parsed.blocks[0].text || ''));
      }
      return false;
    } catch {
      return true;
    }
  }
  return raw.includes('{name}') && raw.includes('{price}') && raw.includes('{url}') && raw.length < 96;
}

function parseOptions(raw: unknown): TemplateOptions {
  const out = defaultOptions();
  if (!raw || typeof raw !== 'object') return out;
  const row = raw as Partial<TemplateOptions>;
  if (row.mediaMode === 'single' || row.mediaMode === 'text' || row.mediaMode === 'album') out.mediaMode = row.mediaMode;
  if (row.parseMode === 'PLAIN' || row.parseMode === 'HTML') out.parseMode = row.parseMode;
  out.silent = row.silent === true;
  out.protectContent = row.protectContent === true;
  out.captionAbove = row.captionAbove === true;
  out.linkPreview = row.linkPreview === true;
  if (Array.isArray(row.buttons)) {
    out.buttons = row.buttons
      .filter((b): b is TemplateButton => !!b && typeof b.label === 'string' && typeof b.url === 'string')
      .slice(0, BUTTON_LIMIT)
      .map((b) => ({ label: b.label, url: b.url }));
  }
  return out;
}

function parseBody(body: string | undefined, channel: Channel): Layout {
  if (isLegacy(body)) return defaults(channel);
  const raw = String(body || '').trim();
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { v?: unknown; blocks?: Block[]; options?: unknown };
      if (parsed?.v === 1 && Array.isArray(parsed.blocks) && parsed.blocks.length) {
        return { v: 1, blocks: parsed.blocks, options: parseOptions(parsed.options) };
      }
    } catch {
      /* fall through */
    }
  }
  if (raw) return { v: 1, blocks: [{ id: 'legacy', type: 'text', enabled: true, text: raw }], options: { ...defaultOptions(), parseMode: 'PLAIN' } };
  return defaults(channel);
}

function esc(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Client mirror of the API renderer so the preview matches what Telegram receives. */
function renderSample(layout: Layout, vars: Record<Token, string>): Rendered & { photoCap: number } {
  const html = layout.options.parseMode === 'HTML';
  const e = html ? esc : (v: string) => v;
  const bold = (v: string) => (html ? `<b>${v}</b>` : v);
  const sub = (text: string) => text.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => e(vars[key as Token] || ''));
  const lines: string[] = [];
  let maxPhotos = 0;
  for (const block of layout.blocks) {
    if (!block.enabled) continue;
    if (block.type === 'photos') { maxPhotos = Math.max(maxPhotos, block.maxPhotos); continue; }
    if (block.type === 'title') {
      const value = (vars[block.token] || '').trim();
      if (value) lines.push(`${block.emoji ? `${e(block.emoji)} ` : ''}${bold(e(value))}`.trim());
      continue;
    }
    if (block.type === 'field') {
      const value = (vars[block.token] || '').trim();
      if (!value) continue;
      const prefix = block.label ? `${e(block.emoji)} ${e(block.label)}: ` : `${e(block.emoji)} `;
      const shown = block.token === 'price' || block.token === 'packPrice' ? bold(e(value)) : e(value);
      lines.push(`${prefix}${shown}${e(block.suffix || '')}`.trim());
      continue;
    }
    if (block.type === 'trust') {
      const text = sub(e(block.text)).trim();
      if (text) lines.push(`${block.emoji ? `${e(block.emoji)} ` : ''}${text}`.trim());
      continue;
    }
    const text = sub(e(block.text)).trim();
    if (text) lines.push(text);
  }
  const mode = layout.options.mediaMode;
  const photoCap = mode === 'text' ? 0 : mode === 'single' ? Math.min(1, maxPhotos) : maxPhotos;
  const buttons = layout.options.buttons
    .map((b) => ({ label: b.label, url: b.url.replace(/\{url\}/g, vars.url) }))
    .filter((b) => b.label.trim() && buttonUrlProblem(b.url) === null);
  return {
    text: lines.join('\n'),
    photoUrls: [],
    photoCap,
    mediaMode: photoCap === 0 ? 'text' : photoCap === 1 ? 'single' : 'album',
    parseMode: layout.options.parseMode,
    buttons,
    silent: layout.options.silent,
    protectContent: layout.options.protectContent,
    captionAbove: layout.options.captionAbove,
    linkPreview: layout.options.linkPreview,
  };
}

function buttonUrlProblem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'لینک خالی است';
  if (value === '{url}') return null;
  try {
    const url = new URL(value.replace(/\{url\}/g, 'https://www.poshaktaranom.ir/x'));
    if (url.protocol !== 'https:') return 'فقط https مجاز است';
    if (!BUTTON_HOSTS.includes(url.hostname.toLowerCase())) return 'فقط دامنه ترنم یا t.me';
    return null;
  } catch {
    return 'لینک معتبر نیست';
  }
}

function blockLabel(block: Block) {
  if (block.type === 'photos') return 'عکس‌های محصول';
  if (block.type === 'title') return 'عنوان';
  if (block.type === 'field') return block.label || 'مشخصه';
  if (block.type === 'trust') return 'ضمانت';
  return 'متن آزاد';
}

function visibleLength(text: string) {
  return text.replace(/<\/?b>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').length;
}

export function AdminTelegramTemplateBuilder({
  channel,
  template,
  saving,
  onSave,
}: {
  channel: Channel;
  template: Template | undefined;
  saving: boolean;
  onSave: (body: string) => Promise<void>;
}) {
  const [layout, setLayout] = useState<Layout>(() => parseBody(template?.body, channel));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(parseBody(template?.body, channel)));
  const [panel, setPanel] = useState<'content' | 'display'>('content');

  useEffect(() => {
    const next = parseBody(template?.body, channel);
    setLayout(next);
    setSavedJson(JSON.stringify(next));
  }, [channel, template?.id, template?.body]);

  const sample = SAMPLE[channel];
  const rendered = useMemo(() => renderSample(layout, sample), [layout, sample]);
  const dirty = JSON.stringify(layout) !== savedJson;
  const hasTitle = layout.blocks.some((row) => row.type === 'title' && row.enabled);
  const legacy = isLegacy(template?.body);
  const textLen = visibleLength(rendered.text || '');
  const limit = rendered.photoCap > 0 ? CAPTION_LIMIT : TEXT_LIMIT;
  const overflow = textLen > limit;
  const buttonsOnAlbum = layout.options.buttons.length > 0 && rendered.photoCap > 1;
  const photoBlock = layout.blocks.find((row): row is Extract<Block, { type: 'photos' }> => row.type === 'photos');

  const setOptions = (patch: Partial<TemplateOptions>) => setLayout((cur) => ({ ...cur, options: { ...cur.options, ...patch } }));
  const update = (id: string, patch: Partial<Block>) => {
    setLayout((cur) => ({ ...cur, blocks: cur.blocks.map((row) => (row.id === id ? ({ ...row, ...patch } as Block) : row)) }));
  };
  const move = (id: string, dir: -1 | 1) => {
    setLayout((cur) => {
      const index = cur.blocks.findIndex((row) => row.id === id);
      const next = index + dir;
      if (index < 0 || next < 0 || next >= cur.blocks.length) return cur;
      const blocks = [...cur.blocks];
      const [item] = blocks.splice(index, 1);
      blocks.splice(next, 0, item);
      return { ...cur, blocks };
    });
  };
  const remove = (id: string) => setLayout((cur) => ({ ...cur, blocks: cur.blocks.filter((row) => row.id !== id) }));
  const add = (type: Block['type']) => {
    const block: Block = type === 'photos'
      ? { id: nid(), type, enabled: true, maxPhotos: 5 }
      : type === 'title'
        ? { id: nid(), type, enabled: true, emoji: '🌿', token: 'name' }
        : type === 'field'
          ? { id: nid(), type, enabled: true, emoji: '▫️', label: 'مشخصه', token: 'fabric' }
          : type === 'trust'
            ? { id: nid(), type, enabled: true, emoji: '✅', text: '' }
            : { id: nid(), type, enabled: true, text: '' };
    setLayout((cur) => ({ ...cur, blocks: type === 'photos' ? [block, ...cur.blocks] : [...cur.blocks, block] }));
  };
  const setButton = (index: number, patch: Partial<TemplateButton>) => {
    setOptions({ buttons: layout.options.buttons.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  };
  const ensurePhotos = (enabled: boolean) => {
    if (!enabled) {
      setLayout((cur) => ({ ...cur, blocks: cur.blocks.map((row) => (row.type === 'photos' ? { ...row, enabled: false } : row)) }));
      return;
    }
    if (photoBlock) update(photoBlock.id, { enabled: true });
    else add('photos');
  };
  const chooseMedia = (mode: MediaMode) => {
    setOptions({ mediaMode: mode });
    ensurePhotos(mode !== 'text');
  };

  const canSave = hasTitle && !saving && (dirty || legacy);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={!canSave} onClick={() => void onSave(JSON.stringify({ v: 1, blocks: layout.blocks, options: layout.options }))}>
          {saving ? 'در حال ذخیره…' : legacy ? `فعال‌سازی قالب ${channel === 'WHOLESALE' ? 'عمده' : 'تکی'}` : 'ذخیره قالب'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLayout(defaults(channel))}>
          بازگشت به قالب پیشنهادی
        </button>
        {dirty ? <Badge tone="warn">تغییرات ذخیره نشده</Badge> : legacy ? <Badge tone="warn">قالب قدیمی روی سرور</Badge> : <Badge tone="ok">ذخیره‌شده · نسخه {faNumber(template?.version || 1)}</Badge>}
        <span className={`text-xs ${overflow ? 'text-red-600' : textLen > limit * 0.85 ? 'text-amber-700' : 'text-gray-500'}`}>
          طول متن نمونه {faNumber(textLen)} از {faNumber(limit)}
        </span>
      </div>

      {!hasTitle && <Callout tone="warn">عنوان خاموش است؛ بدون نام محصول پست معنی ندارد. یکی از بلوک‌های «عنوان» را روشن کنید.</Callout>}
      {overflow && (
        <Callout tone="warn">
          متن از سقف {rendered.photoCap > 0 ? 'کپشن (۱۰۲۴ کاراکتر)' : 'پیام (۴۰۹۶ کاراکتر)'} بلندتر است؛ تلگرام آن را در پیام دوم می‌فرستد. برای پست یک‌تکه چند خط را خاموش کنید.
        </Callout>
      )}
      {buttonsOnAlbum && (
        <Callout tone="info">تلگرام زیر آلبوم دکمه نمی‌گذارد. با حالت آلبوم، دکمه‌ها فقط وقتی متن در پیام جدا برود نمایش داده می‌شوند. برای دکمه همیشگی، «یک عکس» را انتخاب کنید.</Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3 min-w-0">
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit" role="tablist">
            {([['content', 'محتوای پست'], ['display', 'نمایش و دکمه‌ها']] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={panel === id} className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer ${panel === id ? 'bg-white shadow-sm font-medium' : 'text-gray-600'}`} onClick={() => setPanel(id)}>
                {label}
              </button>
            ))}
          </div>

          {panel === 'content' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 leading-5">
                هر خط یک بلوک است. خط‌ها را روشن/خاموش کنید، جابه‌جا کنید یا متن‌شان را عوض کنید. مقدار داخل {'{ }'} از همان محصول پر می‌شود.
              </p>
              <ul className="space-y-1.5">
                {layout.blocks.map((block, index) => (
                  <li key={block.id} className={`rounded-xl border p-2.5 ${block.enabled ? 'bg-white' : 'bg-gray-50 opacity-70'}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="h-4 w-4 cursor-pointer" checked={block.enabled} onChange={(e) => update(block.id, { enabled: e.target.checked })} aria-label={`نمایش ${blockLabel(block)}`} />
                      <span className="text-xs text-gray-500 w-20 shrink-0">{blockLabel(block)}</span>
                      <div className="flex-1 min-w-0">
                        {block.type === 'photos' && (
                          <div className="flex items-center gap-2 text-sm">
                            <span>تا</span>
                            <input type="number" min={1} max={10} className="border rounded-lg px-2 py-1 text-sm w-16" value={block.maxPhotos} onChange={(e) => update(block.id, { maxPhotos: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} aria-label="حداکثر عکس" />
                            <span>عکس اول محصول</span>
                          </div>
                        )}
                        {block.type === 'title' && (
                          <div className="flex gap-2">
                            <input className="border rounded-lg px-2 py-1 text-sm w-14 text-center" value={block.emoji} onChange={(e) => update(block.id, { emoji: e.target.value })} aria-label="ایموجی" />
                            <select className="border rounded-lg px-2 py-1 text-sm flex-1" value={block.token} onChange={(e) => update(block.id, { token: e.target.value as Token })}>
                              {TOKENS.map((token) => <option key={token.key} value={token.key}>{token.label}</option>)}
                            </select>
                          </div>
                        )}
                        {block.type === 'field' && (
                          <div className="flex flex-wrap gap-2">
                            <input className="border rounded-lg px-2 py-1 text-sm w-14 text-center" value={block.emoji} onChange={(e) => update(block.id, { emoji: e.target.value })} aria-label="ایموجی" />
                            <input className="border rounded-lg px-2 py-1 text-sm w-32" value={block.label} onChange={(e) => update(block.id, { label: e.target.value })} aria-label="برچسب" placeholder="برچسب" />
                            <select className="border rounded-lg px-2 py-1 text-sm flex-1 min-w-[8rem]" value={block.token} onChange={(e) => update(block.id, { token: e.target.value as Token })}>
                              {TOKENS.map((token) => <option key={token.key} value={token.key}>{token.label}</option>)}
                            </select>
                            <input className="border rounded-lg px-2 py-1 text-sm w-24" value={block.suffix || ''} onChange={(e) => update(block.id, { suffix: e.target.value })} aria-label="پسوند" placeholder="پسوند" />
                          </div>
                        )}
                        {(block.type === 'trust' || block.type === 'text') && (
                          <div className="flex gap-2">
                            {block.type === 'trust' && (
                              <input className="border rounded-lg px-2 py-1 text-sm w-14 text-center" value={block.emoji} onChange={(e) => update(block.id, { emoji: e.target.value })} aria-label="ایموجی" />
                            )}
                            <input className="border rounded-lg px-2 py-1 text-sm flex-1" value={block.text} onChange={(e) => update(block.id, { text: e.target.value })} aria-label="متن" placeholder="متن خط" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" className="text-xs border rounded px-1.5 py-1 disabled:opacity-30 cursor-pointer" disabled={index === 0} onClick={() => move(block.id, -1)} aria-label="بالا">↑</button>
                        <button type="button" className="text-xs border rounded px-1.5 py-1 disabled:opacity-30 cursor-pointer" disabled={index === layout.blocks.length - 1} onClick={() => move(block.id, 1)} aria-label="پایین">↓</button>
                        <button type="button" className="text-xs text-red-600 px-1.5 py-1 cursor-pointer" onClick={() => remove(block.id)} aria-label="حذف">✕</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-gray-500">افزودن خط:</span>
                {(['field', 'trust', 'text', 'title'] as const).map((type) => (
                  <button key={type} type="button" className="text-xs border rounded-lg px-2 py-1 bg-white hover:bg-gray-50 cursor-pointer" onClick={() => add(type)}>
                    + {type === 'title' ? 'عنوان' : type === 'field' ? 'مشخصه محصول' : type === 'trust' ? 'ضمانت' : 'متن ثابت'}
                  </button>
                ))}
                {!photoBlock && (
                  <button type="button" className="text-xs border rounded-lg px-2 py-1 bg-white hover:bg-gray-50 cursor-pointer" onClick={() => add('photos')}>+ عکس‌ها</button>
                )}
              </div>
            </div>
          )}

          {panel === 'display' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">عکس‌ها</p>
                <RadioCards<MediaMode>
                  name="media-mode"
                  value={layout.options.mediaMode}
                  onChange={chooseMedia}
                  options={[
                    { value: 'album', title: 'آلبوم', hint: `چند عکس (تا ${faNumber(photoBlock?.maxPhotos || 5)}) با متن زیر عکس اول. بدون دکمه.`, badge: 'پیش‌فرض', tone: 'ok' },
                    { value: 'single', title: 'یک عکس', hint: 'عکس اصلی + متن + دکمه‌های شیشه‌ای زیر پست.', badge: 'با دکمه', tone: 'info' },
                    { value: 'text', title: 'فقط متن', hint: 'بدون عکس؛ می‌تواند پیش‌نمایش لینک داشته باشد.' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">قالب متن</p>
                <RadioCards<ParseMode>
                  name="parse-mode"
                  value={layout.options.parseMode}
                  onChange={(parseMode) => setOptions({ parseMode })}
                  columns={2}
                  options={[
                    { value: 'HTML', title: 'پررنگ حرفه‌ای', hint: 'نام محصول و قیمت بولد می‌شوند؛ کاراکترهای خاص خودکار ایمن می‌شوند.', badge: 'پیشنهادی', tone: 'ok' },
                    { value: 'PLAIN', title: 'ساده', hint: 'متن دقیقاً همان‌طور که نوشته‌اید می‌رود؛ بدون بولد.' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">دکمه‌های زیر پست <span className="text-xs text-gray-500">({faNumber(layout.options.buttons.length)} از {faNumber(BUTTON_LIMIT)})</span></p>
                  <div className="flex gap-1">
                    {layout.options.buttons.length === 0 && (
                      <button type="button" className="text-xs border rounded-lg px-2 py-1 bg-white hover:bg-gray-50 cursor-pointer" onClick={() => setOptions({ buttons: BUTTON_PRESETS[channel] })}>
                        دکمه‌های پیشنهادی
                      </button>
                    )}
                    <button type="button" className="text-xs border rounded-lg px-2 py-1 bg-white hover:bg-gray-50 disabled:opacity-40 cursor-pointer" disabled={layout.options.buttons.length >= BUTTON_LIMIT} onClick={() => setOptions({ buttons: [...layout.options.buttons, { label: '', url: '{url}' }] })}>
                      + دکمه
                    </button>
                  </div>
                </div>
                {layout.options.buttons.length === 0 ? (
                  <p className="text-xs text-gray-500 leading-5">دکمه یعنی کاربر بدون کپی‌کردن لینک، با یک لمس به صفحه محصول یا چت ادمین برسد. {'{url}'} همیشه لینک همان محصول است.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {layout.options.buttons.map((button, index) => {
                      const problem = buttonUrlProblem(button.url);
                      return (
                        <li key={index} className="rounded-xl border bg-white p-2.5 space-y-1.5">
                          <div className="flex flex-wrap gap-2">
                            <input className="border rounded-lg px-2 py-1 text-sm w-44" maxLength={40} value={button.label} onChange={(e) => setButton(index, { label: e.target.value })} placeholder="متن دکمه" aria-label="متن دکمه" />
                            <input className={`border rounded-lg px-2 py-1 text-sm flex-1 min-w-[12rem] font-mono ${problem ? 'border-red-300' : ''}`} dir="ltr" value={button.url} onChange={(e) => setButton(index, { url: e.target.value })} placeholder="{url} یا https://t.me/..." aria-label="لینک دکمه" />
                            <button type="button" className="text-xs text-red-600 px-1.5 cursor-pointer" onClick={() => setOptions({ buttons: layout.options.buttons.filter((_, i) => i !== index) })} aria-label="حذف دکمه">✕</button>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <button type="button" className="border rounded px-1.5 py-0.5 cursor-pointer" onClick={() => setButton(index, { url: '{url}' })}>لینک محصول</button>
                            <button type="button" className="border rounded px-1.5 py-0.5 cursor-pointer" onClick={() => setButton(index, { url: 'https://t.me/Taranomrashid' })}>چت ادمین</button>
                            <button type="button" className="border rounded px-1.5 py-0.5 cursor-pointer" onClick={() => setButton(index, { url: 'https://t.me/toliditaranom' })}>کانال عمده</button>
                            {problem ? <span className="text-red-600">{problem}</span> : <span className="text-emerald-700">لینک مجاز</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <Toggle checked={layout.options.silent} onChange={(silent) => setOptions({ silent })} label="ارسال بی‌صدا" hint="اعضا نوتیفیکیشن نمی‌گیرند؛ برای کانال‌های پرپست مناسب است." />
                <Toggle checked={layout.options.protectContent} onChange={(protectContent) => setOptions({ protectContent })} label="جلوگیری از فوروارد و ذخیره" hint="عکس و متن قابل فوروارد یا ذخیره نیست. برای عمده که قیمت محرمانه است." />
                <Toggle checked={layout.options.captionAbove} onChange={(captionAbove) => setOptions({ captionAbove })} label="متن بالای عکس" hint="متن قبل از عکس‌ها دیده می‌شود (نسخه‌های جدید تلگرام)." disabled={layout.options.mediaMode === 'text'} />
                <Toggle checked={layout.options.linkPreview} onChange={(linkPreview) => setOptions({ linkPreview })} label="پیش‌نمایش لینک" hint="فقط در حالت «فقط متن»؛ کارت لینک سایت زیر پیام می‌آید." disabled={layout.options.mediaMode !== 'text'} />
              </div>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-4 self-start space-y-2">
          <TelegramPreview rendered={rendered} placeholders={rendered.photoCap} title={`پیش‌نمایش با نمونه (${channel === 'WHOLESALE' ? 'عمده' : 'تکی'})`} />
          <p className="text-[11px] text-gray-500 leading-5 text-center">
            داده نمونه است؛ در ارسال واقعی نام، قیمت، مشخصات و عکس‌های همان محصول جای آن می‌نشیند.
          </p>
        </div>
      </div>
    </div>
  );
}
