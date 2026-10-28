'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { getRole } from '@/lib/auth';
import { ensureOptOutFooter } from './sms-parts';
import { PartCounter } from './PartCounter';
import { insertVariable, isTemplateVar } from './template-vars';
import { VariableChips } from './VariableChips';
import { canEditUnitPrice, parseUnitPriceInput, priceCaption } from './sms-send-ui';
import { PhonePreview, SmsClassBadge, SmsSection, SmsStatusBadge } from './sms-ui';

export function AdminSmsTemplates() {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [varError, setVarError] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    apiClient.get<any[]>('/admin/sms/templates').then(setRows).catch(() => []);
  }, []);
  const insert = (key: Parameters<typeof insertVariable>[1]) => {
    if (!edit) return;
    const cursor = bodyRef.current?.selectionStart ?? String(edit.body || '').length;
    const next = insertVariable(String(edit.body || ''), key, cursor);
    setEdit({ ...edit, body: next.body });
    setVarError('');
    requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelectionRange(next.cursor, next.cursor);
    });
  };
  return (
    <SmsSection title="قالب‌ها">
      {rows.length === 0 && <p className="mb-3 text-sm text-gray-500">اولین قالب را بسازید</p>}
      <div className="tablewrap overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-right text-gray-500">
              <th className="p-2">نام</th>
              <th className="p-2">کلید</th>
              <th className="p-2">نوع</th>
              <th className="p-2">نسخه</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-50">
                <td className="p-2">
                  <button type="button" className="font-medium text-primary" onClick={() => setEdit(r)}>
                    {r.name}
                  </button>
                </td>
                <td className="p-2 ltr text-left text-xs">{r.key}</td>
                <td className="p-2">
                  <SmsClassBadge messageClass={r.messageClass} />
                </td>
                <td className="p-2">{r.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <VariableChips onInsert={insert} />
            <textarea
              ref={bodyRef}
              className="mt-3 min-h-[140px] w-full rounded-lg border p-3 text-sm"
              value={edit.body}
              onChange={(e) => {
                setEdit({ ...edit, body: e.target.value });
                const unknown = Array.from(String(e.target.value).matchAll(/\{(\w+)\}/g))
                  .map((match) => match[1])
                  .filter((key) => key !== 'code' && !isTemplateVar(key));
                setVarError(unknown.length ? `متغیر ناشناخته: ${unknown.join('، ')}` : '');
              }}
            />
            {varError && <p className="mt-1 text-xs text-red-700">{varError}</p>}
            <PartCounter body={edit.body} messageClass={edit.messageClass} />
            <button
              type="button"
              className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-white"
              onClick={() =>
                apiClient.patch(`/admin/sms/templates/${edit.id}`, { body: edit.body }).then(() => {
                  setEdit(null);
                  apiClient.get<any[]>('/admin/sms/templates').then(setRows);
                })
              }
            >
              ذخیره نسخه جدید
            </button>
          </div>
          <PhonePreview
            body={ensureOptOutFooter(edit.body, edit.messageClass)}
            messageClass={edit.messageClass}
          />
        </div>
      )}
    </SmsSection>
  );
}

