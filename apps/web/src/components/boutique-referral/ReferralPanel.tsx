'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { clearToken } from '@/lib/auth';
import { toman } from '@/lib/product-display';

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5C4A]';

type Section = 'home' | 'link' | 'introductions' | 'detail' | 'rewards' | 'help';

const NAV = [
  { href: '/hamkar-moarefi/panel', label: 'خانه' },
  { href: '/hamkar-moarefi/panel/link', label: 'لینک و ابزار' },
  { href: '/hamkar-moarefi/panel/introductions', label: 'معرفی‌ها' },
  { href: '/hamkar-moarefi/panel/rewards', label: 'پاداش' },
  { href: '/hamkar-moarefi/panel/help', label: 'راهنما و اختلاف' },
];

export function ReferralPanel({ section, introductionId }: { section: Section; introductionId?: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');
  const [dispute, setDispute] = useState('');
  const [notice, setNotice] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualConsent, setManualConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const path =
          section === 'link' ? '/boutique-referral/me/toolkit'
          : section === 'introductions' ? `/boutique-referral/me/introductions${query ? `?q=${encodeURIComponent(query)}` : ''}`
          : section === 'detail' && introductionId ? `/boutique-referral/me/introductions/${introductionId}`
          : section === 'rewards' ? '/boutique-referral/me/rewards'
          : section === 'help' ? '/boutique-referral/me'
          : '/boutique-referral/me';
        const body = await apiClient.get<Record<string, unknown>>(path);
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'اطلاعات خوانده نشد.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (section !== 'help') load();
    else setLoading(false);
    return () => { cancelled = true; };
  }, [section, introductionId, query]);

  async function copyLink() {
    const link = String(data?.link || '');
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied('لینک کپی شد.');
    } catch {
      setCopied('کپی خودکار ممکن نشد. لینک را انتخاب کنید.');
    }
  }

  async function sendManual(event: React.FormEvent) {
    event.preventDefault();
    setNotice('');
    try {
      await apiClient.post('/boutique-referral/me/introductions', {
        boutiqueName: manualName,
        phone: manualPhone,
        consentToShareContact: manualConsent,
      });
      setNotice('معرفی دستی ثبت شد. وضعیت قطعی آن را در فهرست معرفی‌ها ببینید.');
      setManualName('');
      setManualPhone('');
      setManualConsent(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'ثبت معرفی انجام نشد.');
    }
  }

  async function sendDispute(event: React.FormEvent) {
    event.preventDefault();
    if (!introductionId) return;
    setNotice('');
    try {
      await apiClient.post('/boutique-referral/me/disputes', { introductionId, message: dispute });
      setNotice('اختلاف ثبت شد و تیم ترنم آن را می‌بیند.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'ثبت اختلاف انجام نشد.');
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 md:grid-cols-[180px_1fr]">
      <nav aria-label="پنل همکار" className="flex gap-2 overflow-auto md:flex-col">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={`min-h-11 whitespace-nowrap rounded-full px-3 py-2 text-sm ${focus}`}>{item.label}</Link>
        ))}
        <button type="button" onClick={() => { clearToken(); window.location.href = '/hamkar-moarefi/login'; }} className={`min-h-11 text-start text-sm ${focus}`}>خروج</button>
      </nav>
      <main className="min-w-0">
        {loading && <p>در حال خواندن آخرین وضعیت ثبت‌شده.</p>}
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm leading-7">{error.includes('دسترسی') ? 'به این مورد دسترسی ندارید.' : error}</p>}
        {!loading && !error && section === 'home' && data && (
          <section>
            <h1 className="text-2xl font-semibold">{String(data.displayName || 'خانه')}</h1>
            <p className="mt-2 text-sm leading-7">{String(data.freshnessNote || '')}</p>
            <Link href={String((data.primaryAction as { href?: string })?.href || '/hamkar-moarefi/panel/link')} className={`mt-4 inline-flex min-h-11 items-center rounded-full bg-[#1B5C4A] px-5 text-sm text-white ${focus}`}>
              {String((data.primaryAction as { label?: string })?.label || 'ادامه')}
            </Link>
            <p className="mt-6 text-sm">معرفی‌های پذیرفته‌شده: {String(data.acceptedCount ?? 0)}</p>
            <p className="text-sm">قابل پرداخت: {toman(Number(data.availableForPayout || 0))} تومان</p>
            <ul className="mt-4 space-y-3">
              {((data.recent as Array<{ id: string; stageLabel: string; explanation: string }> ) || []).map((item) => (
                <li key={item.id} className="rounded-2xl border p-4 text-sm">
                  <Link href={`/hamkar-moarefi/panel/introductions/${item.id}`} className={focus}>{item.stageLabel}</Link>
                  <p className="mt-1 leading-7">{item.explanation}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!loading && !error && section === 'link' && data && (
          <section>
            <h1 className="text-2xl font-semibold">لینک و ابزار معرفی</h1>
            <p className="mt-3 break-all text-sm">{String(data.link || 'هنوز لینکی ساخته نشده است.')}</p>
            <button type="button" onClick={copyLink} className={`mt-3 min-h-11 rounded-full border px-4 text-sm ${focus}`}>کپی لینک</button>
            <p role="status" className="mt-2 text-sm">{copied}</p>
            <p className="mt-4 text-sm leading-7">{String(data.invitationText || '')}</p>
            <p className="mt-3 text-sm leading-7">{String(data.eligibilityNote || 'معیار بوتیک هنوز توسط ترنم منتشر نشده است.')}</p>
            <p className="mt-3 text-sm leading-7">{String(data.minOrderNote || '')}</p>
            <p className="mt-3 text-sm leading-7">{String(data.materialsNote || '')}</p>
            <p className="mt-3 text-sm leading-7">{data.rewardUnset ? 'مبلغ یا درصد پاداش هنوز تعیین نشده است.' : 'قاعدهٔ پاداش در حساب شما ثبت شده و فقط بعد از سفارش پرداخت‌شده در وضعیت برآوردی می‌آید.'}</p>
            <form onSubmit={sendManual} className="mt-6 space-y-3 rounded-2xl border p-4">
              <h2 className="text-base font-semibold">معرفی دستی</h2>
              <p className="text-sm leading-7">فقط وقتی بوتیک صریح اجازه داده شماره و نامش را با ترنم در میان بگذارید.</p>
              <label className="block text-sm">نام بوتیک
                <input value={manualName} onChange={(e) => setManualName(e.target.value)} required className={`mt-1 h-11 w-full rounded-xl border px-3 ${focus}`} />
              </label>
              <label className="block text-sm">موبایل بوتیک
                <input value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} required className={`mt-1 h-11 w-full rounded-xl border px-3 ${focus}`} />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={manualConsent} onChange={(e) => setManualConsent(e.target.checked)} className="mt-1" />
                <span>بوتیک اجازه داده اطلاعات تماسش برای پیگیری ترنم ثبت شود.</span>
              </label>
              <button disabled={!manualConsent} className={`min-h-11 rounded-full border px-4 text-sm disabled:opacity-50 ${focus}`}>ثبت معرفی دستی</button>
              {notice && <p role="status" className="text-sm">{notice}</p>}
            </form>
          </section>
        )}
        {!loading && !error && section === 'introductions' && (
          <section>
            <h1 className="text-2xl font-semibold">معرفی‌ها</h1>
            <form onSubmit={(event) => { event.preventDefault(); setQuery((event.currentTarget.elements.namedItem('q') as HTMLInputElement).value); }} className="mt-4 flex gap-2">
              <input name="q" aria-label="جستجوی معرفی" className={`h-11 min-w-0 flex-1 rounded-xl border px-3 ${focus}`} />
              <button className={`min-h-11 rounded-full bg-[#1B5C4A] px-4 text-sm text-white ${focus}`}>جستجو</button>
            </form>
            {!((data?.items as unknown[]) || []).length && <p className="mt-6 text-sm">هنوز معرفی‌ای ثبت نشده است.</p>}
            <ul className="mt-4 space-y-3">
              {((data?.items as Array<{ id: string; stageLabel: string; explanation: string }> ) || []).filter(Boolean).map((item) => (
                <li key={item.id} className="rounded-2xl border p-4">
                  <Link href={`/hamkar-moarefi/panel/introductions/${item.id}`} className={focus}>{item.stageLabel}</Link>
                  <p className="mt-1 text-sm leading-7">{item.explanation}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!loading && !error && section === 'detail' && data && (
          <section>
            <h1 className="text-2xl font-semibold">{String((data.introduction as { stageLabel?: string })?.stageLabel || 'معرفی')}</h1>
            <p className="mt-2 text-sm leading-7">{String((data.introduction as { freshnessNote?: string })?.freshnessNote || '')}</p>
            <p className="mt-2 text-sm leading-7">{String((data.introduction as { explanation?: string })?.explanation || '')}</p>
            <p className="mt-2 text-sm">اقدام بعدی: {String((data.introduction as { nextAction?: string })?.nextAction || '')}</p>
            <ol className="mt-4 space-y-3">
              {((data.timeline as Array<{ at: string; stageLabel: string; explanation: string | null }>) || []).map((event) => (
                <li key={event.at} className="rounded-2xl bg-[#F6F1E8] p-3 text-sm">
                  <div>{event.stageLabel}</div>
                  <div>{event.explanation}</div>
                </li>
              ))}
            </ol>
            <form onSubmit={sendDispute} className="mt-6 space-y-3">
              <label className="block text-sm">اگر این تصمیم درست نیست
                <textarea value={dispute} onChange={(e) => setDispute(e.target.value)} required minLength={8} className={`mt-1 min-h-24 w-full rounded-xl border p-3 ${focus}`} />
              </label>
              <button className={`min-h-11 rounded-full border px-4 text-sm ${focus}`}>ثبت اختلاف</button>
              {notice && <p role="status" className="text-sm">{notice}</p>}
            </form>
          </section>
        )}
        {!loading && !error && section === 'rewards' && data && (
          <section>
            <h1 className="text-2xl font-semibold">پاداش</h1>
            <p className="mt-2 text-sm leading-7">{String(data.freshnessNote || '')}</p>
            <ul className="mt-4 space-y-3">
              {Object.entries((data.bucketDefinitions as Record<string, string>) || {}).map(([key, text]) => (
                <li key={key} className="rounded-2xl border p-4 text-sm leading-7">
                  <strong>{String((data.bucketLabels as Record<string, string>)?.[key] || key)}</strong>
                  <span className="ms-2">{toman(Number((data.buckets as Record<string, number> | undefined)?.[key] || 0))} تومان</span>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm">قابل پرداخت الان: {toman(Number(data.availableForPayout || 0))} تومان</p>
          </section>
        )}
        {section === 'help' && (
          <section>
            <h1 className="text-2xl font-semibold">راهنما و اختلاف</h1>
            <p className="mt-3 text-sm leading-7">برای سؤال دربارهٔ یک معرفی، از صفحهٔ همان معرفی اختلاف را ثبت کنید. تیم فروش پاسخ را در توضیح قابل‌نمایش همان معرفی می‌نویسد.</p>
            <p className="mt-3 text-sm leading-7">اگر بوتیک از قبل مشتری ترنم باشد، دو همکار یک بوتیک را معرفی کنند، یا مهلت مالکیت تمام شده باشد، تصمیم با بررسی انسان است و مالکیت معتبر بی‌صدا عوض نمی‌شود.</p>
            <Link href="/hamkar-moarefi/panel/introductions" className={`mt-4 inline-flex min-h-11 items-center text-sm text-[#1B5C4A] ${focus}`}>رفتن به معرفی‌ها</Link>
          </section>
        )}
      </main>
    </div>
  );
}
