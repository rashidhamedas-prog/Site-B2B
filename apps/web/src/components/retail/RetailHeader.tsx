'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronDown, Menu, ShoppingBag, User, X } from 'lucide-react';
import { StorefrontSearch } from '@/components/shared/StorefrontSearch';
import { useRetailCart } from '@/lib/retail-cart';
import { RetailCartDrawer } from './RetailCartDrawer';
import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api';
import { NewsTicker } from '@/components/shared/NewsTicker';
import { useRetailChrome } from '@/components/retail/RetailChromeProvider';
import { isStorefrontHomePath, resolveTickerItems } from '@/lib/cms/news-ticker';

type Cat = { id: string; name: string; slug?: string };
type Collection = { id: string; name: string; slug: string };

const STATIC_NAV = [
  { href: '/', label: 'صفحه اصلی' },
  { href: '/products', label: 'جدیدترین‌ها' },
  { href: '/collections', label: 'کلکسیون' },
  { href: '/blog', label: 'وبلاگ' },
  { href: '/sales-partnership', label: 'همکار بازاریاب' },
  { href: '/about', label: 'درباره ما' },
  { href: '/contact', label: 'تماس با ما' },
];

/** Premium underline wipe — 21st underlined-nav pattern, gold token, logical origin for RTL. */
const NAV_UNDERLINE =
  "before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-[1.5px] before:[transform-origin:inline-start] before:scale-x-0 before:rounded-full before:bg-[var(--retail-gold)] before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.22,1,0.36,1)] before:content-[''] motion-reduce:before:transition-none";

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

function isNavActive(pathname: string, href: string) {
  const base = href.split('?')[0]!;
  return pathname === base || (base !== '/' && pathname.startsWith(base));
}

function RetailNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative inline-flex h-9 items-center px-0.5 text-[13px] font-medium tracking-wide',
        'text-[var(--retail-ink)]/65 transition-colors duration-200 ease-out',
        'hover:text-[var(--retail-ink)]',
        'focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] focus-visible:ring-offset-2',
        NAV_UNDERLINE,
        'hover:before:scale-x-100 focus-visible:before:scale-x-100',
        active && 'font-semibold text-[var(--retail-ink)] before:scale-x-100',
      )}
    >
      <span className="relative z-[1] transition-transform duration-200 ease-out group-hover:-translate-y-px motion-reduce:group-hover:translate-y-0">
        {label}
      </span>
    </Link>
  );
}

