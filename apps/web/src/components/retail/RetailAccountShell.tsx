'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Heart,
  Home,
  Lock,
  MapPin,
  Package,
  RefreshCcw,
  User,
} from 'lucide-react';
import { clearToken, getToken } from '@/lib/auth';
import { apiClient } from '@/lib/api';

const NAV = [
  { href: '/account', icon: Home, label: 'خلاصه', exact: true },
  { href: '/account/orders', icon: Package, label: 'سفارش‌ها' },
  { href: '/account/profile', icon: User, label: 'مشخصات' },
  { href: '/account/addresses', icon: MapPin, label: 'آدرس‌ها' },
  { href: '/account/security', icon: Lock, label: 'امنیت و رمز' },
  { href: '/account/wishlist', icon: Heart, label: 'علاقه‌مندی' },
  { href: '/account/returns', icon: RefreshCcw, label: 'مرجوعی' },
];

function isPublicAccountPath(pathname: string) {
  return pathname === '/account' || pathname === '/account/forgot-password';
}

export function RetailAccountFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    const token = !!getToken();
    setLoggedIn(token);
    setReady(true);
    if (!token && pathname && !isPublicAccountPath(pathname)) {
      const next = `${pathname}${search.toString() ? `?${search.toString()}` : ''}`;
      router.replace(`/account?redirect=${encodeURIComponent(next)}`);
    }
  }, [pathname, router, search]);

  useEffect(() => {
    if (!loggedIn) return;
    apiClient
      .get<{ ownerName?: string; businessName?: string; phone?: string }>('/auth/me/profile')
      .then((me) => setName(me?.ownerName || me?.businessName || me?.phone || ''))
      .catch(() => undefined);
  }, [loggedIn]);

  if (!ready) {
    return <div className="py-16 text-center text-sm text-[var(--retail-muted)]">در حال بارگذاری حساب…</div>;
  }

  if (!loggedIn) return <>{children}</>;

  const logout = () => {
    clearToken();
    window.location.href = '/account';
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[var(--retail-gold)]">حساب مشتری</p>
          <h1 className="text-2xl font-extrabold">پنل من</h1>
          {name ? <p className="mt-1 text-sm text-[var(--retail-muted)]">{name}</p> : null}
        </div>
        <button type="button" className="text-sm font-bold text-red-600" onClick={logout}>
          خروج
        </button>
      </div>

      <nav className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="بخش‌های حساب">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${
                active ? 'bg-[var(--retail-primary)] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
