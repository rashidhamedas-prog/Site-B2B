'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Phone, MessageSquare, RefreshCw } from 'lucide-react';
import { AdminChannelTabs, type AdminChannel } from '../AdminChannelTabs';
import { Callout, Metric, RadioCards, Section } from '../admin-omnichannel-ui';
import { Modal } from '@/components/ui';
import { apiClient } from '@/lib/api';
import {
  useMarketingBoard,
  useMarketingHub,
  useMarketingQueue,
  useZeroOrderDesk,
  type ZeroOrderRow,
} from '@/lib/hooks/useCustomerMarketing';
import {
  parseCustomerWorkspaceQuery,
  serializeCustomerWorkspaceQuery,
  type ZeroOrderBucket,
} from '@/lib/admin-customer-workspace';

const STAGE_LABEL: Record<string, string> = {
  REGISTERED: 'ثبت‌نام تکی',
  ACTIVE_BUYER: 'خریدار فعال',
  REPEAT: 'خرید مجدد',
  DORMANT: 'ساکت',
  APPLIED: 'درخواست عمده',
  NEEDS_DOCS: 'نیاز به مدرک',
  APPROVED: 'تأیید شده',
  FIRST_ORDER: 'اولین سفارش',
  ACTIVE: 'فعال عمده',
};

const BUCKET_LABEL: Record<string, string> = {
  fresh: 'تازه (۰–۲ روز)',
  warm: 'گرم (۳–۷)',
  aging: 'در حال سرد شدن (۸–۳۰)',
  cool: 'سرد (۳۱–۹۰)',
  recycle: 'بازیافت (۹۰+)',
};

const MODE_OPTIONS = [
  { value: 'OFF', title: 'خاموش', hint: 'هیچ پیامکی نمی‌رود' },
  { value: 'PREVIEW', title: 'پیش‌نمایش', hint: 'فقط متن آماده می‌شود' },
  { value: 'CANARY', title: 'آزمایشی', hint: 'فقط به شماره شما' },
  { value: 'LIVE', title: 'زنده', hint: 'فقط مدیر کل' },
];

