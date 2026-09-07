'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save, Loader2, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';

type Channel = 'WHOLESALE' | 'RETAIL';

interface ChromeDoc {
  title?: string;
  blocks?: Array<{ id: string; type: string; props: Record<string, unknown> }>;
}

function Toggle({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3">
      <span>
        <span className="block text-sm font-semibold text-gray-800">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-gray-500">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? 'right-0.5' : 'right-5'}`} />
      </button>
    </label>
  );
}

export function AdminOpsPanels() {
  return (
    <div className="mb-8 space-y-6">
      <AdminTickerPanel />
      <AdminSmsOpsPanel />
      <AdminPostShippingPanel />
    </div>
  );
}

function AdminTickerPanel() {
  const [channel, setChannel] = useState<Channel>('WHOLESALE');
  const [enabled, setEnabled] = useState(true);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('chrome');
  const [blocks, setBlocks] = useState<ChromeDoc['blocks']>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async (ch: Channel) => {
    setLoading(true);
    try {
      const data = await apiClient.get<ChromeDoc>(`/cms/admin/site-content/${ch}/chrome`);
      setTitle(data.title || 'chrome');
      const list = Array.isArray(data.blocks) ? data.blocks : [];
      setBlocks(list);
      const ann = list.find((b) => b.type === 'announcement');
      setEnabled(ann?.props?.enabled !== false);
      const items = Array.isArray(ann?.props?.tickerItems)
        ? (ann!.props.tickerItems as unknown[]).filter((x) => typeof x === 'string') as string[]
        : [];
      setText(items.join('\n'));
    } catch {
      setBlocks([]);
      setText('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(channel); }, [channel, load]);

  const save = async () => {
    setSaving(true);
    try {
      const tickerItems = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let next = [...(blocks ?? [])];
      const idx = next.findIndex((b) => b.type === 'announcement');
      const props = {
        ...(idx >= 0 ? next[idx].props : {}),
        enabled,
        tickerItems,
      };
      if (idx >= 0) next[idx] = { ...next[idx], props };
      else next = [{ id: `ann-${Date.now()}`, type: 'announcement', props }, ...next];
      await apiClient.put('/cms/admin/site-content', {
        channel,
        pageKey: 'chrome',
        title,
        blocks: next,
        isPublished: true,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">نوار روان صفحه اصلی</h2>
        <p className="mt-1 text-sm text-gray-500">
          هر خط یک خبر است. روی هوم تکی و عمده جداگانه ذخیره می‌شود. برای توقف، نوار را خاموش کنید.
        </p>
      </div>
      <div className="flex gap-2">
        {(['WHOLESALE', 'RETAIL'] as const).map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => setChannel(ch)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${channel === ch ? (ch === 'RETAIL' ? 'bg-amber-600 text-white' : 'bg-primary text-white') : 'bg-gray-100 text-gray-600'}`}
          >
            {ch === 'RETAIL' ? 'تکی' : 'عمده'}
          </button>
        ))}
      </div>
      {loading ? <div className="h-24 animate-pulse rounded-xl bg-gray-100" /> : (
        <>
          <Toggle label="نمایش نوار روان" value={enabled} onChange={setEnabled} />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="input w-full text-sm"
            placeholder="هر خط یک خبر"
          />
        </>
      )}
      <SaveRow saving={saving} saved={saved} onSave={save} />
    </section>
  );
}

function AdminSmsOpsPanel() {
  const [ops, setOps] = useState({
    retail: { orderPaidAdmin: true, abandonedCart: true, stockOutAdmin: true },
    wholesale: { orderPaidAdmin: true, abandonedCart: true, stockOutAdmin: true },
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient.get<{ smsOps?: typeof ops }>('/settings/admin').then((res) => {
      const src = res.smsOps;
      if (!src) return;
      setOps({
        retail: { ...ops.retail, ...src.retail },
        wholesale: { ...ops.wholesale, ...src.wholesale },
      });
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put('/settings/admin/smsOps', ops);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const labels: Record<string, string> = {
    orderPaidAdmin: 'سفارش با پرداخت قطعی — پیامک به ادمین',
    abandonedCart: 'سبد رهاشده بعد از ۳۰ دقیقه — پیامک به مشتری',
    stockOutAdmin: 'اتمام موجودی محصول — پیامک به ادمین',
  };

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">رویدادهای پیامک تکی و عمده</h2>
        <p className="mt-1 text-sm text-gray-500">
          شماره ادمین همان شماره‌های تب پیامک است. سفارش جدید فقط وقتی پرداخت قطعی شد پیامک می‌شود، نه هنگام ثبت پیش‌فاکتور.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(['wholesale', 'retail'] as const).map((side) => (
          <div key={side} className="space-y-2 rounded-2xl border border-gray-100 p-4">
            <p className="text-sm font-bold text-gray-800">{side === 'retail' ? 'سایت تکی' : 'سایت عمده'}</p>
            {Object.keys(labels).map((ev) => (
              <Toggle
                key={ev}
                label={labels[ev]}
                value={ops[side][ev as keyof typeof ops.retail] !== false}
                onChange={(v) => setOps((p) => ({ ...p, [side]: { ...p[side], [ev]: v } }))}
              />
            ))}
          </div>
        ))}
      </div>
      <SaveRow saving={saving} saved={saved} onSave={save} />
    </section>
  );
}

function AdminPostShippingPanel() {
  const [data, setData] = useState({
    enabled: false,
    originProvince: 'خراسان رضوی',
    originCity: 'مشهد',
    sameCityBase: 73000,
    sameProvinceBase: 83000,
    otherBase: 103000,
    extraKgFee: 18000,
    vatPercent: 10,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiClient.get<{ shippingPost?: Record<string, unknown> }>('/settings/admin').then((res) => {
      const s = res.shippingPost ?? {};
      setData((p) => ({
        ...p,
        enabled: s.enabled === true,
        originProvince: String(s.originProvince || p.originProvince),
        originCity: String(s.originCity || p.originCity),
        sameCityBase: Math.round((Number(s.sameCityBase) || p.sameCityBase * 10) / 10),
        sameProvinceBase: Math.round((Number(s.sameProvinceBase) || p.sameProvinceBase * 10) / 10),
        otherBase: Math.round((Number(s.otherBase) || p.otherBase * 10) / 10),
        extraKgFee: Math.round((Number(s.extraKgFee) || p.extraKgFee * 10) / 10),
        vatPercent: Number(s.vatPercent) || p.vatPercent,
      }));
    }).catch(() => undefined);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.put('/settings/admin/shippingPost', {
        enabled: data.enabled,
        originProvince: data.originProvince,
        originCity: data.originCity,
        sameCityBase: data.sameCityBase * 10,
        sameProvinceBase: data.sameProvinceBase * 10,
        otherBase: data.otherBase * 10,
        extraKgFee: data.extraKgFee * 10,
        vatPercent: data.vatPercent,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">محاسبه بسته پستی پیشتاز</h2>
        <p className="mt-1 text-sm text-gray-500">
          اگر فعال باشد، روش پست پیشتاز از استعلام آنلاین پست (و در صورت قطع بودن، نرخ محلی قابل‌ویرایش) حساب می‌شود. بقیه روش‌ها همان کارمزد قبلی را دارند.
        </p>
      </div>
      <Toggle
        label="فعال‌سازی محاسبه آنلاین/دقیق پست"
        hint="فقط برای پست پیشتاز"
        value={data.enabled}
        onChange={(v) => setData((p) => ({ ...p, enabled: v }))}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          استان مبدأ
          <input className="input mt-1 w-full" value={data.originProvince} onChange={(e) => setData((p) => ({ ...p, originProvince: e.target.value }))} />
        </label>
        <label className="text-sm">
          شهر مبدأ
          <input className="input mt-1 w-full" value={data.originCity} onChange={(e) => setData((p) => ({ ...p, originCity: e.target.value }))} />
        </label>
        <label className="text-sm">
          پایه هم‌شهر (تومان)
          <input type="number" className="input mt-1 w-full" value={data.sameCityBase} onChange={(e) => setData((p) => ({ ...p, sameCityBase: Number(e.target.value) || 0 }))} />
        </label>
        <label className="text-sm">
          پایه هم‌استان (تومان)
          <input type="number" className="input mt-1 w-full" value={data.sameProvinceBase} onChange={(e) => setData((p) => ({ ...p, sameProvinceBase: Number(e.target.value) || 0 }))} />
        </label>
        <label className="text-sm">
          پایه سایر استان‌ها (تومان)
          <input type="number" className="input mt-1 w-full" value={data.otherBase} onChange={(e) => setData((p) => ({ ...p, otherBase: Number(e.target.value) || 0 }))} />
        </label>
        <label className="text-sm">
          هر کیلو مازاد (تومان)
          <input type="number" className="input mt-1 w-full" value={data.extraKgFee} onChange={(e) => setData((p) => ({ ...p, extraKgFee: Number(e.target.value) || 0 }))} />
        </label>
      </div>
      <SaveRow saving={saving} saved={saved} onSave={save} />
    </section>
  );
}

function SaveRow({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onSave} disabled={saving} className="btn btn-primary btn-md inline-flex items-center gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        ذخیره
      </button>
      {saved ? <span className="inline-flex items-center gap-1 text-sm text-emerald-700"><CheckCircle className="h-4 w-4" /> ذخیره شد</span> : null}
    </div>
  );
}
