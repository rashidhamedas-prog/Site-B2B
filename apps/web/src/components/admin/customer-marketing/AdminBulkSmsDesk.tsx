'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, RefreshCw, Send, ShieldCheck, Smartphone } from 'lucide-react';
import { Callout, Metric, Section } from '../admin-omnichannel-ui';
import { Modal } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useCustomers, type Customer } from '@/lib/hooks/useCustomers';
import type { MarketingChannel } from '@/lib/hooks/useCustomerMarketing';

type TemplateRow = {
  id: string;
  code: string;
  title: string;
  body: string;
  messageClass?: string;
};

type PreviewRow = {
  customerId: string;
  name: string;
  phoneMasked: string | null;
  preview: string;
  segments: number;
  chars: number;
};

type SkipRow = { customerId: string; name: string; reason: string };

type BulkPreview = {
  channel: MarketingChannel;
  messageClass: string;
  selected: number;
  eligibleCount: number;
  skippedCount: number;
  eligible: PreviewRow[];
  skipped: SkipRow[];
  samplePreviews: PreviewRow[];
  caps: {
    maxBatch: number;
    dailyCapPerChannel: number;
    moduleEnabled: boolean;
    mode: string;
  };
  variables: string[];
};

type CampaignRow = {
  id: string;
  title: string;
  channel: string;
  mode: string;
  messageClass: string;
  canarySucceeded: boolean;
  audienceCount?: number;
  createdAt: string;
};

const SKIP_FA: Record<string, string> = {
  NOT_FOUND: 'یافت نشد',
  CHANNEL_MISMATCH: 'کانال اشتباه',
  NO_PHONE: 'بدون شماره',
  REVOKED: 'رضایت لغو',
  SUPPRESSED: 'مسدود',
  PROMO_NEEDS_GRANT: 'نیاز به رضایت تبلیغاتی',
  NO_CONSENT: 'بدون رضایت',
  EMPTY_BODY: 'متن خالی',
};

const CLASS_FA: Record<string, string> = {
  NURTURE: 'پرورشی',
  PROMO: 'تبلیغاتی',
};

function fillLocal(template: string, vars: Record<string, string>) {
  return String(template || '')
    .replace(/\{(\w+)\}/g, (_, key: string) => (vars[key] != null && vars[key] !== '' ? String(vars[key]) : ''))
    .trim();
}