export function AdminCustomerMarketing() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parsed = parseCustomerWorkspaceQuery(searchParams);
  const channel: AdminChannel = parsed.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
  const tab = parsed.marketingTab;
  const bucket = parsed.bucket;
  const [page, setPage] = useState(1);
  const [searchQ, setSearchQ] = useState(parsed.q);
  const setChannel = (next: AdminChannel) => {
    const qs = serializeCustomerWorkspaceQuery({ ...parsed, channel: next, bucket: next !== channel ? '' : parsed.bucket });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const setTab = (next: typeof tab) => {
    const qs = serializeCustomerWorkspaceQuery({ ...parsed, marketingTab: next, channel });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const setBucket = (next: ZeroOrderBucket | '') => {
    setPage(1);
    const qs = serializeCustomerWorkspaceQuery({ ...parsed, channel, marketingTab: 'zero', bucket: next || undefined });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [followRow, setFollowRow] = useState<ZeroOrderRow | null>(null);
  const [snoozeHours, setSnoozeHours] = useState('24');
  const [followNotes, setFollowNotes] = useState('');
  const board = useMarketingBoard(channel);
  const queue = useMarketingQueue(channel);
  const hub = useMarketingHub(channel);
  const zero = useZeroOrderDesk(channel, { bucket: bucket || undefined, q: searchQ, page });

  const mode = String(hub.settings?.mode || 'OFF');
  const enabled = hub.settings?.enabled === true;

  const saveSettings = async (patch: Record<string, unknown>) => {
    setBusy('settings');
    setNotice(null);
    try {
      await apiClient.patch('/marketing/settings', patch);
      await hub.reload();
      setNotice('تنظیمات ذخیره شد. ارسال زنده هنوز باید جداگانه و آگاهانه روشن شود.');
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'ذخیره نشد');
    } finally {
      setBusy(null);
    }
  };

  const patchScenario = async (code: string, nextMode: string) => {
    setBusy(code);
    try {
      await apiClient.patch(`/marketing/automations/${encodeURIComponent(code)}`, { mode: nextMode });
      await hub.reload();
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(null);
    }
  };

  const canary = async (code: string) => {
    setBusy(`canary:${code}`);
    try {
      await apiClient.post(`/marketing/automations/${encodeURIComponent(code)}/canary`, {});
      setNotice('پیام آزمایشی در صف رفت (اگر حالت ارسال خاموش نباشد، فقط به شماره کاناری).');
      await hub.reload();
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'آزمایش ارسال نشد');
    } finally {
      setBusy(null);
    }
  };

  const runBackfill = async () => {
    setBusy('backfill');
    setNotice(null);
    try {
      const res = await apiClient.post<{ scanned: number; enrolled: number; skipped: number }>(
        '/marketing/zero-order/backfill',
        { limit: 100 },
      );
      setNotice(`بازسازی قیف: ${res.enrolled} ثبت شد از ${res.scanned} (رد شده: ${res.skipped}).`);
      await zero.reload();
      await board.reload();
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'بازسازی انجام نشد');
    } finally {
      setBusy(null);
    }
  };

  const saveFollowUp = async () => {
    if (!followRow) return;
    setBusy('follow');
    try {
      await apiClient.patch(`/customers/${followRow.customerId}/marketing/follow-up`, {
        snoozeHours: Number(snoozeHours) || 24,
        nextActionType: 'CALL',
        notes: followNotes,
      });
      setFollowRow(null);
      setFollowNotes('');
      setNotice('پیگیری زمان‌بندی شد.');
      await zero.reload();
      await queue.reload();
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'زمان‌بندی نشد');
    } finally {
      setBusy(null);
    }
  };

  const scenarios = useMemo(
    () => (hub.automations?.scenarios || []).filter((s) => s.channel === channel),
    [hub.automations, channel],
  );

  const windows = (statsWindows(zero.stats) || []);
  const win30 = windows.find((w) => w.windowDays === 30);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">اتاق پیگیری مشتریان</h2>
          <p className="mt-1 text-sm text-gray-500">تماس و پیامک پرورشی جدا برای تکی و عمده. پیامک تبلیغاتی پیش‌فرض خاموش است.</p>
        </div>
        <AdminChannelTabs value={channel} onChange={setChannel} />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="لایه‌های بازاریابی">
        {([['today', 'امروز'], ['zero', 'نوله‌ها'], ['funnel', 'قیف'], ['rules', 'متن و قوانین']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-xl px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 ${
              tab === id
                ? channel === 'RETAIL' ? 'bg-amber-600 text-white' : 'bg-[#1B5C4A] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {notice && <Callout tone={mode === 'LIVE' ? 'danger' : 'info'}>{notice}</Callout>}

      {!enabled && (
        <Callout tone="warn">ماژول روشن نیست. هیچ پیامک بازاریابی ارسال نمی‌شود تا مدیر کل آن را فعال کند.</Callout>
      )}

      {tab === 'today' && (
        <Section
          title="کار امروز"
          description="مرتب‌شده بر اساس اولویت نوله؛ یک اقدام اصلی برای هر ردیف."
          actions={
            <button type="button" onClick={() => queue.reload()} className="btn btn-ghost btn-sm min-h-11">
              <RefreshCw className="h-4 w-4" />بروزرسانی
            </button>
          }
        >
          {queue.loading ? (
            <p className="text-sm text-gray-500">در حال بارگذاری…</p>
          ) : queue.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">فعلاً کار سررسیدشده‌ای نیست.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {queue.items.map((row) => {
                const id = String(row.customerId);
                const name = String(row.ownerName || row.businessName || 'بدون نام');
                const phone = String(row.phone || '');
                const action = String(row.nextActionType || 'NONE');
                const pri = row.priority != null ? Number(row.priority) : null;
                const aging = row.agingBucket ? String(row.agingBucket) : '';
                return (
                  <li key={id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">{name}</p>
                      <p className="text-xs text-gray-500">
                        {STAGE_LABEL[String(row.stage)] || String(row.stage)} · <span dir="ltr">{phone || 'بدون شماره'}</span>
                        {pri != null && (
                          <span className="mr-2 inline-flex gap-1">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">P{pri}</span>
                            {aging && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">{BUCKET_LABEL[aging] || aging}</span>}
                            {row.hasCheckoutIntent ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">سبد</span> : null}
                          </span>
                        )}
                      </p>
                    </div>
                    {phone && (
                      <a href={`tel:${phone}`} className="btn btn-primary btn-sm min-h-11 min-w-11" aria-label={`تماس با ${name}`}>
                        <Phone className="h-4 w-4" />تماس
                      </a>
                    )}
                    <Link href={`/admin/customers/${id}`} className="btn btn-ghost btn-sm min-h-11">
                      {action === 'SMS' ? <MessageSquare className="h-4 w-4" /> : null}
                      پرونده
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      {tab === 'zero' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="نوله فعال" value={(Number(zero.stats?.zeroOrderCount) || 0).toLocaleString('fa-IR')} />
            <Metric label="با سبد رهاشده" value={(Number(zero.stats?.withCheckoutIntent) || 0).toLocaleString('fa-IR')} />
            <Metric
              label="نرخ تبدیل ۳۰ روز %"
              value={win30 ? win30.rate.toLocaleString('fa-IR') : '—'}
            />
            <Metric
              label="میانگین روز تا خرید"
              value={win30?.avgDaysToFirstOrder != null ? win30.avgDaysToFirstOrder.toLocaleString('fa-IR') : '—'}
            />
          </div>

          <Section
            title="ثبت‌نام بدون خرید"
            description="مستقل از enrollment؛ بعد از اولین سفارش settled از لیست خارج می‌شوند. پیامک LIVE اینجا روشن نمی‌شود."
            actions={
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy === 'backfill'} onClick={() => void runBackfill()} className="btn btn-ghost btn-sm min-h-11">
                  بازسازی قیف
                </button>
                <button type="button" onClick={() => zero.reload()} className="btn btn-ghost btn-sm min-h-11">
                  <RefreshCw className="h-4 w-4" />بروزرسانی
                </button>
              </div>
            }
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBucket('')}
                className={`min-h-11 rounded-lg px-3 text-sm ${!bucket ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                همه سطل‌ها
              </button>
              {(['fresh', 'warm', 'aging', 'cool', 'recycle'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBucket(b)}
                  className={`min-h-11 rounded-lg px-3 text-sm ${bucket === b ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  {BUCKET_LABEL[b]}
                </button>
              ))}
            </div>
            <form
              className="mb-4 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                void zero.reload();
              }}
            >
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="جستجو نام، کد، موبایل"
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-sm"
                aria-label="جستجوی نوله"
              />
              <button type="submit" className="btn btn-primary btn-sm min-h-11">جستجو</button>
            </form>

            {zero.loading ? (
              <p className="text-sm text-gray-500">در حال بارگذاری…</p>
            ) : zero.data.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">نوله‌ای با این فیلتر نیست.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-right text-xs text-gray-500">
                      <th className="py-2">مشتری</th>
                      <th>سطل</th>
                      <th>اولویت</th>
                      <th>روز</th>
                      <th>سیگنال</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {zero.data.map((row) => {
                      const name = row.ownerName || row.businessName || 'بدون نام';
                      return (
                        <tr key={row.customerId} className="border-t border-gray-50">
                          <td className="py-2">
                            <p className="font-semibold text-gray-900">{name}</p>
                            <p className="text-xs text-gray-500" dir="ltr">{row.phone || '—'}</p>
                          </td>
                          <td>{BUCKET_LABEL[row.agingBucket] || row.agingBucket}</td>
                          <td className="font-mono">{row.priority}</td>
                          <td>{row.daysSinceRegister.toLocaleString('fa-IR')}</td>
                          <td className="text-xs text-gray-600">
                            {row.hasCheckoutIntent ? 'سبد · ' : ''}
                            {STAGE_LABEL[row.stage || ''] || row.stage || 'بدون قیف'}
                          </td>
                          <td>
                            <div className="flex flex-wrap justify-end gap-1">
                              {row.phone && (
                                <a href={`tel:${row.phone}`} className="btn btn-primary btn-sm min-h-11" aria-label={`تماس با ${name}`}>
                                  <Phone className="h-4 w-4" />
                                </a>
                              )}
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm min-h-11"
                                aria-label={`زمان‌بندی پیگیری ${name}`}
                                onClick={() => setFollowRow(row)}
                              >
                                <CalendarClock className="h-4 w-4" />
                              </button>
                              <Link href={`/admin/customers/${row.customerId}?tab=marketing`} className="btn btn-ghost btn-sm min-h-11">
                                پرونده
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {zero.meta.totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  className="btn btn-ghost btn-sm min-h-11"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  قبلی
                </button>
                <span>
                  صفحه {page.toLocaleString('fa-IR')} از {zero.meta.totalPages.toLocaleString('fa-IR')}
                  {' · '}
                  {zero.meta.total.toLocaleString('fa-IR')} نفر
                </span>
                <button
                  type="button"
                  disabled={page >= zero.meta.totalPages}
                  className="btn btn-ghost btn-sm min-h-11"
                  onClick={() => setPage((p) => p + 1)}
                >
                  بعدی
                </button>
              </div>
            )}
          </Section>
        </div>
      )}

      {tab === 'funnel' && (
        <Section title="ستون مرحله" description="شمارش از دیتابیس است؛ همه مشتریان یکجا لود نمی‌شوند.">
          {board.loading ? (
            <p className="text-sm text-gray-500">در حال بارگذاری…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(board.data?.stages || []).map((s) => (
                <Metric key={s.stage} label={STAGE_LABEL[s.stage] || s.stage} value={s.count.toLocaleString('fa-IR')} />
              ))}
              {(board.data?.stages || []).length === 0 && (
                <p className="text-sm text-gray-400">هنوز کسی وارد قیف نشده. بعد از OTP تکی یا ثبت‌نام عمده ساخته می‌شود.</p>
              )}
            </div>
          )}
        </Section>
      )}

      {tab === 'rules' && (
        <div className="space-y-4">
          <Section title="حالت ارسال سراسری" description="پیش‌فرض خاموش است. زنده فقط با تأیید مدیر کل.">
            <RadioCards
              name="marketingSmsMode"
              value={mode}
              onChange={(v) => saveSettings({ mode: v, enabled: v === 'CANARY' || v === 'LIVE' })}
              options={MODE_OPTIONS}
            />
            <p className="text-xs text-gray-500">ساعت آرام تهران: {String(hub.settings?.quietStartHour ?? 21)} تا {String(hub.settings?.quietEndHour ?? 9)}</p>
            {busy === 'settings' && <p className="text-xs text-gray-500">در حال ذخیره…</p>}
          </Section>

          <Section title="قالب‌های H2H" description="جای خالی فقط نام، شماره سفارش، محصول و شهر. شماره تلفن در متن مشتری نمی‌آید.">
            <div className="space-y-3">
              {hub.templates.map((t) => (
                <TemplateEditor key={String(t.id)} row={t} onSaved={hub.reload} />
              ))}
              {hub.templates.length === 0 && <p className="text-sm text-gray-400">قالب‌ها بعد از استقرار seed می‌شوند.</p>}
            </div>
          </Section>

          <Section title="اتوماسیون سناریوها" description="بازدید PDP و برگشت موجودی خاموش می‌مانند تا داده واقعی باشد. سبد رهاشده با پیامک فعلی سیستم هم‌پوشانی دارد.">
            <ul className="space-y-2">
              {scenarios.map((s) => {
                const locked = s.lockedOff === true;
                return (
                  <li key={String(s.code)} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{String(s.title)}</p>
                      <p className="font-mono text-[11px] text-gray-400" dir="ltr">{String(s.code)}</p>
                    </div>
                    <select
                      disabled={locked || busy === s.code}
                      value={String(s.mode)}
                      onChange={(e) => patchScenario(String(s.code), e.target.value)}
                      className="min-h-11 rounded-lg border border-gray-200 px-3 text-sm"
                    >
                      {MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.title}</option>)}
                    </select>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => canary(String(s.code))}
                      className="btn btn-ghost btn-sm min-h-11"
                    >
                      آزمایشی
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="لاگ ارسال">
            {hub.dispatches.length === 0 ? (
              <p className="text-sm text-gray-400">هنوز ارسالی ثبت نشده.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs text-gray-500">
                    <th className="py-2">وضعیت</th>
                    <th>قالب</th>
                    <th>حالت</th>
                    <th>زمان</th>
                  </tr>
                </thead>
                <tbody>
                  {hub.dispatches.map((d) => (
                    <tr key={String(d.id)} className="border-t border-gray-50">
                      <td className="py-2">{String(d.status)}{d.skipReason ? ` (${d.skipReason})` : ''}</td>
                      <td dir="ltr" className="font-mono text-xs">{String(d.templateCode || '—')}</td>
                      <td>{String(d.mode)}</td>
                      <td>{d.createdAt ? new Date(String(d.createdAt)).toLocaleString('fa-IR') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>
      )}

      <Modal open={!!followRow} onClose={() => setFollowRow(null)} title="زمان‌بندی پیگیری">
        {followRow && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {followRow.ownerName || followRow.businessName} — تماس بعدی بعد از چند ساعت؟
            </p>
            <label className="block text-sm">
              <span className="text-gray-500">ساعت تا پیگیری</span>
              <input
                type="number"
                min={1}
                max={168}
                value={snoozeHours}
                onChange={(e) => setSnoozeHours(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-500">یادداشت (اختیاری)</span>
              <textarea
                value={followNotes}
                onChange={(e) => setFollowNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy === 'follow'}
              onClick={() => void saveFollowUp()}
              className="btn btn-primary min-h-11 w-full"
            >
              ذخیره پیگیری
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function statsWindows(stats: Record<string, unknown> | null): Array<{
  windowDays: number;
  rate: number;
  avgDaysToFirstOrder: number | null;
}> {
  const raw = stats?.windows;
  if (!Array.isArray(raw)) return [];
  return raw.map((w) => {
    const row = w as Record<string, unknown>;
    return {
      windowDays: Number(row.windowDays) || 0,
      rate: Number(row.rate) || 0,
      avgDaysToFirstOrder: row.avgDaysToFirstOrder == null ? null : Number(row.avgDaysToFirstOrder),
    };
  });
}

function TemplateEditor({ row, onSaved }: { row: Record<string, unknown>; onSaved: () => Promise<void> }) {
  const [body, setBody] = useState(String(row.body || ''));
  const [saving, setSaving] = useState(false);
  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <p className="text-sm font-semibold text-gray-900">{String(row.title)}</p>
      <p className="mb-2 font-mono text-[11px] text-gray-400" dir="ltr">{String(row.code)}</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-6"
      />
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await apiClient.put('/marketing/templates', {
              id: row.id,
              channel: row.channel,
              code: row.code,
              title: row.title,
              body,
              callScript: row.callScript,
              medium: row.medium,
              messageClass: row.messageClass,
            });
            await onSaved();
          } finally {
            setSaving(false);
          }
        }}
        className="btn btn-primary btn-sm mt-2 min-h-11"
      >
        ذخیره متن
      </button>
    </div>
  );
}