export function AdminSmsContacts() {
  const [lists, setLists] = useState<any[]>([]);
  const [name, setName] = useState('');
  useEffect(() => {
    apiClient.get<any[]>('/admin/sms/lists').then(setLists).catch(() => []);
  }, []);
  return (
    <SmsSection title="مخاطبان و سگمنت‌ها">
      {lists.length === 0 && <p className="mb-3 text-sm text-gray-500">لیستی نیست — یکی بسازید</p>}
      <ul className="mb-4 space-y-2 text-sm">
        {lists.map((l) => (
          <li key={l.id} className="rounded-lg border border-gray-100 px-3 py-2">
            {l.name} · {l.type === 'DYNAMIC' ? 'پویا' : 'ایستا'}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input
          className="min-h-11 flex-1 rounded-lg border px-3"
          placeholder="نام لیست"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-white"
          onClick={() =>
            apiClient.post('/admin/sms/lists', { name }).then(() => {
              setName('');
              apiClient.get<any[]>('/admin/sms/lists').then(setLists);
            })
          }
        >
          ایجاد لیست
        </button>
      </div>
    </SmsSection>
  );
}

export function AdminSmsReports() {
  const [rows, setRows] = useState<any[]>([]);
  const [source, setSource] = useState('');
  useEffect(() => {
    const q = source ? `?source=${encodeURIComponent(source)}` : '';
    apiClient.get<any[]>(`/admin/sms/messages${q}`).then(setRows).catch(() => []);
  }, [source]);
  return (
    <SmsSection
      title="گزارش‌ها"
      actions={
        <button
          type="button"
          className="min-h-11 rounded-lg border px-3 text-sm"
          onClick={() =>
            apiClient.get<{ csv: string }>('/admin/sms/reports/export.csv').then((r) => {
              const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'sms-report.csv';
              a.click();
            })
          }
        >
          خروجی CSV
        </button>
      }
    >
      <label className="mb-3 block text-sm">
        منبع
        <select
          className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          <option value="">همه</option>
          <option value="WHOLESALE">عمده</option>
          <option value="WHOLESALE_REFERRAL">معرف عمده</option>
          <option value="SALES_PARTNER">همکار فروش</option>
          <option value="RETAIL">خرده‌فروشی</option>
        </select>
      </label>
      <div className="tablewrap overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-right text-gray-500">
              <th className="p-2">موبایل</th>
              <th className="p-2">وضعیت</th>
              <th className="p-2">نوع</th>
              <th className="p-2">تلاش</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-50">
                <td className="p-2 ltr text-left">{r.phoneNormalized}</td>
                <td className="p-2">
                  <SmsStatusBadge status={r.status} />
                </td>
                <td className="p-2">
                  <SmsClassBadge messageClass={r.messageClass} />
                </td>
                <td className="p-2">{r.attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SmsSection>
  );
}

export function AdminSmsOptout() {
  const [tab, setTab] = useState<'unsub' | 'black'>('unsub');
  const [rows, setRows] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const load = () => {
    const path = tab === 'unsub' ? '/admin/sms/unsubscribes' : '/admin/sms/blacklist';
    apiClient.get<any[]>(path).then(setRows).catch(() => []);
  };
  useEffect(() => {
    load();
  }, [tab]);
  return (
    <SmsSection title="لغو و لیست سیاه">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          className={`min-h-11 rounded-lg px-3 text-sm ${tab === 'unsub' ? 'bg-primary text-white' : 'border'}`}
          onClick={() => setTab('unsub')}
        >
          لغو ۱۱
        </button>
        <button
          type="button"
          className={`min-h-11 rounded-lg px-3 text-sm ${tab === 'black' ? 'bg-primary text-white' : 'border'}`}
          onClick={() => setTab('black')}
        >
          لیست سیاه
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="min-h-11 rounded-lg border px-3 ltr text-left"
          placeholder="09…"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="min-h-11 flex-1 rounded-lg border px-3"
          placeholder="دلیل"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button
          type="button"
          className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-white"
          onClick={() => {
            const req =
              tab === 'unsub'
                ? apiClient.post('/admin/sms/unsubscribes', { phone })
                : apiClient.post('/admin/sms/blacklist', { phone, reason: reason || 'manual' });
            req.then(() => {
              setPhone('');
              setReason('');
              load();
            });
          }}
        >
          افزودن
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {rows.map((r: any) => (
          <li key={r.phoneNormalized || r.id} className="flex justify-between border-b border-gray-50 py-2">
            <span className="ltr">{r.phoneNormalized}</span>
            <span className="text-gray-500">{r.source || r.reason || r.scope}</span>
          </li>
        ))}
      </ul>
    </SmsSection>
  );
}

export function AdminSmsAudit() {
  const [rows, setRows] = useState<any[]>([]);
  const [forbidden, setForbidden] = useState(false);
  useEffect(() => {
    apiClient
      .get<any[]>('/admin/sms/audit-log')
      .then(setRows)
      .catch((e) => {
        if (e?.status === 403) setForbidden(true);
      });
  }, []);
  if (forbidden) {
    return (
      <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        دسترسی ندارید — نقش لازم: مدیر پیامک یا مدیر کل
      </div>
    );
  }
  return (
    <SmsSection title="گزارش فعالیت">
      <div className="tablewrap overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-right text-gray-500">
              <th className="p-2">زمان</th>
              <th className="p-2">اکشن</th>
              <th className="p-2">هدف</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-50 align-top">
                <td className="p-2 whitespace-nowrap">
                  {r.at ? new Date(r.at).toLocaleString('fa-IR') : '—'}
                </td>
                <td className="p-2">{r.action}</td>
                <td className="p-2">
                  {r.targetType}/{r.targetId}
                  {r.meta && (
                    <details className="mt-1 text-xs text-gray-500">
                      <summary>جزئیات</summary>
                      <pre className="whitespace-pre-wrap">{JSON.stringify(r.meta, null, 2)}</pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SmsSection>
  );
}

export function AdminSmsSettings() {
  const [s, setS] = useState<any>(null);
  const [probe, setProbe] = useState<string | null>(null);
  const role = typeof window !== 'undefined' ? getRole() : null;
  const allowUnitPrice = canEditUnitPrice(role);
  const load = () => apiClient.get('/admin/sms/settings').then(setS).catch(() => undefined);
  useEffect(() => {
    load();
  }, []);
  if (!s) return <div className="h-32 animate-pulse rounded-2xl bg-gray-100" aria-busy="true" />;
  const unitPriceValue =
    s.unitPricePerPart == null || s.unitPricePerPart === '' ? '' : String(s.unitPricePerPart);
  return (
    <SmsSection title="تنظیمات پنل پیامک">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          شروع ساعات تبلیغاتی
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 ltr text-left"
            value={s.promoWindowStart}
            onChange={(e) => setS({ ...s, promoWindowStart: e.target.value })}
          />
        </label>
        <label className="text-sm">
          پایان ساعات تبلیغاتی
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 ltr text-left"
            value={s.promoWindowEnd}
            onChange={(e) => setS({ ...s, promoWindowEnd: e.target.value })}
          />
        </label>
        <label className="text-sm">
          آستانه هشدار اعتبار (پیامک)
          <input
            type="number"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={s.creditWarnThreshold}
            onChange={(e) => setS({ ...s, creditWarnThreshold: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          قیمت هر پارت (ریال)
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            disabled={!allowUnitPrice}
            placeholder="خالی = تنظیم‌نشده"
            className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-gray-50"
            value={unitPriceValue}
            onChange={(e) =>
              setS({
                ...s,
                unitPricePerPart: parseUnitPriceInput(e.target.value),
              })
            }
          />
          <span className="mt-1 block text-xs text-gray-500" role="status">
            {priceCaption(s.unitPricePerPart ?? null)}
          </span>
        </label>
        <label className="text-sm">
          شماره‌های تست (با ویرگول، حداکثر ۵)
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 ltr text-left"
            value={(s.testNumbers || []).join(',')}
            onChange={(e) =>
              setS({
                ...s,
                testNumbers: e.target.value
                  .split(',')
                  .map((x: string) => x.trim())
                  .filter(Boolean)
                  .slice(0, 5),
              })
            }
          />
        </label>
      </div>
      {!s.officialWindow && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          این بازه رسماً تأییدنشده است
        </p>
      )}
      <div className="mt-4 rounded-xl border border-gray-100 p-3 text-sm">
        <div>وضعیت کلید API: {s.keys?.apiKey ? 'تنظیم شده ✓' : 'نشده ✗'}</div>
        <div>Egress: {s.keys?.egress ? 'تنظیم شده ✓' : 'نشده ✗'}</div>
        <div>Provider: {s.provider}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-white"
          onClick={() => apiClient.patch('/admin/sms/settings', s).then(load)}
        >
          ذخیره
        </button>
        <button
          type="button"
          className="min-h-11 rounded-lg border px-4 text-sm"
          onClick={() =>
            apiClient.post('/admin/sms/settings/probe', {}).then((r: any) => {
              setProbe(r.ok ? `اتصال موفق — اعتبار ${r.credit ?? '—'} پیامک` : r.errorMessage || 'ناموفق');
            })
          }
        >
          تست اتصال
        </button>
      </div>
      {probe && <p className="mt-2 text-sm text-gray-700">{probe}</p>}
    </SmsSection>
  );
}
