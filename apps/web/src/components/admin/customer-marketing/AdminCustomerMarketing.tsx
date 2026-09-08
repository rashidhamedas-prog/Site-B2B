'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Phone, MessageSquare, RefreshCw } from 'lucide-react';
import { AdminChannelTabs, type AdminChannel } from '../AdminChannelTabs';
import { Callout, Metric, RadioCards, Section } from '../admin-omnichannel-ui';
import { apiClient } from '@/lib/api';
import { useMarketingBoard, useMarketingHub, useMarketingQueue } from '@/lib/hooks/useCustomerMarketing';

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

const MODE_OPTIONS = [
  { value: 'OFF', title: 'خاموش', hint: 'هیچ پیامکی نمی‌رود' },
  { value: 'PREVIEW', title: 'پیش‌نمایش', hint: 'فقط متن آماده می‌شود' },
  { value: 'CANARY', title: 'آزمایشی', hint: 'فقط به شماره شما' },
  { value: 'LIVE', title: 'زنده', hint: 'فقط مدیر کل' },
];

export function AdminCustomerMarketing() {
  const [channel, setChannel] = useState<AdminChannel>('RETAIL');
  const [tab, setTab] = useState<'today' | 'funnel' | 'rules'>('today');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const board = useMarketingBoard(channel);
  const queue = useMarketingQueue(channel);
  const hub = useMarketingHub(channel);

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

  const scenarios = useMemo(
    () => (hub.automations?.scenarios || []).filter((s) => s.channel === channel),
    [hub.automations, channel],
  );

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
        {([['today', 'امروز'], ['funnel', 'قیف'], ['rules', 'متن و قوانین']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
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
          description="یک اقدام اصلی برای هر ردیف: تماس یا رفتن به پرونده."
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
                return (
                  <li key={id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">{name}</p>
                      <p className="text-xs text-gray-500">
                        {STAGE_LABEL[String(row.stage)] || String(row.stage)} · <span dir="ltr">{phone || 'بدون شماره'}</span>
                      </p>
                    </div>
                    {phone && (
                      <a href={`tel:${phone}`} className="btn btn-primary btn-sm min-h-11 min-w-11">
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
    </div>
  );
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
