'use client';

import { useEffect, useMemo, useState } from 'react';

type Channel = 'RETAIL' | 'WHOLESALE';
type Token =
  | 'name' | 'sku' | 'fabric' | 'sizes' | 'colors' | 'colorCount'
  | 'length' | 'price' | 'packQty' | 'packPrice' | 'url';

type Block =
  | { id: string; type: 'photos'; enabled: boolean; maxPhotos: number }
  | { id: string; type: 'title'; enabled: boolean; emoji: string; token: Token }
  | { id: string; type: 'field'; enabled: boolean; emoji: string; label: string; token: Token; suffix?: string }
  | { id: string; type: 'trust'; enabled: boolean; emoji: string; text: string }
  | { id: string; type: 'text'; enabled: boolean; text: string };

type Layout = { v: 1; blocks: Block[] };

const TOKENS: Array<{ key: Token; label: string }> = [
  { key: 'name', label: 'نام' },
  { key: 'sku', label: 'کد' },
  { key: 'fabric', label: 'جنس' },
  { key: 'sizes', label: 'سایز' },
  { key: 'colors', label: 'رنگ‌ها' },
  { key: 'colorCount', label: 'تعداد رنگ' },
  { key: 'length', label: 'قد' },
  { key: 'price', label: 'قیمت' },
  { key: 'packQty', label: 'تعداد سری' },
  { key: 'packPrice', label: 'قیمت سری' },
  { key: 'url', label: 'لینک' },
];

const SAMPLE: Record<Token, string> = {
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
  url: 'https://www.poshaktaranom.ir/products/kian',
};

function nid() {
  return `b${Math.random().toString(36).slice(2, 8)}`;
}

function wholesale(): Layout {
  return {
    v: 1,
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

function parseBody(body: string | undefined, channel: Channel): Layout {
  if (isLegacy(body)) return channel === 'WHOLESALE' ? wholesale() : retail();
  const raw = String(body || '').trim();
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Layout;
      if (parsed?.v === 1 && Array.isArray(parsed.blocks) && parsed.blocks.length) return parsed;
    } catch {
      /* legacy */
    }
  }
  if (raw) return { v: 1, blocks: [{ id: 'legacy', type: 'text', enabled: true, text: raw }] };
  return channel === 'WHOLESALE' ? wholesale() : retail();
}

function tokenOf(vars: Record<string, string>, token: Token) {
  return String(vars[token] || '').trim();
}

function renderText(layout: Layout, vars: Record<string, string>) {
  const lines: string[] = [];
  for (const block of layout.blocks) {
    if (!block.enabled) continue;
    if (block.type === 'photos') continue;
    if (block.type === 'title') {
      const value = tokenOf(vars, block.token);
      if (value) lines.push(`${block.emoji} ${value}`.trim());
      continue;
    }
    if (block.type === 'field') {
      const value = tokenOf(vars, block.token);
      if (!value) continue;
      lines.push(`${block.emoji} ${block.label}: ${value}${block.suffix || ''}`.trim());
      continue;
    }
    if (block.type === 'trust') {
      if (block.text.trim()) lines.push(`${block.emoji} ${block.text}`.trim());
      continue;
    }
    const text = block.text.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => vars[key] || '');
    if (text.trim()) lines.push(text.trim());
  }
  return lines.join('\n');
}

function blockLabel(block: Block) {
  if (block.type === 'photos') return 'آلبوم عکس محصول';
  if (block.type === 'title') return 'عنوان';
  if (block.type === 'field') return block.label || 'مشخصه';
  if (block.type === 'trust') return 'ضمانت';
  return 'متن آزاد';
}

