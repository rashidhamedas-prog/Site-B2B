'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronDown, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useRetailCart } from '@/lib/retail-cart';
import { RetailCartDrawer } from './RetailCartDrawer';
import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api';

type Cat = { id: string; name: string; slug?: string };
type Collection = { id: string; name: string; slug: string };

const STATIC_NAV = [
  { href: '/', label: 'صفحه اصلی' },
  { href: '/products', label: 'جدیدترین‌ها' },
  { href: '/collections', label: 'کلکسیون' },
  { href: '/about', label: 'درباره ما' },
  { href: '/contact', label: 'تماس با ما' },
];

function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <path
        d="M20 4 L28 10 L32 20 L28 30 L20 36 L12 30 L8 20 L12 10 Z"
        stroke="#C9A84C"
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M20 12 L24 16 L20 28 L16 16 Z" fill="#C9A84C" opacity="0.85" />
    </svg>
  );
}

export function RetailHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const count = useRetailCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    // Capture affiliate click id for checkout
    try {
      const aff = new URLSearchParams(window.location.search).get('aff');
      if (aff) sessionStorage.setItem('taranom_aff', aff);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    Promise.all([
      apiClient.get<Cat[] | { data: Cat[] }>('/categories').catch(() => []),
      apiClient.get<Collection[]>('/collections?active=1').catch(() => []),
    ]).then(([cats, cols]) => {
      const list = Array.isArray(cats) ? cats : (cats as any)?.data ?? [];
      setCategories(list.slice(0, 16));
      setCollections(Array.isArray(cols) ? cols.slice(0, 8) : []);
    });
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--retail-border)] bg-white">
        <div className="mx-auto flex h-[4.25rem] max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="cursor-pointer p-2 text-[var(--retail-ink)] xl:hidden"
            aria-label="منو"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="h-9 w-9" />
            <span className="text-[13px] font-semibold tracking-[0.14em] text-[var(--retail-ink)]">
              POSHAK TARANOM
            </span>
          </Link>

          <nav className="hidden items-center gap-6 xl:flex">
            {STATIC_NAV.slice(0, 2).map((item) => {
              const base = item.href.split('?')[0]!;
              const active = pathname === base || (base !== '/' && pathname.startsWith(base));
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    'relative text-[13px] font-medium transition',
                    active ? 'text-[var(--retail-ink)]' : 'text-[var(--retail-ink)]/70 hover:text-[var(--retail-ink)]',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <div
              className="relative"
              onMouseEnter={() => setMegaOpen(true)}
              onMouseLeave={() => setMegaOpen(false)}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--retail-ink)]/70 hover:text-[var(--retail-ink)]"
              >
                دسته‌بندی
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {megaOpen ? (
                <div className="absolute right-0 top-full z-50 w-[min(90vw,36rem)] rounded-2xl border border-[var(--retail-border)] bg-white p-5 shadow-xl">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="mb-3 text-xs font-bold text-[var(--retail-muted)]">دسته‌ها</p>
                      <ul className="space-y-2">
                        {categories.length === 0 ? (
                          <li className="text-sm text-[var(--retail-muted)]">در حال بارگذاری…</li>
                        ) : (
                          categories.map((c) => (
                            <li key={c.id}>
                              <Link
                                href={`/products?categoryId=${c.id}`}
                                className="text-sm font-semibold hover:text-[var(--retail-primary)]"
                                onClick={() => setMegaOpen(false)}
                              >
                                {c.name}
                              </Link>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-3 text-xs font-bold text-[var(--retail-muted)]">کالکشن‌ها</p>
                      <ul className="space-y-2">
                        <li>
                          <Link href="/collections" className="text-sm font-semibold hover:text-[var(--retail-primary)]">
                            همه کالکشن‌ها
                          </Link>
                        </li>
                        {collections.map((c) => (
                          <li key={c.id}>
                            <Link
                              href={`/products?collectionId=${c.id}`}
                              className="text-sm font-semibold hover:text-[var(--retail-primary)]"
                              onClick={() => setMegaOpen(false)}
                            >
                              {c.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {STATIC_NAV.slice(2).map((item) => {
              const base = item.href.split('?')[0]!;
              const active = pathname === base || (base !== '/' && pathname.startsWith(base));
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    'relative text-[13px] font-medium transition',
                    active ? 'text-[var(--retail-ink)]' : 'text-[var(--retail-ink)]/70 hover:text-[var(--retail-ink)]',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/products" className="cursor-pointer p-2 text-[var(--retail-ink)]" aria-label="جستجو">
              <Search className="h-5 w-5" strokeWidth={1.4} />
            </Link>
            <Link href="/account" className="cursor-pointer p-2 text-[var(--retail-ink)]" aria-label="حساب">
              <User className="h-5 w-5" strokeWidth={1.4} />
            </Link>
            <button
              type="button"
              className="relative cursor-pointer p-2 text-[var(--retail-ink)]"
              aria-label="سبد"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.4} />
              {mounted && count > 0 && (
                <span className="absolute left-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--retail-gold)] px-1 text-[10px] font-bold text-white">
                  {count > 9 ? '۹+' : count.toLocaleString('fa-IR')}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="بستن" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(100%,20rem)] flex-col overflow-y-auto bg-white p-6 shadow-xl">
            <div className="mb-8 flex items-center justify-between">
              <span className="font-bold">منو</span>
              <button type="button" className="cursor-pointer p-2" onClick={() => setOpen(false)} aria-label="بستن">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-4">
              {STATIC_NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-base font-semibold"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <p className="pt-2 text-xs font-bold text-[var(--retail-muted)]">دسته‌ها</p>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/products?categoryId=${c.id}`}
                  className="text-sm font-semibold"
                  onClick={() => setOpen(false)}
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      <RetailCartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