export function RetailHeader() {
  const pathname = usePathname();
  const bag = useRetailChrome();
  const tickerItems = resolveTickerItems(bag?.chrome.announcement, 'RETAIL');
  const showHomeTicker = isStorefrontHomePath(pathname) && tickerItems.length > 0;
  const [open, setOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const count = useRetailCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const categoryActive = pathname.startsWith('/products') || pathname.startsWith('/category');

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
      apiClient.get<Collection[]>('/collections?active=1&channel=RETAIL').catch(() => []),
    ]).then(([cats, cols]) => {
      const list = Array.isArray(cats) ? cats : (cats as { data?: Cat[] })?.data ?? [];
      setCategories(list.slice(0, 16));
      setCollections(Array.isArray(cols) ? cols.slice(0, 8) : []);
    });
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--retail-border)] bg-white">
        {showHomeTicker ? <NewsTicker items={tickerItems} /> : null}
        <div className="mx-auto flex h-[4.25rem] min-w-0 max-w-[1200px] items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-sm p-2 text-[var(--retail-ink)] transition-colors duration-200 hover:bg-[var(--retail-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] focus-visible:ring-offset-2 xl:hidden"
            aria-label="منو"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 rounded-sm sm:gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] focus-visible:ring-offset-2"
          >
            <BrandMark className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            <span className="truncate text-[13px] font-semibold tracking-[0.08em] text-[var(--retail-ink)] sm:tracking-[0.14em]">
              <span className="sm:hidden">ترنم</span>
              <span className="hidden sm:inline">POSHAK TARANOM</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-5 xl:flex" aria-label="منوی اصلی">
            {STATIC_NAV.slice(0, 2).map((item) => (
              <RetailNavLink
                key={item.label}
                href={item.href}
                label={item.label}
                active={isNavActive(pathname, item.href)}
              />
            ))}

            <div
              className="relative"
              onMouseEnter={() => setMegaOpen(true)}
              onMouseLeave={() => setMegaOpen(false)}
            >
              <button
                type="button"
                aria-expanded={megaOpen}
                aria-haspopup="true"
                className={cn(
                  'group relative inline-flex h-9 cursor-pointer items-center gap-1 px-0.5 text-[13px] font-medium tracking-wide',
                  'text-[var(--retail-ink)]/65 transition-colors duration-200 ease-out',
                  'hover:text-[var(--retail-ink)]',
                  'focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] focus-visible:ring-offset-2',
                  NAV_UNDERLINE,
                  'hover:before:scale-x-100 focus-visible:before:scale-x-100 data-[open=true]:before:scale-x-100',
                  (megaOpen || categoryActive) && 'font-semibold text-[var(--retail-ink)] before:scale-x-100',
                )}
                data-open={megaOpen ? 'true' : 'false'}
                onClick={() => setMegaOpen((v) => !v)}
              >
                <span className="relative z-[1] transition-transform duration-200 ease-out group-hover:-translate-y-px motion-reduce:group-hover:translate-y-0">
                  دسته‌بندی
                </span>
                <ChevronDown
                  className={cn(
                    'relative z-[1] h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                    megaOpen && 'rotate-180',
                  )}
                />
              </button>
              <div
                className={cn(
                  'absolute right-0 top-full z-50 w-[min(90vw,36rem)] origin-top pt-2 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
                  megaOpen
                    ? 'pointer-events-auto translate-y-0 opacity-100'
                    : 'pointer-events-none -translate-y-1 opacity-0',
                )}
              >
                <div className="rounded-2xl border border-[var(--retail-border)] bg-white p-5 shadow-xl">
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
                                className="text-sm font-semibold text-[var(--retail-ink)] transition-colors duration-150 hover:text-[var(--retail-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] focus-visible:ring-offset-2"
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
                          <Link
                            href="/collections"
                            className="text-sm font-semibold text-[var(--retail-ink)] transition-colors duration-150 hover:text-[var(--retail-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] focus-visible:ring-offset-2"
                            onClick={() => setMegaOpen(false)}
                          >
                            همه کالکشن‌ها
                          </Link>
                        </li>
                        {collections.map((c) => (
                          <li key={c.id}>
                            <Link
                              href={`/products?collectionId=${c.id}`}
                              className="text-sm font-semibold text-[var(--retail-ink)] transition-colors duration-150 hover:text-[var(--retail-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] focus-visible:ring-offset-2"
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
              </div>
            </div>

            {STATIC_NAV.slice(2).map((item) => (
              <RetailNavLink
                key={item.label}
                href={item.href}
                label={item.label}
                active={isNavActive(pathname, item.href)}
              />
            ))}
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-0.5 sm:gap-2">
            <StorefrontSearch
              channel="RETAIL"
              className="cursor-pointer rounded-sm p-2 text-[var(--retail-ink)] transition-colors duration-200 hover:bg-[var(--retail-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] focus-visible:ring-offset-2"
            />
            <Link
              href="/account"
              className="cursor-pointer rounded-sm p-2 text-[var(--retail-ink)] transition-colors duration-200 hover:bg-[var(--retail-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] focus-visible:ring-offset-2"
              aria-label="حساب"
            >
              <User className="h-5 w-5" strokeWidth={1.4} />
            </Link>
            <button
              type="button"
              className="relative cursor-pointer rounded-sm p-2 text-[var(--retail-ink)] transition-colors duration-200 hover:bg-[var(--retail-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] focus-visible:ring-offset-2"
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
              <button
                type="button"
                className="cursor-pointer rounded-sm p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)]"
                onClick={() => setOpen(false)}
                aria-label="بستن"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1" aria-label="منوی موبایل">
              {STATIC_NAV.map((item) => {
                const active = isNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      'rounded-lg px-3 py-2.5 text-base font-semibold transition-colors duration-150',
                      active
                        ? 'bg-[var(--retail-surface)] text-[var(--retail-primary)]'
                        : 'text-[var(--retail-ink)] hover:bg-[var(--retail-surface)]',
                    )}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <p className="px-3 pt-4 text-xs font-bold text-[var(--retail-muted)]">دسته‌ها</p>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/products?categoryId=${c.id}`}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--retail-ink)] transition-colors duration-150 hover:bg-[var(--retail-surface)]"
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
