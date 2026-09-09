'use client';

import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '@/lib/auth';

export function PartnerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname.replace(/\/+$/, '') === '/partners/login';

  if (isLogin) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">پنل همکار ترنم</p>
            <p className="text-xs text-gray-500">سفارش‌ها و حساب شما — نه ویترین فروشگاه</p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearToken();
              router.push('/partners/login');
            }}
            className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 px-4 text-sm"
          >
            خروج
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
