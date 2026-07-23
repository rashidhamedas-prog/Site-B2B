'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useRetailCart } from '@/lib/retail-cart';
import { RetailCartDrawer } from './RetailCartDrawer';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/retail', label: 'صفحه اصلی' },
  { href: '/retail/products', label: 'جدیدترین‌ها' },
  { href: '/retail/products?q=شومیز', label: 'شومیز' },
  { href: '/retail/products?q=مانتو', label: 'مانتو' },
  { href: '/retail/products', label: 'پوشاک' },
  { href: '/retail/collections', label: 'اکسسوری' },
  { href: '/retail/about', label: 'درباره ما' },
  { href: '/retail/contact', label: 'تماس با ما' },
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
  const [cartOpen, setCartOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const count = useRetailCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));

  useEffect(() => setMounted(true), []);

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

          <Link href="/retail" className="flex items-center gap-2.5">
            <BrandMark className="h-9 w-9" />
            <span className="text-[13px] font-semibold tracking-[0.14em] text-[var(--retail-ink)]">
              POSHAK TARANOM
            </span>
          </Link>

          <nav className="hidden items-center gap-6 xl:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== '/retail' && pathname.startsWith(item.href.split('?')[0]!));
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
                  {item.href === '/retail' && pathname === '/retail' ? (
                    <span className="absolute -bottom-1 right-0 left-0 mx-auto h-px w-full bg-[var(--retail-gold)]" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/retail/products" className="cursor-pointer p-2 text-[var(--retail-ink)]" aria-label="جستجو">
              <Search className="h-5 w-5" strokeWidth={1.4} />
            </Link>
            <Link href="/retail/account" className="cursor-pointer p-2 text-[var(--retail-ink)]" aria-label="حساب">
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
          <div className="absolute inset-y-0 right-0 flex w-[min(100%,20rem)] flex-col bg-white p-6 shadow-xl">
            <div className="mb-8 flex items-center justify-between">
              <span className="font-bold">منو</span>
              <button type="button" className="cursor-pointer p-2" onClick={() => setOpen(false)} aria-label="بستن">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-4">
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-base font-semibold"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
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
