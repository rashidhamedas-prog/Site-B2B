'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { SpButton, SpEmptyState, SpSection, spFocusClass } from '@/components/sales-partners/SpUi';
import { formatSpDate } from '@/components/sales-partners/sp-labels';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'important' | 'urgent';

type AdminNotice = {
  id: string;
  title: string;
  body: string;
  linkLabel: string | null;
  linkUrl: string | null;
  tone: Tone;
  audienceCount: number;
  seenCount: number;
  dismissedCount: number;
  publishedAt: string;
  expiresAt: string | null;
  archivedAt: string | null;
};

const TONE_LABEL: Record<Tone, string> = {
  info: 'عادی',
  important: 'مهم',
  urgent: 'فوری',
};

const fieldClass = cn(
  'min-h-11 w-full min-w-0 rounded-2xl border border-stone-300 bg-white px-3 text-sm',
  spFocusClass,
);

function tehranDayEndIso(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(Date.UTC(year, month - 1, day + 1) - 3.5 * 60 * 60 * 1000).toISOString();
}

export function SpNoticeDesk() {
  const [rows, setRows] = useState<AdminNotice[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [tone, setTone] = useState<Tone>('info');
  const [expiresOn, setExpiresOn] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const next = await apiClient.get<AdminNotice[]>('/admin/sales-partners/notices');
      setRows(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خواندن اطلاعیه‌ها ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish() {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const created = await apiClient.post<AdminNotice>('/admin/sales-partners/notices', {
        title,
        body,
        tone,
        linkLabel: linkLabel.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
        expiresAt: tehranDayEndIso(expiresOn),
      });
      setTitle('');
      setBody('');
      setLinkLabel('');
      setLinkUrl('');
      setTone('info');
      setExpiresOn('');
      const count = created.audienceCount.toLocaleString('fa-IR');
      setStatus(
        created.audienceCount > 0
          ? `برای ${count} همکار فعال منتشر شد. هر کس وارد پنل شود، تا وقتی نبندد آن را بالای صفحه می‌بیند.`
          : 'اطلاعیه ثبت شد، ولی الان همکار فعالی برای دیدنش نیست.',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال اطلاعیه ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    setBusy(true);
    setError('');
    try {
      await apiClient.post(`/admin/sales-partners/notices/${id}/archive`, {});
      setConfirmArchiveId(null);
      setStatus('اطلاعیه از پنل همکاران برداشته شد.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'برداشتن اطلاعیه ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SpSection
        title="اطلاع‌رسانی به همکاران"
        description="یک موضوع را بنویسید و برای همه همکاران فعال بفرستید. در پنل خودشان، بالای صفحه، می‌ماند تا خودشان ببندند."
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void publish();
          }}
        >
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-800">عنوان</span>
            <input
              className={fieldClass}
              value={title}
              maxLength={120}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-800">متن</span>
            <textarea
              className={cn(fieldClass, 'min-h-32 py-3 leading-7')}
              value={body}
              maxLength={2000}
              required
              onChange={(event) => setBody(event.target.value)}
            />
            <span className="text-xs text-stone-500">{body.length.toLocaleString('fa-IR')} از ۲٬۰۰۰</span>
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-stone-800">اهمیت</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TONE_LABEL) as Tone[]).map((item) => (
                <label
                  key={item}
                  className={cn(
                    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm',
                    'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#C9A84C]',
                    tone === item ? 'bg-[#1B5C4A] text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200',
                  )}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="notice-tone"
                    checked={tone === item}
                    onChange={() => setTone(item)}
                  />
                  {TONE_LABEL[item]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-stone-800">لینک، اگر لازم است</span>
              <input
                className={fieldClass}
                value={linkUrl}
                placeholder="/sales-partners/catalog"
                dir="ltr"
                onChange={(event) => setLinkUrl(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-stone-800">متن دکمه لینک</span>
              <input
                className={fieldClass}
                value={linkLabel}
                maxLength={40}
                placeholder="مشاهده"
                onChange={(event) => setLinkLabel(event.target.value)}
              />
            </label>
          </div>
          <label className="grid max-w-xs gap-1 text-sm">
            <span className="font-medium text-stone-800">نمایش تا پایان این روز</span>
            <input
              className={fieldClass}
              type="date"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
            />
            <span className="text-xs text-stone-500">خالی بگذارید تا خودتان آن را بردارید.</span>
          </label>
          {error ? (
            <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          {status ? (
            <p className="rounded-2xl bg-emerald-50 p-3 text-sm leading-7 text-emerald-900" role="status">
              {status}
            </p>
          ) : null}
          <div>
            <SpButton type="submit" disabled={busy}>
              {busy ? 'در حال ارسال…' : 'ارسال به همه همکاران فعال'}
            </SpButton>
          </div>
        </form>
      </SpSection>

      <SpSection title="اطلاعیه‌های فرستاده‌شده" description="عدد «دیده‌اند» یعنی وارد پنل شده و اطلاعیه برایشان نمایش داده شده است.">
        {loading ? <p className="text-sm text-stone-600">در حال خواندن…</p> : null}
        {!loading && rows.length === 0 ? <SpEmptyState>هنوز اطلاعیه‌ای نفرستاده‌اید.</SpEmptyState> : null}
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#1B5C4A]">
                    {TONE_LABEL[row.tone] || 'عادی'}
                    {row.archivedAt ? ' · برداشته شده' : ''}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-stone-900">{row.title}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-700">{row.body}</p>
                  <p className="mt-2 text-xs text-stone-500">
                    {formatSpDate(row.publishedAt)}
                    {' · '}
                    {row.audienceCount.toLocaleString('fa-IR')} همکار در زمان ارسال فعال بودند
                    {' · '}
                    {row.seenCount.toLocaleString('fa-IR')} نفر دیده‌اند
                    {' · '}
                    {row.dismissedCount.toLocaleString('fa-IR')} نفر بسته‌اند
                  </p>
                </div>
                {!row.archivedAt ? (
                  confirmArchiveId === row.id ? (
                    <SpButton variant="destructive" disabled={busy} onClick={() => void archive(row.id)}>
                      بله، بردار
                    </SpButton>
                  ) : (
                    <SpButton variant="secondary" disabled={busy} onClick={() => setConfirmArchiveId(row.id)}>
                      برداشتن از پنل
                    </SpButton>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </SpSection>
    </div>
  );
}
