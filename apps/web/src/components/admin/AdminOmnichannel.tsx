'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient } from '@/lib/api';

type OosPolicy = 'UPDATE' | 'HIDE' | 'DELETE';
type Tab = 'setup' | 'policy' | 'publish' | 'ops';

type Status = {
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
  outbox?: {
    pending: number;
    processing: number;
    dead: number;
    oldestPendingAgeSec: number;
    staleLocks: number;
  };
};

type Connection = {
  id: string;
  provider: string;
  channel: string;
  name: string;
  secretRef: string;
  status: string;
};

type Destination = {
  id: string;
  connectionId: string;
  destinationKey: string;
  displayName: string;
  enabled: boolean;
  isCanary?: boolean;
};

type Template = {
  id: string;
  provider: string;
  channel: string;
  eventType: string;
  version: number;
  enabled?: boolean;
};

type Publication = {
  id: string;
  sourceId: string;
  channel: string;
  status: string;
};

type Delivery = {
  id: string;
  publicationId: string;
  status: string;
  action: string;
  lastError?: string | null;
};

type OutboxRow = {
  id: string;
  eventType: string;
  aggregateId: string;
  channel: string | null;
  status: string;
  attempts: number;
  lastError?: string | null;
};

type AuditRow = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  channel: string | null;
  reason: string | null;
};

type MediaRow = {
  id: string;
  publicUrl: string;
  altText: string;
  ownerType: string;
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'setup', label: 'راه‌اندازی' },
  { id: 'policy', label: 'سیاست' },
  { id: 'publish', label: 'انتشار' },
  { id: 'ops', label: 'عملیات' },
];

const FILTERS = [
  { key: 'ALL', label: 'همه' },
  { key: 'RETAIL', label: 'تکی' },
  { key: 'WHOLESALE', label: 'عمده' },
  { key: 'TELEGRAM', label: 'تلگرام' },
  { key: 'PENDING', label: 'در صف' },
  { key: 'DEAD', label: 'DEAD' },
  { key: 'DRAFT', label: 'پیش‌نویس' },
];

function channelLabel(channel: string) {
  return channel === 'WHOLESALE' ? 'عمده' : channel === 'RETAIL' ? 'تکی' : channel;
}

function Badge({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'off' | 'info';
  children: ReactNode;
}) {
  const cls = {
    ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    off: 'bg-gray-100 text-gray-600 border-gray-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = 'info',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn' | 'off' | 'info';
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
      {hint && <p className="mt-1"><Badge tone={tone}>{hint}</Badge></p>}
    </div>
  );
}