export function AdminBulkSmsDesk({
  channel,
  templates,
  settings,
  onNotice,
}: {
  channel: MarketingChannel;
  templates: Array<Record<string, unknown>>;
  settings: Record<string, unknown> | null;
  onNotice: (msg: string) => void;
}) {
  const [searchQ, setSearchQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, Customer>>({});
  const [templateId, setTemplateId] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [messageClass, setMessageClass] = useState<'NURTURE' | 'PROMO'>('NURTURE');
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmLive, setConfirmLive] = useState<CampaignRow | null>(null);
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);

  const { customers, meta, loading, refetch } = useCustomers({
    page,
    search: searchQ || undefined,
    channel,
  });

  const channelTemplates = useMemo(
    () => (templates as TemplateRow[]).filter((t) => t && typeof t.id === 'string'),
    [templates],
  );

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const selectedIds = useMemo(() => selectedList.map((c) => c.id), [selectedList]);

  const activeTpl = channelTemplates.find((t) => t.id === templateId);
  const sourceBody = customBody.trim() || activeTpl?.body || '';

  const livePreviewCustomer = useMemo(() => {
    if (activePreviewId && selected[activePreviewId]) return selected[activePreviewId];
    if (preview?.samplePreviews?.[0]) {
      const id = preview.samplePreviews[0].customerId;
      return selected[id] || null;
    }
    return selectedList[0] || null;
  }, [activePreviewId, selected, preview, selectedList]);

  const phonePreviewText = useMemo(() => {
    if (preview?.samplePreviews?.length) {
      const hit = activePreviewId
        ? preview.eligible.find((e) => e.customerId === activePreviewId) || preview.samplePreviews[0]
        : preview.samplePreviews[0];
      return hit?.preview || '';
    }
    if (!sourceBody || !livePreviewCustomer) {
      return 'متن شخصی‌سازی‌شده اینجا دیده می‌شود…';
    }
    return fillLocal(sourceBody, {
      name: livePreviewCustomer.ownerName || livePreviewCustomer.businessName || '',
      city: livePreviewCustomer.city || '',
      orderNumber: '',
      productName: '',
    }) || 'متن شخصی‌سازی‌شده اینجا دیده می‌شود…';
  }, [preview, activePreviewId, sourceBody, livePreviewCustomer]);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: CampaignRow[] }>(`/marketing/campaigns?channel=${channel}`);
      setCampaigns(res.data || []);
    } catch {
      setCampaigns([]);
    }
  }, [channel]);

  useEffect(() => {
    setSelected({});
    setPreview(null);
    setTemplateId('');
    setCustomBody('');
    setTitle('');
    setPage(1);
    void loadCampaigns();
  }, [channel, loadCampaigns]);

  useEffect(() => {
    if (activeTpl?.messageClass === 'PROMO' || activeTpl?.messageClass === 'NURTURE') {
      setMessageClass(activeTpl.messageClass);
    }
  }, [activeTpl?.id, activeTpl?.messageClass]);

  const toggle = (c: Customer) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[c.id]) delete next[c.id];
      else if (Object.keys(next).length < 100) next[c.id] = c;
      return next;
    });
    setPreview(null);
  };

  const togglePage = () => {
    const pageIds = customers.map((c) => c.id);
    const allOn = pageIds.length > 0 && pageIds.every((id) => selected[id]);
    setSelected((prev) => {
      const next = { ...prev };
      if (allOn) {
        for (const id of pageIds) delete next[id];
      } else {
        for (const c of customers) {
          if (Object.keys(next).length >= 100) break;
          next[c.id] = c;
        }
      }
      return next;
    });
    setPreview(null);
  };

  const runPreview = async () => {
    if (!selectedIds.length) {
      onNotice('حداقل یک مشتری انتخاب کنید.');
      return;
    }
    if (!sourceBody) {
      onNotice('قالب یا متن اختصاصی لازم است.');
      return;
    }
    setBusy('preview');
    try {
      const res = await apiClient.post<BulkPreview>('/marketing/bulk/preview', {
        channel,
        customerIds: selectedIds,
        templateId: templateId || undefined,
        body: customBody.trim() || undefined,
        messageClass,
      });
      setPreview(res);
      setActivePreviewId(res.samplePreviews[0]?.customerId || null);
      onNotice(
        `پیش‌نمایش: ${res.eligibleCount.toLocaleString('fa-IR')} واجد · ${res.skippedCount.toLocaleString('fa-IR')} رد شده`,
      );
    } catch (e: unknown) {
      onNotice(e instanceof Error ? e.message : 'پیش‌نمایش نشد');
    } finally {
      setBusy(null);
    }
  };

  const composeAndCanary = async () => {
    if (!preview || !preview.eligibleCount) {
      onNotice('ابتدا پیش‌نمایش بگیرید و مخاطب واجد داشته باشید.');
      return;
    }
    setBusy('compose');
    try {
      const composed = await apiClient.post<{
        campaign: CampaignRow;
        preview: BulkPreview;
      }>('/marketing/bulk/compose', {
        channel,
        title: title.trim() || `ارسال گروهی ${channel === 'RETAIL' ? 'تکی' : 'عمده'}`,
        customerIds: preview.eligible.map((e) => e.customerId),
        templateId: templateId || undefined,
        bodyOverride: customBody.trim() || undefined,
        messageClass,
      });
      const canary = await apiClient.post<{
        campaign: CampaignRow;
        previewBody?: string;
      }>(`/marketing/campaigns/${composed.campaign.id}/canary`, {});
      onNotice(
        canary.campaign.canarySucceeded
          ? 'کمپین ساخته شد و پیام آزمایشی به شماره کاناری رفت. پس از تأیید، ارسال زنده را بزنید.'
          : 'کمپین ساخته شد ولی کاناری موفق نبود — تنظیمات/حالت ارسال را چک کنید.',
      );
      setConfirmLive(canary.campaign.canarySucceeded ? canary.campaign : null);
      await loadCampaigns();
    } catch (e: unknown) {
      onNotice(e instanceof Error ? e.message : 'ساخت کمپین نشد');
    } finally {
      setBusy(null);
    }
  };

  const goLive = async () => {
    if (!confirmLive) return;
    setBusy('live');
    try {
      const res = await apiClient.post<{ audienceCount?: number; audienceMode?: string }>(
        `/marketing/campaigns/${confirmLive.id}/go-live`,
        {},
      );
      onNotice(
        `ارسال زنده در صف رفت برای ${Number(res.audienceCount || preview?.eligibleCount || 0).toLocaleString('fa-IR')} مخاطب انتخابی.`,
      );
      setConfirmLive(null);
      setSelected({});
      setPreview(null);
      await loadCampaigns();
    } catch (e: unknown) {
      onNotice(e instanceof Error ? e.message : 'ارسال زنده نشد');
    } finally {
      setBusy(null);
    }
  };

  const mode = String(settings?.mode || 'OFF');
  const enabled = settings?.enabled === true;
  const pageAllSelected =
    customers.length > 0 && customers.every((c) => selected[c.id]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="انتخاب‌شده" value={selectedIds.length.toLocaleString('fa-IR')} />
        <Metric
          label="واجد (پیش‌نمایش)"
          value={preview ? preview.eligibleCount.toLocaleString('fa-IR') : '—'}
        />
        <Metric
          label="رد شده"
          value={preview ? preview.skippedCount.toLocaleString('fa-IR') : '—'}
        />
        <Metric
          label="سقف روزانه کانال"
          value={Number(settings?.dailyCapPerChannel ?? 20).toLocaleString('fa-IR')}
        />
      </div>

      {!enabled && (
        <Callout tone="warn">
          ماژول بازاریابی خاموش است. می‌توانید مخاطب و پیش‌نمایش بسازید؛ ارسال زنده تا فعال‌سازی ممکن نیست.
        </Callout>
      )}
      {enabled && mode !== 'LIVE' && (
        <Callout tone="info">
          حالت ارسال: <strong>{mode}</strong> — برای ارسال واقعی به مشتریان باید حالت سراسری LIVE باشد؛ کاناری جداگانه به شماره آزمایشی می‌رود.
        </Callout>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Section
          title="انتخاب مخاطب"
          description={`فقط مشتریان ${channel === 'RETAIL' ? 'تکی' : 'عمده'} — حداکثر ۱۰۰ نفر در هر ارسال.`}
          actions={
            <button type="button" onClick={() => void refetch()} className="btn btn-ghost btn-sm min-h-11">
              <RefreshCw className="h-4 w-4" />بروزرسانی
            </button>
          }
        >
          <form
            className="mb-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              void refetch();
            }}
          >
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="جستجو نام، موبایل، کد…"
              className="min-h-11 min-w-[12rem] flex-1 rounded-xl border border-gray-200 px-3 text-sm"
            />
            <button type="submit" className="btn btn-primary btn-sm min-h-11">
              جستجو
            </button>
            {selectedIds.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm min-h-11"
                onClick={() => {
                  setSelected({});
                  setPreview(null);
                }}
              >
                پاک کردن انتخاب
              </button>
            )}
          </form>

          {loading ? (
            <p className="text-sm text-gray-500">در حال بارگذاری…</p>
          ) : customers.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">مشتری‌ای در این کانال پیدا نشد.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="w-11 px-3 py-2 text-right">
                      <input
                        type="checkbox"
                        checked={pageAllSelected}
                        onChange={togglePage}
                        aria-label="انتخاب صفحه"
                      />
                    </th>
                    <th className="px-3 py-2 text-right font-medium">مشتری</th>
                    <th className="px-3 py-2 text-right font-medium">موبایل</th>
                    <th className="px-3 py-2 text-right font-medium">شهر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customers.map((c) => {
                    const checked = !!selected[c.id];
                    return (
                      <tr
                        key={c.id}
                        className={checked ? 'bg-amber-50/60' : 'hover:bg-gray-50/80'}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(c)}
                            aria-label={`انتخاب ${c.ownerName || c.businessName}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            className="text-right font-semibold text-gray-900 hover:underline"
                            onClick={() => {
                              setActivePreviewId(c.id);
                              if (!selected[c.id]) toggle(c);
                            }}
                          >
                            {c.ownerName || c.businessName || 'بدون نام'}
                          </button>
                          <p className="text-xs text-gray-500">{c.businessName && c.ownerName ? c.businessName : c.code}</p>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">
                          {c.phone || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{c.city || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {meta.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
              <span>
                صفحه {page.toLocaleString('fa-IR')} از {meta.totalPages.toLocaleString('fa-IR')}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  className="btn btn-ghost btn-sm min-h-11"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  قبلی
                </button>
                <button
                  type="button"
                  disabled={page >= meta.totalPages}
                  className="btn btn-ghost btn-sm min-h-11"
                  onClick={() => setPage((p) => p + 1)}
                >
                  بعدی
                </button>
              </div>
            </div>
          )}
        </Section>

        <div className="space-y-4">
          <Section
            title="پیام اختصاصی"
            description="متغیرها: {name} {city} — برای هر گیرنده جداگانه پر می‌شود."
          >
            <label className="mb-2 block text-xs font-medium text-gray-500">عنوان کمپین</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={channel === 'RETAIL' ? 'مثلاً پیگیری نوله تکی' : 'مثلاً دعوت خرید عمده'}
              className="mb-3 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
            />

            <label className="mb-2 block text-xs font-medium text-gray-500">قالب</label>
            <select
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setPreview(null);
              }}
              className="mb-3 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
            >
              <option value="">متن دستی / بدون قالب</option>
              {channelTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title || t.code} ({CLASS_FA[String(t.messageClass)] || t.messageClass || '—'})
                </option>
              ))}
            </select>

            <label className="mb-2 block text-xs font-medium text-gray-500">
              متن {customBody.trim() ? '(بازنویسی)' : activeTpl ? '(اختیاری — خالی = متن قالب)' : ''}
            </label>
            <textarea
              value={customBody}
              onChange={(e) => {
                setCustomBody(e.target.value);
                setPreview(null);
              }}
              rows={5}
              placeholder={activeTpl?.body || 'سلام {name} عزیز، …'}
              className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm leading-6"
            />

            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="کلاس پیام">
              {(['NURTURE', 'PROMO'] as const).map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => {
                    setMessageClass(cls);
                    setPreview(null);
                  }}
                  className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${
                    messageClass === cls
                      ? channel === 'RETAIL'
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#1B5C4A] text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {CLASS_FA[cls]}
                </button>
              ))}
            </div>

            <div
              className="relative mx-auto mb-4 w-[220px] rounded-[1.75rem] border-2 border-gray-800 bg-gray-900 p-2 shadow-lg"
              aria-label="پیش‌نمایش موبایل"
            >
              <div className="rounded-[1.35rem] bg-[#f2f2f7] px-3 pb-4 pt-6">
                <div className="mb-3 flex items-center justify-center gap-1 text-[10px] text-gray-500">
                  <Smartphone className="h-3 w-3" />
                  پیش‌نمایش پیامک
                </div>
                <div className="rounded-2xl rounded-tr-sm bg-white px-3 py-2 text-[13px] leading-6 text-gray-900 shadow-sm">
                  {phonePreviewText}
                </div>
                {livePreviewCustomer && (
                  <p className="mt-2 truncate text-center text-[10px] text-gray-500">
                    برای {livePreviewCustomer.ownerName || livePreviewCustomer.businessName}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!busy || !selectedIds.length}
                onClick={() => void runPreview()}
                className="btn btn-ghost btn-sm min-h-11"
              >
                <MessageSquare className="h-4 w-4" />
                {busy === 'preview' ? '…' : 'پیش‌نمایش واجدین'}
              </button>
              <button
                type="button"
                disabled={!!busy || !preview?.eligibleCount}
                onClick={() => void composeAndCanary()}
                className={`btn btn-primary btn-sm min-h-11 ${
                  channel === 'WHOLESALE' ? '!bg-[#1B5C4A]' : ''
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                {busy === 'compose' ? '…' : 'ساخت + آزمایش کاناری'}
              </button>
            </div>
          </Section>
        </div>
      </div>

      {preview && (
        <Section
          title="نتیجه واجدین"
          description="فقط افراد واجد در کمپین ذخیره می‌شوند؛ رضایت و مسدودسازی دور زده نمی‌شود."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <ul className="max-h-64 space-y-2 overflow-auto text-sm">
              {preview.eligible.slice(0, 40).map((row) => (
                <li key={row.customerId}>
                  <button
                    type="button"
                    onClick={() => setActivePreviewId(row.customerId)}
                    className={`w-full rounded-xl border px-3 py-2 text-right ${
                      activePreviewId === row.customerId
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <span className="font-semibold text-gray-900">{row.name}</span>
                    <span className="mr-2 font-mono text-xs text-gray-500" dir="ltr">
                      {row.phoneMasked}
                    </span>
                    <span className="mr-2 text-xs text-gray-400">
                      {row.segments.toLocaleString('fa-IR')} سگمنت
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {preview.skipped.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-xl border border-red-100 bg-red-50/40 p-3 text-sm">
                <p className="mb-2 font-semibold text-red-800">رد شده‌ها</p>
                <ul className="space-y-1.5">
                  {preview.skipped.slice(0, 40).map((row) => (
                    <li key={row.customerId} className="flex justify-between gap-2 text-red-900/90">
                      <span>{row.name}</span>
                      <span className="text-xs">{SKIP_FA[row.reason] || row.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section
        title="کمپین‌های اخیر این کانال"
        description="پس از کاناری موفق می‌توانید ارسال زنده را از اینجا هم ادامه دهید."
        actions={
          <button type="button" onClick={() => void loadCampaigns()} className="btn btn-ghost btn-sm min-h-11">
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      >
        {campaigns.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">هنوز کمپینی نیست.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-500">
                    {CLASS_FA[c.messageClass] || c.messageClass} · حالت {c.mode}
                    {c.audienceCount != null
                      ? ` · ${Number(c.audienceCount).toLocaleString('fa-IR')} مخاطب`
                      : ''}
                    {c.canarySucceeded ? ' · کاناری ✓' : ' · کاناری نشده'}
                  </p>
                </div>
                {c.canarySucceeded && c.mode !== 'LIVE' && Number(c.audienceCount || 0) > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm min-h-11"
                    disabled={!!busy}
                    onClick={() => setConfirmLive(c)}
                  >
                    <Send className="h-4 w-4" />ارسال زنده
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Modal
        open={!!confirmLive}
        onClose={() => !busy && setConfirmLive(null)}
        title="تأیید ارسال زنده پیامک"
      >
        <div className="space-y-4 p-1">
          <Callout tone="danger">
            پیامک شخصی‌سازی‌شده فقط به مخاطبان <strong>انتخاب‌شده و واجد</strong> این کمپین در کانال{' '}
            {channel === 'RETAIL' ? 'تکی' : 'عمده'} ارسال می‌شود. این عمل برگشت‌پذیر نیست.
          </Callout>
          <p className="text-sm text-gray-700">
            کمپین: <strong>{confirmLive?.title}</strong>
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost min-h-11"
              disabled={!!busy}
              onClick={() => setConfirmLive(null)}
            >
              انصراف
            </button>
            <button
              type="button"
              className="btn btn-primary min-h-11 !bg-red-700"
              disabled={!!busy || mode !== 'LIVE' || !enabled}
              onClick={() => void goLive()}
            >
              {busy === 'live' ? '…' : 'بله، ارسال زنده'}
            </button>
          </div>
          {(mode !== 'LIVE' || !enabled) && (
            <p className="text-xs text-amber-800">
              برای فعال شدن دکمه، در تب «متن و قوانین» ماژول را روشن و حالت را LIVE کنید.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
