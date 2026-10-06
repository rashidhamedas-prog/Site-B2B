'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Bell } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatSpDate } from './sp-labels';
import { spFocusClass } from './SpUi';

type Tone = 'info' | 'important' | 'urgent';

type PartnerNotice = {
  id: string;
  title: string;
  body: string;
  linkLabel: string | null;
  linkUrl: string | null;
  tone: Tone;
  publishedAt: string;
  seen: boolean;
  dismissed: boolean;
};

type NoticeFeed = {
  banner: PartnerNotice | null;
  items: PartnerNotice[];
  unseenCount: number;
};

type NoticeContextValue = {
  feed: NoticeFeed | null;
  loading: boolean;
  error: string;
  dismiss: (id: string) => Promise<void>;
  markSeen: (id: string) => Promise<void>;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

const TONE_CLASS: Record<Tone, string> = {
  info: 'border-stone-200 bg-white',
  important: 'border-[#C9A84C]/60 bg-[#fbf6ea]',
  urgent: 'border-red-200 bg-red-50',
};

const TONE_LABEL: Record<Tone, string> = {
  info: 'اطلاع',
  important: 'مهم',
  urgent: 'فوری',
};

function useNoticeContext() {
  const value = useContext(NoticeContext);
  if (!value) throw new Error('notice context missing');
  return value;
}

export function SalesPartnerNoticeProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<NoticeFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const next = await apiClient.get<NoticeFeed>('/sales-partners/notices');
      setFeed(next);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'اطلاعیه‌ها خوانده نشد');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const markSeen = useCallback(async (id: string) => {
    await apiClient.post(`/sales-partners/notices/${id}/seen`, {});
    setFeed((current) => {
      if (!current) return current;
      const items = current.items.map((item) => (item.id === id ? { ...item, seen: true } : item));
      return {
        items,
        banner: current.banner && current.banner.id === id ? { ...current.banner, seen: true } : current.banner,
        unseenCount: items.filter((item) => !item.seen && !item.dismissed).length,
      };
    });
  }, []);

  const dismiss = useCallback(
    async (id: string) => {
      setFeed((current) => {
        if (!current) return current;
        const items = current.items.map((item) =>
          item.id === id ? { ...item, dismissed: true, seen: true } : item,
        );
        return {
          items,
          banner: current.banner?.id === id ? null : current.banner,
          unseenCount: items.filter((item) => !item.seen && !item.dismissed).length,
        };
      });
      try {
        await apiClient.post(`/sales-partners/notices/${id}/dismiss`, {});
        await reload();
      } catch (err) {
        await reload();
        throw err;
      }
    },
    [reload],
  );

  const value = useMemo(
    () => ({ feed, loading, error, dismiss, markSeen }),
    [feed, loading, error, dismiss, markSeen],
  );

  return <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>;
}

export function SalesPartnerNoticeBell() {
  const { feed } = useNoticeContext();
  const unseen = feed?.unseenCount ?? 0;
  const label = unseen > 0 ? `اطلاعیه‌ها، ${unseen.toLocaleString('fa-IR')} خوانده‌نشده` : 'اطلاعیه‌ها';
  return (
    <Link
      href="/sales-partners/notices"
      aria-label={label}
      className={cn(
        'relative inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3 text-sm text-stone-700 shadow-sm',
        spFocusClass,
      )}
    >
      <Bell className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">اطلاعیه‌ها</span>
      {unseen > 0 ? (
        <span className="inline-flex min-w-5 justify-center rounded-full bg-[#C9A84C] px-1.5 text-[10px] font-bold text-[#0F2F28]">
          {unseen.toLocaleString('fa-IR')}
        </span>
      ) : null}
    </Link>
  );
}

export function SalesPartnerNoticeBanner() {
  const pathname = usePathname() || '';
  const { feed, dismiss, markSeen } = useNoticeContext();
  const banner = feed?.banner ?? null;
  const [dismissError, setDismissError] = useState('');

  useEffect(() => {
    if (!banner || banner.seen) return;
    void markSeen(banner.id).catch(() => undefined);
  }, [banner, markSeen]);

  if (pathname.startsWith('/sales-partners/notices') || !banner) return null;
  const more = (feed?.items.length || 0) > 1;

  return (
    <section
      className={cn('mt-4 rounded-2xl border p-4 shadow-sm shadow-stone-900/5', TONE_CLASS[banner.tone])}
      aria-label="اطلاعیه ترنم"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-[#1B5C4A]">{TONE_LABEL[banner.tone]}</p>
        <button
          type="button"
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm text-stone-700',
            spFocusClass,
          )}
          onClick={() => {
            setDismissError('');
            void dismiss(banner.id).catch((err: unknown) => {
              setDismissError(err instanceof Error ? err.message : 'بستن اطلاعیه ناموفق بود');
            });
          }}
        >
          خواندم
        </button>
      </div>
      <h2 className="mt-1 text-base font-semibold text-stone-900">{banner.title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-700">{banner.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <NoticeLink href={banner.linkUrl} label={banner.linkLabel} />
        {more ? (
          <Link href="/sales-partners/notices" className={cn('text-sm text-stone-600 underline-offset-4 hover:underline', spFocusClass)}>
            همه اطلاعیه‌ها
          </Link>
        ) : null}
      </div>
      {dismissError ? (
        <p className="mt-2 text-sm text-red-800" role="alert">
          {dismissError}
        </p>
      ) : null}
    </section>
  );
}

export function SalesPartnerNoticeList() {
  const { feed, loading, error, dismiss } = useNoticeContext();
  const [dismissError, setDismissError] = useState('');

  if (loading && !feed) return <p className="text-sm text-stone-600">در حال خواندن اطلاعیه‌ها…</p>;
  if (error && !feed) {
    return (
      <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800" role="alert">
        {error}
      </p>
    );
  }
  if (!feed || feed.items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-4 text-sm leading-7 text-stone-600">
        فعلاً اطلاعیه‌ای از ترنم ندارید.
      </p>
    );
  }

  return (
    <ul className="grid gap-3">
      {feed.items.map((item) => (
        <li key={item.id} className={cn('rounded-2xl border p-4', TONE_CLASS[item.tone], item.dismissed && 'opacity-70')}>
          <p className="text-xs font-semibold text-[#1B5C4A]">
            {TONE_LABEL[item.tone]}
            {item.dismissed ? ' · خوانده‌اید' : ''}
          </p>
          <h2 className="mt-1 text-base font-semibold text-stone-900">{item.title}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-700">{item.body}</p>
          <p className="mt-2 text-xs text-stone-500">{formatSpDate(item.publishedAt)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <NoticeLink href={item.linkUrl} label={item.linkLabel} />
            {!item.dismissed ? (
              <button
                type="button"
                className={cn('inline-flex min-h-11 items-center rounded-full px-3 text-sm text-stone-700', spFocusClass)}
                onClick={() => {
                  setDismissError('');
                  void dismiss(item.id).catch((err: unknown) => {
                    setDismissError(err instanceof Error ? err.message : 'بستن اطلاعیه ناموفق بود');
                  });
                }}
              >
                خواندم
              </button>
            ) : null}
          </div>
        </li>
      ))}
      {dismissError ? (
        <li>
          <p className="text-sm text-red-800" role="alert">
            {dismissError}
          </p>
        </li>
      ) : null}
    </ul>
  );
}

function NoticeLink({ href, label }: { href: string | null; label: string | null }) {
  if (!href || !label) return null;
  const className = cn(
    'inline-flex min-h-11 items-center text-sm font-medium text-[#1B5C4A] underline-offset-4 hover:underline',
    spFocusClass,
  );
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}