export function AdminOmnichannel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('setup');
  const [sourceId, setSourceId] = useState('');
  const [sourceType, setSourceType] = useState<'PRODUCT' | 'BLOG_POST' | 'CMS_PAGE'>('PRODUCT');
  const [channel, setChannel] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [filter, setFilter] = useState('ALL');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [reason, setReason] = useState('بازبینی ادمین');
  const [connName, setConnName] = useState('');
  const [secretRef, setSecretRef] = useState('TELEGRAM_BOT_TOKEN');
  const [retailOos, setRetailOos] = useState<OosPolicy>('UPDATE');
  const [wholesaleOos, setWholesaleOos] = useState<OosPolicy>('UPDATE');
  const [autoPublishEventTypes, setAutoPublishEventTypes] = useState<string[]>([
    'product.created',
    'product.content_changed',
    'product.price_changed',
    'product.visibility_changed',
    'product.media_changed',
    'product.withdrawn',
    'blog.published',
    'cms.published',
  ]);
  const [retrySlaSeconds, setRetrySlaSeconds] = useState(3600);
  const [outboxRetentionDays, setOutboxRetentionDays] = useState(90);
  const [destKey, setDestKey] = useState('');
  const [destName, setDestName] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [tplEvent, setTplEvent] = useState('product.published');
  const [tplBody, setTplBody] = useState('{name} — {price} تومان\n{url}');

  const load = useCallback(async () => {
    setError('');
    try {
      const [st, conns, dests, tpls, pubs, dels, box, logs, files] = await Promise.all([
        apiClient.get<Status>('/omnichannel/status'),
        apiClient.get<Connection[]>('/omnichannel/connections'),
        apiClient.get<Destination[]>('/omnichannel/destinations'),
        apiClient.get<Template[]>('/omnichannel/templates'),
        apiClient.get<Publication[]>('/omnichannel/publications'),
        apiClient.get<Delivery[]>('/omnichannel/deliveries'),
        apiClient.get<OutboxRow[]>('/omnichannel/outbox'),
        apiClient.get<AuditRow[]>('/omnichannel/audits'),
        apiClient.get<MediaRow[]>('/omnichannel/media').catch(() => []),
      ]);
      setStatus(st);
      if (st.retailOosPolicy) setRetailOos(st.retailOosPolicy);
      if (st.wholesaleOosPolicy) setWholesaleOos(st.wholesaleOosPolicy);
      if (st.autoPublishEventTypes?.length) setAutoPublishEventTypes(st.autoPublishEventTypes);
      if (typeof st.retrySlaSeconds === 'number') setRetrySlaSeconds(st.retrySlaSeconds);
      if (typeof st.outboxRetentionDays === 'number') setOutboxRetentionDays(st.outboxRetentionDays);
      setConnections(conns);
      setDestinations(dests);
      setTemplates(tpls);
      setPublications(pubs);
      setDeliveries(dels);
      setOutbox(box);
      setAudits(logs);
      setMedia(files);
      setConnectionId((current) => current || conns[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<void>, fallback: string, ok?: string) => {
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
      if (ok) setNotice(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    }
  };

  const matchFilter = (row: { channel?: string | null; status?: string; provider?: string }) => {
    if (filter === 'ALL') return true;
    if (filter === 'RETAIL' || filter === 'WHOLESALE') return row.channel === filter;
    if (filter === 'TELEGRAM' || filter === 'BALE' || filter === 'RUBIKA') return row.provider === filter;
    return row.status === filter;
  };

  const pendingOutbox = useMemo(
    () => outbox.filter((row) => row.status === 'PENDING' || row.status === 'PROCESSING').length,
    [outbox],
  );
  const deadOutbox = useMemo(() => outbox.filter((row) => row.status === 'DEAD').length, [outbox]);
  const activeTelegram = connections.some((row) => row.provider === 'TELEGRAM' && row.status === 'ACTIVE');
  const retailCanary = destinations.find((row) => row.id === status?.retailCanaryDestinationId);
  const setupReady = Boolean(status?.connectors && activeTelegram && status.retailCanaryDestinationId);

  if (loading && !status) {
    return <div className="p-6 text-sm text-gray-500">در حال بارگذاری کانال‌های انتشار…</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">کانال‌های انتشار</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            تلگرام فقط کانال اطلاع است، نه انبار. secretRef نام متغیر روی سرور است؛ توکن را اینجا ننویسید.
            ارسال زنده فقط به مقصد canary می‌رود. ثبت پیش‌نویس محصول را به تلگرام نمی‌فرستد.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
          تازه‌سازی
        </button>
      </div>

      {status && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Metric label="فاز هسته" value={`${status.phase}`} hint="یک API / یک دیتابیس" tone="info" />
          <Metric
            label="کانکتور / auto-publish"
            value={`${status.connectors ? 'روشن' : 'خاموش'} / ${status.autoPublish ? 'روشن' : 'خاموش'}`}
            hint={status.connectors ? 'تلگرام مجاز است' : 'پرچم سرور خاموش است'}
            tone={status.connectors ? 'ok' : 'warn'}
          />
          <Metric
            label="canary تکی"
            value={retailCanary ? retailCanary.displayName : 'انتخاب نشده'}
            hint={`سقف ${status.retailCanaryLimit} محصول`}
            tone={retailCanary ? 'ok' : 'warn'}
          />
          <Metric
            label="canary عمده"
            value={status.wholesaleCanaryDestinationId ? 'انتخاب شده' : 'خالی'}
            hint={`سقف ${status.wholesaleCanaryLimit} محصول`}
            tone={status.wholesaleCanaryDestinationId ? 'ok' : 'off'}
          />
          <Metric
            label="صف"
            value={`${status.outbox?.pending ?? pendingOutbox} در انتظار`}
            hint={`DEAD ${status.outbox?.dead ?? deadOutbox}${status.outbox ? ` / تأخیر ${status.outbox.oldestPendingAgeSec}ث` : ''}`}
            tone={(status.outbox?.dead ?? deadOutbox) > 0 ? 'warn' : 'ok'}
          />
        </div>
      )}

      <div className={`rounded-xl border p-3 text-sm ${setupReady ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
        {setupReady
          ? 'راه‌اندازی تکی آماده است: اتصال فعال، canary و کانکتور روشن.'
          : 'برای پیام واقعی: اتصال ACTIVE، مقصد عددی canary، و کانکتور روشن لازم است. شناسهٔ @username برای چت خصوصی معمولاً کار نمی‌کند.'}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="بخش‌های کانال انتشار">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer ${tab === item.id ? 'bg-gray-900 text-white' : 'bg-white'}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`px-3 py-1 rounded-full text-xs border cursor-pointer ${filter === item.key ? 'bg-gray-900 text-white' : 'bg-white'}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'setup' && (
        <>
          <section className="rounded-xl border bg-white p-4 space-y-3">
            <div>
              <h2 className="font-semibold">اتصال‌ها</h2>
              <p className="text-xs text-gray-500 mt-1">
                secretRef فقط نام env است (مثلاً TELEGRAM_BOT_TOKEN). تست = getMe. پیام فارسی آزمایشی از سرور می‌رود تا «؟؟؟» نشود.
              </p>
            </div>
            <div className="grid md:grid-cols-4 gap-2">
              <label className="text-xs text-gray-500 space-y-1">
                <span>نام اتصال</span>
                <input className="border rounded-lg px-3 py-2 text-sm w-full" placeholder="ربات تک" value={connName} onChange={(e) => setConnName(e.target.value)} />
              </label>
              <label className="text-xs text-gray-500 space-y-1">
                <span>secretRef</span>
                <input className="border rounded-lg px-3 py-2 text-sm w-full font-mono" placeholder="TELEGRAM_BOT_TOKEN" value={secretRef} onChange={(e) => setSecretRef(e.target.value.toUpperCase())} />
              </label>
              <label className="text-xs text-gray-500 space-y-1">
                <span>کانال</span>
                <select className="border rounded-lg px-3 py-2 text-sm w-full" value={channel} onChange={(e) => setChannel(e.target.value as 'RETAIL' | 'WHOLESALE')}>
                  <option value="RETAIL">تکی</option>
                  <option value="WHOLESALE">عمده</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!connName.trim()}
                  onClick={() => run(async () => {
                    await apiClient.post('/omnichannel/connections', {
                      provider: 'TELEGRAM',
                      channel,
                      name: connName,
                      secretRef,
                    });
                    setConnName('');
                  }, 'خطا در ثبت اتصال', 'اتصال ذخیره شد')}
                >
                  افزودن تلگرام
                </button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="p-2 text-right font-medium">نام</th>
                  <th className="p-2 text-right font-medium">ارائه‌دهنده / کانال</th>
                  <th className="p-2 text-right font-medium">secretRef</th>
                  <th className="p-2 text-right font-medium">وضعیت</th>
                  <th className="p-2 text-left font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {connections.filter(matchFilter).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.provider} / {channelLabel(row.channel)}</td>
                    <td className="p-2 font-mono text-xs">{row.secretRef}</td>
                    <td className="p-2">
                      <Badge tone={row.status === 'ACTIVE' ? 'ok' : 'off'}>{row.status}</Badge>
                    </td>
                    <td className="p-2 text-left space-x-3 space-x-reverse">
                      <button
                        type="button"
                        className="text-xs text-primary cursor-pointer"
                        onClick={() => run(async () => {
                          const res = await apiClient.post<{ ok?: boolean; error?: string }>(`/omnichannel/connections/${row.id}/test`, {});
                          if (res && res.ok === false) throw new Error(res.error || 'تست اتصال ناموفق');
                        }, 'تست اتصال ناموفق', 'ربات پاسخ داد (getMe)')}
                      >
                        تست
                      </button>
                      <button
                        type="button"
                        className="text-xs text-primary cursor-pointer"
                        onClick={() => run(async () => {
                          await apiClient.post(`/omnichannel/connections/${row.id}/canary-ping`, { reason });
                        }, 'ارسال آزمایشی ناموفق', 'پیام فارسی آزمایشی به canary ارسال شد')}
                      >
                        پیام فارسی
                      </button>
                      <button
                        type="button"
                        className="text-xs cursor-pointer"
                        onClick={() => run(async () => {
                          await apiClient.patch(`/omnichannel/connections/${row.id}`, {
                            status: row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                          });
                        }, 'تغییر وضعیت ناموفق')}
                      >
                        {row.status === 'ACTIVE' ? 'خاموش' : 'روشن'}
                      </button>
                    </td>
                  </tr>
                ))}
                {connections.length === 0 && (
                  <tr><td className="p-3 text-gray-400" colSpan={5}>اتصالی ثبت نشده — فقط نام env را ذخیره کنید، توکن را اینجا ننویسید.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <div>
              <h2 className="font-semibold">مقصدها</h2>
              <p className="text-xs text-gray-500 mt-1">
                chat id عددی بگذارید (بعد از Start ربات). بدون canary صف ارسال خالی می‌ماند.
                {status?.retailCanaryDestinationId ? ' canary تکی انتخاب شده.' : ' canary تکی خالی است.'}
                {status?.wholesaleCanaryDestinationId ? ' canary عمده انتخاب شده.' : ' canary عمده خالی است.'}
              </p>
            </div>
            <div className="grid md:grid-cols-4 gap-2">
              <label className="text-xs text-gray-500 space-y-1">
                <span>اتصال</span>
                <select className="border rounded-lg px-3 py-2 text-sm w-full" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
                  {connections.map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-gray-500 space-y-1">
                <span>شناسه (عدد)</span>
                <input className="border rounded-lg px-3 py-2 text-sm w-full font-mono" placeholder="1008770451" value={destKey} onChange={(e) => setDestKey(e.target.value)} />
              </label>
              <label className="text-xs text-gray-500 space-y-1">
                <span>نام نمایشی</span>
                <input className="border rounded-lg px-3 py-2 text-sm w-full" placeholder="خودم" value={destName} onChange={(e) => setDestName(e.target.value)} />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!connectionId || !destKey.trim() || !destName.trim()}
                  onClick={() => run(async () => {
                    await apiClient.post('/omnichannel/destinations', {
                      connectionId,
                      destinationKey: destKey,
                      displayName: destName,
                    });
                    setDestKey('');
                    setDestName('');
                  }, 'خطا در مقصد', 'مقصد اضافه شد')}
                >
                  افزودن مقصد
                </button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="p-2 text-right font-medium">مقصد</th>
                  <th className="p-2 text-right font-medium">شناسه</th>
                  <th className="p-2 text-right font-medium">وضعیت</th>
                  <th className="p-2 text-right font-medium">canary</th>
                  <th className="p-2 text-left font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {destinations.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{row.displayName}</td>
                    <td className="p-2 font-mono text-xs">{row.destinationKey}</td>
                    <td className="p-2">{row.enabled ? 'فعال' : 'خاموش'}</td>
                    <td className="p-2">{row.isCanary ? <Badge tone="ok">canary</Badge> : '—'}</td>
                    <td className="p-2 text-left">
                      <button
                        type="button"
                        className="text-xs text-primary cursor-pointer"
                        onClick={() => run(async () => {
                          await apiClient.patch(`/omnichannel/destinations/${row.id}`, {
                            isCanary: !row.isCanary,
                          });
                        }, 'تغییر canary ناموفق')}
                      >
                        {row.isCanary ? 'برداشتن canary' : 'انتخاب canary'}
                      </button>
                    </td>
                  </tr>
                ))}
                {destinations.length === 0 && <tr><td className="p-3 text-gray-400" colSpan={5}>مقصدی ثبت نشده</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}

      {tab === 'policy' && (
        <>
          <section className="rounded-xl border bg-white p-4 space-y-4">
            <div>
              <h2 className="font-semibold">سیاست کالای ناموجود</h2>
              <p className="text-xs text-gray-500 mt-1">
                تا ذخیره نشود فقط نمایش پیش‌فرض «به‌روزرسانی» است و ارسالی انجام نمی‌شود.
                مخفی‌کردن در تلگرام یعنی ویرایش متن به ناموجود، نه حذف.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {([
                ['RETAIL', 'تکی', retailOos, setRetailOos, status?.retailOosChosen] as const,
                ['WHOLESALE', 'عمده', wholesaleOos, setWholesaleOos, status?.wholesaleOosChosen] as const,
              ]).map(([key, label, value, setValue, chosen]) => (
                <fieldset key={key} className="space-y-2">
                  <legend className="text-sm font-medium">{label} {chosen ? '(ذخیره شده)' : '(هنوز انتخاب نشده)'}</legend>
                  {([
                    ['UPDATE', 'به‌روزرسانی پست'],
                    ['HIDE', 'مخفی‌کردن (متن ناموجود)'],
                    ['DELETE', 'حذف پست'],
                  ] as const).map(([policy, title]) => (
                    <label key={policy} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`oos-${key}`}
                        checked={value === policy}
                        onChange={() => setValue(policy)}
                      />
                      {title}
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => run(async () => {
                await apiClient.patch('/omnichannel/settings', {
                  retailOosPolicy: retailOos,
                  wholesaleOosPolicy: wholesaleOos,
                  reason,
                });
              }, 'خطا در ذخیره سیاست', 'سیاست ناموجود ذخیره شد')}
            >
              ذخیره سیاست ناموجود
            </button>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <div>
              <h2 className="font-semibold">باقی‌مانده تصمیم‌های انتشار</h2>
              <p className="text-xs text-gray-500 mt-1">
                تا ذخیره نشود فقط نمایش است و ورکر همان رفتار فعلی را نگه می‌دارد.
                انتشار خودکار زنده و حذف ردیف صف با این ذخیره روشن نمی‌شود.
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                رویدادهایی که بعداً می‌توانند auto-publish شوند
                {status?.autoPublishEventTypesChosen ? ' (ذخیره شده)' : ' (هنوز انتخاب نشده)'}
              </legend>
              {[
                ['product.created', 'ایجاد کالا'],
                ['product.content_changed', 'تغییر محتوا'],
                ['product.price_changed', 'تغییر قیمت'],
                ['product.visibility_changed', 'تغییر نمایش'],
                ['product.media_changed', 'تغییر رسانه'],
                ['product.withdrawn', 'خروج از انتشار'],
                ['blog.published', 'انتشار بلاگ'],
                ['cms.published', 'انتشار CMS'],
              ].map(([event, label]) => (
                <label key={event} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoPublishEventTypes.includes(event)}
                    onChange={() => setAutoPublishEventTypes((current) => (
                      current.includes(event)
                        ? current.filter((item) => item !== event)
                        : [...current, event]
                    ))}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-sm space-y-1">
                <span>
                  مهلت تلاش مجدد (ثانیه)
                  {status?.retrySlaChosen ? ' (ذخیره شده)' : ' (نمایش ۳۶۰۰ تا ذخیره)'}
                </span>
                <input
                  type="number"
                  min={60}
                  max={86400}
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                  value={retrySlaSeconds}
                  onChange={(e) => setRetrySlaSeconds(Number(e.target.value))}
                />
              </label>
              <label className="text-sm space-y-1">
                <span>
                  نگهداری صف انجام‌شده (روز)
                  {status?.outboxRetentionChosen ? ' (نمایش ذخیره شده)' : ' (نمایش ۹۰ تا ذخیره)'}
                </span>
                <input
                  type="number"
                  min={7}
                  max={365}
                  className="border rounded-lg px-3 py-2 text-sm w-full"
                  value={outboxRetentionDays}
                  onChange={(e) => setOutboxRetentionDays(Number(e.target.value))}
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => run(async () => {
                await apiClient.patch('/omnichannel/settings', {
                  autoPublishEventTypes,
                  retrySlaSeconds,
                  outboxRetentionDays,
                  reason,
                });
              }, 'خطا در ذخیره تصمیم‌های انتشار', 'تصمیم‌های انتشار ذخیره شد')}
            >
              ذخیره تصمیم‌های انتشار
            </button>
          </section>
        </>
      )}

      {tab === 'publish' && (
        <>
          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold">قالب‌ها</h2>
            <div className="flex flex-wrap gap-2">
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="eventType" value={tplEvent} onChange={(e) => setTplEvent(e.target.value)} />
              <textarea className="border rounded-lg px-3 py-2 text-sm w-full md:w-96" rows={3} value={tplBody} onChange={(e) => setTplBody(e.target.value)} />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!tplEvent.trim() || !tplBody.trim()}
                onClick={() => run(async () => {
                  await apiClient.post('/omnichannel/templates', {
                    provider: 'TELEGRAM',
                    channel,
                    eventType: tplEvent,
                    body: tplBody,
                  });
                }, 'خطا در قالب', 'قالب ذخیره شد')}
              >
                افزودن قالب تلگرام
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="p-2 text-right font-medium">ارائه‌دهنده / کانال</th>
                  <th className="p-2 text-right font-medium">رویداد</th>
                  <th className="p-2 text-right font-medium">نسخه</th>
                  <th className="p-2 text-right font-medium">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {templates.filter(matchFilter).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{row.provider} / {channelLabel(row.channel)}</td>
                    <td className="p-2 font-mono text-xs">{row.eventType}</td>
                    <td className="p-2">v{row.version}</td>
                    <td className="p-2">{row.enabled === false ? 'خاموش' : 'فعال'}</td>
                  </tr>
                ))}
                {templates.length === 0 && <tr><td className="p-3 text-gray-400" colSpan={4}>قالبی ثبت نشده</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <div>
              <h2 className="font-semibold">پیش‌نمایش</h2>
              <p className="text-xs text-gray-500 mt-1">
                ثبت پیش‌نویس همیشه dry-run است و به تلگرام نمی‌رود. محصول زنده سقف canary دارد و از این دکمه ارسال نمی‌شود.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className="border rounded-lg px-3 py-2 text-sm" value={sourceType} onChange={(e) => setSourceType(e.target.value as typeof sourceType)}>
                <option value="PRODUCT">محصول</option>
                <option value="BLOG_POST">بلاگ</option>
                <option value="CMS_PAGE">CMS</option>
              </select>
              <input className="border rounded-lg px-3 py-2 text-sm w-72" placeholder="شناسه منبع" value={sourceId} onChange={(e) => setSourceId(e.target.value)} />
              <input className="border rounded-lg px-3 py-2 text-sm w-56" placeholder="دلیل" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(async () => {
                const res = await apiClient.post<{ projection: Record<string, unknown> }>('/omnichannel/preview', {
                  channel, sourceType, sourceId,
                });
                setPreview(res.projection);
              }, 'خطا در پیش‌نمایش')}>پیش‌نمایش</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => run(async () => {
                await apiClient.post('/omnichannel/publications', {
                  preview: { channel, sourceType, sourceId },
                  dryRun: true,
                  reason,
                });
              }, 'خطا در پیش‌نویس', 'پیش‌نویس ثبت شد')}>ثبت پیش‌نویس</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(async () => {
                await apiClient.post('/omnichannel/reconcile', { reason });
              }, 'خطا در تطبیق', 'تطبیق انجام شد')}>تطبیق</button>
            </div>
            {preview && <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-64">{JSON.stringify(preview, null, 2)}</pre>}
          </section>

          <section className="rounded-xl border bg-white overflow-hidden">
            <h2 className="font-semibold p-4">انتشارها</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="p-3 text-right font-medium">منبع</th>
                  <th className="p-3 text-right font-medium">کانال</th>
                  <th className="p-3 text-right font-medium">وضعیت</th>
                  <th className="p-3 text-left font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {publications.filter(matchFilter).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{row.sourceId}</td>
                    <td className="p-3">{channelLabel(row.channel)}</td>
                    <td className="p-3">{row.status}</td>
                    <td className="p-3 text-left">
                      {row.status !== 'WITHDRAWN' && (
                        <button type="button" className="text-red-600 text-xs cursor-pointer" onClick={() => run(async () => {
                          await apiClient.post(`/omnichannel/publications/${row.id}/withdraw`, { reason });
                        }, 'خطا در برداشت')}>برداشت</button>
                      )}
                    </td>
                  </tr>
                ))}
                {publications.length === 0 && <tr><td className="p-4 text-gray-400" colSpan={4}>هنوز انتشاری ثبت نشده</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}

      {tab === 'ops' && (
        <>
          <section className="rounded-xl border bg-white overflow-hidden">
            <h2 className="font-semibold p-4">تاریخچه تحویل</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="p-3 text-right font-medium">شناسه</th>
                  <th className="p-3 text-right font-medium">عمل</th>
                  <th className="p-3 text-right font-medium">وضعیت</th>
                  <th className="p-3 text-right font-medium">خطا</th>
                  <th className="p-3 text-left font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.filter(matchFilter).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{row.id}</td>
                    <td className="p-3">{row.action}</td>
                    <td className="p-3">{row.status}</td>
                    <td className="p-3 text-xs text-gray-500">{row.lastError || '—'}</td>
                    <td className="p-3 text-left">
                      {row.status !== 'SUCCEEDED' && (
                        <button type="button" className="text-xs text-primary cursor-pointer" onClick={() => run(async () => {
                          await apiClient.post(`/omnichannel/deliveries/${row.id}/retry`, { reason });
                        }, 'خطا در retry')}>تلاش دوباره</button>
                      )}
                    </td>
                  </tr>
                ))}
                {deliveries.length === 0 && <tr><td className="p-4 text-gray-400" colSpan={5}>تحویلی ثبت نشده</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border bg-white overflow-hidden">
            <h2 className="font-semibold p-4">صف outbox</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="p-3 text-right font-medium">رویداد</th>
                  <th className="p-3 text-right font-medium">کانال</th>
                  <th className="p-3 text-right font-medium">وضعیت</th>
                  <th className="p-3 text-right font-medium">تلاش</th>
                  <th className="p-3 text-right font-medium">خطا</th>
                </tr>
              </thead>
              <tbody>
                {outbox.filter(matchFilter).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{row.eventType}</td>
                    <td className="p-3">{row.channel ? channelLabel(row.channel) : '—'}</td>
                    <td className="p-3">{row.status}</td>
                    <td className="p-3">{row.attempts}</td>
                    <td className="p-3 text-xs text-gray-500">{row.lastError || '—'}</td>
                  </tr>
                ))}
                {outbox.length === 0 && <tr><td className="p-4 text-gray-400" colSpan={5}>رویدادی در صف نیست</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border bg-white overflow-hidden">
            <h2 className="font-semibold p-4">رسانه (alt)</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="p-3 text-right font-medium">آدرس</th>
                  <th className="p-3 text-right font-medium">مالک</th>
                  <th className="p-3 text-right font-medium">متن جایگزین</th>
                </tr>
              </thead>
              <tbody>
                {media.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-mono text-xs break-all">{row.publicUrl}</td>
                    <td className="p-3">{row.ownerType}</td>
                    <td className="p-3">
                      <input
                        className="border rounded-lg px-2 py-1 text-sm w-full"
                        defaultValue={row.altText}
                        onBlur={(e) => {
                          const altText = e.target.value.trim();
                          if (altText === row.altText) return;
                          void run(async () => {
                            await apiClient.patch(`/omnichannel/media/${row.id}`, { altText });
                          }, 'خطا در alt');
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {media.length === 0 && <tr><td className="p-4 text-gray-400" colSpan={3}>رجیستری خالی است یا جدول هنوز migrate نشده</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border bg-white overflow-hidden">
            <h2 className="font-semibold p-4">حسابرسی</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="p-3 text-right font-medium">عمل</th>
                  <th className="p-3 text-right font-medium">عامل</th>
                  <th className="p-3 text-right font-medium">کانال</th>
                  <th className="p-3 text-right font-medium">دلیل</th>
                </tr>
              </thead>
              <tbody>
                {audits.filter(matchFilter).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3">{row.action}</td>
                    <td className="p-3 font-mono text-xs">{row.actorId}</td>
                    <td className="p-3">{row.channel ? channelLabel(row.channel) : '—'}</td>
                    <td className="p-3 text-xs text-gray-500">{row.reason || '—'}</td>
                  </tr>
                ))}
                {audits.length === 0 && <tr><td className="p-4 text-gray-400" colSpan={4}>رکورد حسابرسی نیست</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
