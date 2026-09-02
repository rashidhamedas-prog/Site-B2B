'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';

type OosPolicy = 'UPDATE' | 'HIDE' | 'DELETE';

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
  const [autoPublishEvents, setAutoPublishEvents] = useState<string[]>([
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
      if (st.autoPublishEventTypes?.length) setAutoPublishEvents(st.autoPublishEventTypes);
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
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setError('');
    try {
      await fn();
      await load();
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">کانال‌های انتشار</h1>
        <p className="text-sm text-gray-500 mt-1">
          فقط secretRef (نام env روی سرور، مثلاً TELEGRAM_BOT_TOKEN). مقدار توکن را اینجا ننویسید.
          تا مقصد canary انتخاب نشود چیزی به تلگرام نمی‌رود. پرچم سرور خاموش می‌ماند.
        </p>
      </div>

      {status && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-xl border bg-white p-4 text-sm">فاز {status.phase}</div>
          <div className="rounded-xl border bg-white p-4 text-sm">canary تکی {status.retailCanaryLimit}</div>
          <div className="rounded-xl border bg-white p-4 text-sm">canary عمده {status.wholesaleCanaryLimit}</div>
          <div className="rounded-xl border bg-white p-4 text-sm">
            کانکتور {status.connectors ? 'روشن' : 'خاموش'} / auto-publish {status.autoPublish ? 'روشن' : 'خاموش'}
          </div>
          <div className="rounded-xl border bg-white p-4 text-sm">
            صف {status.outbox?.pending ?? pendingOutbox} / DEAD {status.outbox?.dead ?? deadOutbox}
            {status.outbox ? ` / تأخیر ${status.outbox.oldestPendingAgeSec}ث` : ''}
          </div>
        </div>
      )}

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
          }, 'خطا در ذخیره سیاست')}
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
                checked={autoPublishEvents.includes(event)}
                onChange={() => setAutoPublishEvents((current) => (
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
              {status?.outboxRetentionChosen ? ' (ذخیره شده)' : ' (نمایش ۹۰ تا ذخیره)'}
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
              autoPublishEventTypes: autoPublishEvents,
              retrySlaSeconds,
              outboxRetentionDays,
              reason,
            });
          }, 'خطا در ذخیره تصمیم‌های انتشار')}
        >
          ذخیره تصمیم‌های انتشار
        </button>
      </section>

      <div className="flex flex-wrap gap-2">
        {['ALL', 'RETAIL', 'WHOLESALE', 'PENDING', 'DEAD', 'DRAFT', 'TELEGRAM'].map((key) => (
          <button
            key={key}
            type="button"
            className={`px-3 py-1 rounded-full text-xs border ${filter === key ? 'bg-gray-900 text-white' : 'bg-white'}`}
            onClick={() => setFilter(key)}
          >
            {key}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">اتصال‌ها</h2>
        <p className="text-xs text-gray-500">
          secretRef فقط نام متغیر روی VPS است. ربات را برای ارسال زنده بعداً بسازید؛ ذخیره نام env توکن نمی‌خواهد.
        </p>
        <div className="flex flex-wrap gap-2">
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="نام" value={connName} onChange={(e) => setConnName(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 text-sm font-mono" placeholder="TELEGRAM_BOT_TOKEN" value={secretRef} onChange={(e) => setSecretRef(e.target.value.toUpperCase())} />
          <select className="border rounded-lg px-3 py-2 text-sm" value={channel} onChange={(e) => setChannel(e.target.value as 'RETAIL' | 'WHOLESALE')}>
            <option value="RETAIL">تکی</option>
            <option value="WHOLESALE">عمده</option>
          </select>
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
            }, 'خطا در ثبت اتصال')}
          >
            افزودن تلگرام
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {connections.filter(matchFilter).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.provider} / {row.channel}</td>
                <td className="p-2 font-mono text-xs">{row.secretRef}</td>
                <td className="p-2">{row.status}</td>
                <td className="p-2 text-left space-x-3 space-x-reverse">
                  <button
                    type="button"
                    className="text-xs text-primary"
                    onClick={() => run(async () => { await apiClient.post(`/omnichannel/connections/${row.id}/test`, {}); }, 'تست اتصال ناموفق')}
                  >
                    تست
                  </button>
                  <button
                    type="button"
                    className="text-xs"
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
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">مقصدها</h2>
        <p className="text-xs text-gray-500">
          chat id کانال آزمایشی را بگذارید و همان را canary کنید. بدون canary صف ارسال خالی می‌ماند.
          {status?.retailCanaryDestinationId ? ' canary تکی انتخاب شده.' : ' canary تکی خالی است.'}
          {status?.wholesaleCanaryDestinationId ? ' canary عمده انتخاب شده.' : ' canary عمده خالی است.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <select className="border rounded-lg px-3 py-2 text-sm" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
            {connections.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="chat id" value={destKey} onChange={(e) => setDestKey(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="نام نمایشی" value={destName} onChange={(e) => setDestName(e.target.value)} />
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
            }, 'خطا در مقصد')}
          >
            افزودن مقصد
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {destinations.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">{row.displayName}</td>
                <td className="p-2 font-mono text-xs">{row.destinationKey}</td>
                <td className="p-2">{row.enabled ? 'فعال' : 'خاموش'}</td>
                <td className="p-2">{row.isCanary ? 'canary' : '—'}</td>
                <td className="p-2 text-left">
                  <button
                    type="button"
                    className="text-xs text-primary"
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
            {destinations.length === 0 && <tr><td className="p-3 text-gray-400">مقصدی ثبت نشده</td></tr>}
          </tbody>
        </table>
      </section>

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
            }, 'خطا در قالب')}
          >
            افزودن قالب تلگرام
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {templates.filter(matchFilter).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">{row.provider} / {row.channel}</td>
                <td className="p-2 font-mono text-xs">{row.eventType}</td>
                <td className="p-2">v{row.version}</td>
                <td className="p-2">{row.enabled === false ? 'خاموش' : 'فعال'}</td>
              </tr>
            ))}
            {templates.length === 0 && <tr><td className="p-3 text-gray-400">قالبی ثبت نشده</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">پیش‌نمایش</h2>
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
          }, 'خطا در پیش‌نویس')}>ثبت پیش‌نویس</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(async () => {
            await apiClient.post('/omnichannel/reconcile', { reason });
          }, 'خطا در تطبیق')}>تطبیق</button>
        </div>
        {preview && <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-64">{JSON.stringify(preview, null, 2)}</pre>}
      </section>

      <section className="rounded-xl border bg-white overflow-hidden">
        <h2 className="font-semibold p-4">انتشارها</h2>
        <table className="w-full text-sm">
          <tbody>
            {publications.filter(matchFilter).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3 font-mono text-xs">{row.sourceId}</td>
                <td className="p-3">{row.channel}</td>
                <td className="p-3">{row.status}</td>
                <td className="p-3 text-left">
                  {row.status !== 'WITHDRAWN' && (
                    <button type="button" className="text-red-600 text-xs" onClick={() => run(async () => {
                      await apiClient.post(`/omnichannel/publications/${row.id}/withdraw`, { reason });
                    }, 'خطا در برداشت')}>برداشت</button>
                  )}
                </td>
              </tr>
            ))}
            {publications.length === 0 && <tr><td className="p-4 text-gray-400">هنوز انتشاری ثبت نشده</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-white overflow-hidden">
        <h2 className="font-semibold p-4">تاریخچه تحویل</h2>
        <table className="w-full text-sm">
          <tbody>
            {deliveries.filter(matchFilter).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3 font-mono text-xs">{row.id}</td>
                <td className="p-3">{row.action}</td>
                <td className="p-3">{row.status}</td>
                <td className="p-3 text-xs text-gray-500">{row.lastError || '—'}</td>
                <td className="p-3 text-left">
                  {row.status !== 'SUCCEEDED' && (
                    <button type="button" className="text-xs text-primary" onClick={() => run(async () => {
                      await apiClient.post(`/omnichannel/deliveries/${row.id}/retry`, { reason });
                    }, 'خطا در retry')}>تلاش دوباره</button>
                  )}
                </td>
              </tr>
            ))}
            {deliveries.length === 0 && <tr><td className="p-4 text-gray-400">تحویلی ثبت نشده</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-white overflow-hidden">
        <h2 className="font-semibold p-4">صف outbox</h2>
        <table className="w-full text-sm">
          <tbody>
            {outbox.filter(matchFilter).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3 font-mono text-xs">{row.eventType}</td>
                <td className="p-3">{row.channel || '—'}</td>
                <td className="p-3">{row.status}</td>
                <td className="p-3">{row.attempts}</td>
                <td className="p-3 text-xs text-gray-500">{row.lastError || '—'}</td>
              </tr>
            ))}
            {outbox.length === 0 && <tr><td className="p-4 text-gray-400">رویدادی در صف نیست</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-white overflow-hidden">
        <h2 className="font-semibold p-4">رسانه (alt)</h2>
        <table className="w-full text-sm">
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
            {media.length === 0 && <tr><td className="p-4 text-gray-400">رجیستری خالی است یا جدول هنوز migrate نشده</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-white overflow-hidden">
        <h2 className="font-semibold p-4">حسابرسی</h2>
        <table className="w-full text-sm">
          <tbody>
            {audits.filter(matchFilter).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3">{row.action}</td>
                <td className="p-3 font-mono text-xs">{row.actorId}</td>
                <td className="p-3">{row.channel || '—'}</td>
                <td className="p-3 text-xs text-gray-500">{row.reason || '—'}</td>
              </tr>
            ))}
            {audits.length === 0 && <tr><td className="p-4 text-gray-400">رکورد حسابرسی نیست</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
