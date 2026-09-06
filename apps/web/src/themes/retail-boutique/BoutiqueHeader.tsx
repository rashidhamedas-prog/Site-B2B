'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronDown, Menu, ShoppingBag, X } from 'lucide-react';
import { StorefrontSearch } from '@/components/shared/StorefrontSearch';
import { useRetailCart } from '@/lib/retail-cart';
import { chromeStr, useSiteChrome } from '@/lib/cms/useSiteChrome';
import { useRetailChrome } from '@/components/retail/RetailChromeProvider';
import { RetailCartDrawer } from '@/components/retail/RetailCartDrawer';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

type Cat = { id: string; name: string; slug?: string };

const PRIMARY_NAV = [
  { href: '/products', label: 'جدیدترین‌ها' },
  { href: '/collections', label: 'کلکسیون' },
  { href: '/blog', label: 'وبلاگ' },
  { href: '/about', label: 'درباره ما' },
];

export function BoutiqueHeader() {
  const pathname = usePathname();
  const bag = useRetailChrome();
  const { announcement, chrome } = useSiteChrome('RETAIL', bag?.chrome ?? null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState<Cat[]>([]);
  const count = useRetailCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const brandName = chromeStr(chrome, 'brandName', 'پوشاک ترنم');
  const showAnn = announcement?.enabled !== false && Boolean(announcement?.text);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    apiClient
      .get<Cat[] | { data: Cat[] }>('/categories')
      .then((cats) => {
        const list = Array.isArray(cats) ? cats : cats?.data ?? [];
        setCategories(list.slice(0, 16));
      })
      .catch(() => setCategories([]));
  }, []);

  return (
    <>
      <a
        href="#retail-main"
        className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-2 focus:z-[90] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-neutral-900"
      >
        رفتن به محتوا
      </a>
      {showAnn ? (
        <div className="bg-gradient-to-l from-[#0b0f0e] to-[#1b5c4a] px-4 py-2 text-center text-xs text-white sm:text-sm">
          {announcement?.text}
        </div>
      ) : null}
      <header className="sticky top-0 z-40 bg-[#0b0f0e] text-white">
        <div className="bq-container flex h-[4.25rem] min-w-0 items-center gap-3">
          <button
            type="button"
            className="shrink-0 p-2 lg:hidden"
            aria-label="منو"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="shrink-0 text-sm font-extrabold tracking-wide sm:text-base">
            {brandName}
          </Link>
          <StorefrontSearch
            channel="RETAIL"
            variant="inline"
            placeholder="جستجوی مانتو، شومیز و کت ترنم"
            className="hidden min-w-0 flex-1 sm:block"
          />
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <Link
              href="/account"
              className="inline-flex min-h-11 items-center rounded-full bg-[#1b5c4a] px-4 text-sm font-bold text-white"
            >
              ورود / ثبت‌نام
            </Link>
            <button
              type="button"
              className="relative p-2"
              aria-label="سبد خرید"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag className="h-5 w-5" />
              {mounted && count > 0 ? (
                <span className="absolute left-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c9a84c] px-1 text-[10px] font-bold text-neutral-900">
                  {count > 9 ? '۹+' : count.toLocaleString('fa-IR')}
                </span>
              ) : null}
            </button>
          </div>
        </div>
        <div className="hidden border-t border-white/10 lg:block">
          <nav className="bq-container flex h-12 items-center gap-6 text-sm" aria-label="دسته‌بندی فروشگاه">
            <div
              className="relative"
              onMouseEnter={() => setMegaOpen(true)}
              onMouseLeave={() => setMegaOpen(false)}
            >
              <button type="button" className="inline-flex items-center gap-1 font-bold">
                دسته‌بندی کالاها
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {megaOpen ? (
                <div className="absolute right-0 top-full z-50 w-[min(90vw,22rem)] rounded-2xl bg-white p-4 text-neutral-900 shadow-xl">
                  <p className="mb-2 text-xs font-bold text-neutral-500">دسته‌های ترنم</p>
                  <ul className="space-y-1">
                    {categories.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={c.slug ? `/category/${c.slug}` : `/products?categoryId=${c.id}`}
                          className="block rounded-lg px-2 py-2 text-sm font-semibold hover:bg-neutral-50"
                          onClick={() => setMegaOpen(false)}
                        >
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <Link href="/products" className="font-bold text-[#c9a84c]">
              شگفت‌انگیزها
            </Link>
            {PRIMARY_NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn('text-white/80 hover:text-white', active && 'text-white')}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="bq-container pb-3 sm:hidden">
          <StorefrontSearch
            channel="RETAIL"
            variant="inline"
            placeholder="جستجوی مانتو و شومیز"
          />
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="بستن منو" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(100%,20rem)] flex-col overflow-y-auto bg-[#0b0f0e] p-6 text-white">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-bold">منو</span>
              <button type="button" className="p-2" onClick={() => setMenuOpen(false)} aria-label="بستن">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-3">
              <Link href="/products" onClick={() => setMenuOpen(false)} className="font-bold text-[#c9a84c]">
                شگفت‌انگیزها
              </Link>
              {PRIMARY_NAV.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="font-semibold">
                  {item.label}
                </Link>
              ))}
              <p className="pt-3 text-xs text-white/50">دسته‌ها</p>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={c.slug ? `/category/${c.slug}` : `/products?categoryId=${c.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="text-sm"
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <RetailCartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