export function AdminTelegramTemplateBuilder({
  channel,
  eventType,
  templates,
  onEventType,
  onSave,
}: {
  channel: Channel;
  eventType: string;
  templates: Array<{ id: string; channel: string; eventType: string; body?: string; version: number }>;
  onEventType: (value: string) => void;
  onSave: (body: string) => Promise<void>;
}) {
  const saved = templates.find((row) => row.channel === channel && row.eventType === eventType);
  const [advanced, setAdvanced] = useState(false);
  const [layout, setLayout] = useState<Layout>(() => parseBody(saved?.body, channel));

  useEffect(() => {
    setLayout(parseBody(saved?.body, channel));
  }, [channel, eventType, saved?.id, saved?.body]);

  const preview = useMemo(() => renderText(layout, SAMPLE), [layout]);
  const photoBlock = layout.blocks.find((row) => row.type === 'photos' && row.enabled) as Extract<Block, { type: 'photos' }> | undefined;
  const summary = layout.blocks.filter((row) => row.enabled).map((row) => blockLabel(row));
  const ready = Boolean(photoBlock && layout.blocks.some((row) => row.type === 'title' && row.enabled));

  const update = (id: string, patch: Partial<Block>) => {
    setLayout((cur) => ({
      v: 1,
      blocks: cur.blocks.map((row) => (row.id === id ? ({ ...row, ...patch } as Block) : row)),
    }));
  };

  const move = (id: string, dir: -1 | 1) => {
    setLayout((cur) => {
      const index = cur.blocks.findIndex((row) => row.id === id);
      const next = index + dir;
      if (index < 0 || next < 0 || next >= cur.blocks.length) return cur;
      const blocks = [...cur.blocks];
      const [item] = blocks.splice(index, 1);
      blocks.splice(next, 0, item);
      return { v: 1, blocks };
    });
  };

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
    setLayout((cur) => ({ v: 1, blocks: [...cur.blocks, block] }));
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold">شکل پیام</h2>
        <p className="text-xs text-gray-500 mt-1">
          این اسکلت یک‌بار ذخیره می‌شود. ارسال بعدی اسم، قیمت، مشخصات و عکس همان محصول را داخل همین قالب می‌گذارد.
        </p>
        <p className={`text-xs mt-2 ${ready ? 'text-emerald-700' : 'text-amber-700'}`}>
          {ready ? 'قالب کانال آماده است.' : 'عکس یا عنوان خاموش است؛ قالب آماده را برگردانید.'}
        </p>
        {!advanced && (
          <ul className="mt-2 flex flex-wrap gap-1">
            {summary.map((item, index) => (
              <li key={`${item}-${index}`} className="rounded-full border bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700">{item}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLayout(channel === 'WHOLESALE' ? wholesale() : retail())}>
          برگرد به قالب آماده {channel === 'WHOLESALE' ? 'عمده' : 'تکی'}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void onSave(JSON.stringify(layout))}>
          افزودن قالب تلگرام
        </button>
        <button type="button" className="text-xs text-gray-600 underline self-center" onClick={() => setAdvanced((v) => !v)}>
          {advanced ? 'بستن تنظیم دقیق' : 'تنظیم دقیق بلوک‌ها'}
        </button>
      </div>
      <div className={`grid gap-4 ${advanced ? 'lg:grid-cols-2' : ''}`}>
        {advanced && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {(['photos', 'title', 'field', 'trust', 'text'] as const).map((type) => (
              <button key={type} type="button" className="text-xs border rounded-lg px-2 py-1" onClick={() => add(type)}>
                + {type === 'photos' ? 'عکس' : type === 'title' ? 'عنوان' : type === 'field' ? 'مشخصه' : type === 'trust' ? 'ضمانت' : 'متن'}
              </button>
            ))}
          </div>
          <label className="text-xs text-gray-500 space-y-1 block">
            <span>رویداد</span>
            <input className="border rounded-lg px-3 py-2 text-sm block w-full" value={eventType} onChange={(e) => onEventType(e.target.value)} />
          </label>
          <ul className="space-y-2 max-h-[36rem] overflow-auto">
            {layout.blocks.map((block) => (
              <li key={block.id} className="rounded-xl border bg-gray-50 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={block.enabled} onChange={(e) => update(block.id, { enabled: e.target.checked })} />
                    <span className="font-medium">{blockLabel(block)}</span>
                  </label>
                  <div className="flex gap-1">
                    <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => move(block.id, -1)}>بالا</button>
                    <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => move(block.id, 1)}>پایین</button>
                    <button type="button" className="text-xs text-red-600" onClick={() => setLayout((cur) => ({ v: 1, blocks: cur.blocks.filter((row) => row.id !== block.id) }))}>حذف</button>
                  </div>
                </div>
                {block.type === 'photos' && (
                  <label className="text-xs text-gray-500 block">
                    حداکثر عکس
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="border rounded-lg px-2 py-1 text-sm w-20 mr-2"
                      value={block.maxPhotos}
                      onChange={(e) => update(block.id, { maxPhotos: Number(e.target.value) })}
                    />
                  </label>
                )}
                {block.type === 'title' && (
                  <div className="flex gap-2">
                    <input className="border rounded-lg px-2 py-1 text-sm w-16" value={block.emoji} onChange={(e) => update(block.id, { emoji: e.target.value })} aria-label="ایموجی" />
                    <select className="border rounded-lg px-2 py-1 text-sm" value={block.token} onChange={(e) => update(block.id, { token: e.target.value as Token })}>
                      {TOKENS.map((token) => <option key={token.key} value={token.key}>{token.label}</option>)}
                    </select>
                  </div>
                )}
                {block.type === 'field' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input className="border rounded-lg px-2 py-1 text-sm" value={block.emoji} onChange={(e) => update(block.id, { emoji: e.target.value })} aria-label="ایموجی" />
                    <input className="border rounded-lg px-2 py-1 text-sm" value={block.label} onChange={(e) => update(block.id, { label: e.target.value })} aria-label="برچسب" />
                    <select className="border rounded-lg px-2 py-1 text-sm col-span-2" value={block.token} onChange={(e) => update(block.id, { token: e.target.value as Token })}>
                      {TOKENS.map((token) => <option key={token.key} value={token.key}>{token.label}</option>)}
                    </select>
                  </div>
                )}
                {(block.type === 'trust' || block.type === 'text') && (
                  <div className="flex gap-2">
                    {block.type === 'trust' && (
                      <input className="border rounded-lg px-2 py-1 text-sm w-16" value={block.emoji} onChange={(e) => update(block.id, { emoji: e.target.value })} aria-label="ایموجی" />
                    )}
                    <input className="border rounded-lg px-2 py-1 text-sm flex-1" value={block.text} onChange={(e) => update(block.id, { text: e.target.value })} aria-label="متن" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        )}
        <div className="rounded-3xl border bg-[#0e1621] text-white p-4 min-h-[28rem]">
          <p className="text-[11px] text-white/60 mb-3">پیش‌نمایش شبیه تلگرام — با داده نمونه کیان</p>
          {photoBlock && (
            <div className="grid grid-cols-6 gap-1 mb-3">
              <div className="col-span-3 h-24 rounded-lg bg-white/10" />
              <div className="col-span-3 h-24 rounded-lg bg-white/10" />
              {Array.from({ length: Math.max(0, Math.min(3, photoBlock.maxPhotos - 2)) }).map((_, i) => (
                <div key={i} className="col-span-2 h-16 rounded-lg bg-white/10" />
              ))}
            </div>
          )}
          <pre className="whitespace-pre-wrap text-[13px] leading-6 font-sans text-white/95">{preview}</pre>
        </div>
      </div>
    </div>
  );
}
