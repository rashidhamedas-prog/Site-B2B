'use client';

import Link from 'next/link';
import { User, Phone, Search } from 'lucide-react';
import { Button } from '@/components/ui';
import { MobileMenuButton } from './MobileMenu';
import { CartBadge } from './CartBadge';
import { MegaNav } from './MegaNav';
import { useMenus } from '@/lib/hooks/useMenus';
import { DEFAULT_MENUS } from '@/lib/menus';

export function Header() {
  const { menus } = useMenus();
  const main = menus.main?.length ? menus.main : DEFAULT_MENUS.main;

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-white/90 backdrop-blur-xl">
      <div className="bg-primary-dark text-white">
        <div className="container-site flex items-center justify-between py-1.5 text-xs">
          <div className="flex items-center gap-4">
            <a
              href="tel:09152424624"
              className="flex cursor-pointer items-center gap-1.5 transition-colors duration-200 hover:text-secondary"
            >
              <Phone className="h-3 w-3" />
              <span>۰۹۱۵-۲۴۲-۴۶۲۴</span>
            </a>
            <span className="hidden text-white/40 sm:inline">|</span>
            <a
              href="https://t.me/toliditaranom"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden cursor-pointer transition-colors duration-200 hover:text-secondary sm:inline"
            >
              @toliditaranom کانال تلگرام
            </a>
          </div>
          <p className="hidden text-white/70 md:block">ارسال به سراسر ایران — حداقل سفارش ۵ عدد</p>
        </div>
      </div>

      <div className="container-site">
        <div className="flex h-[4.25rem] items-center justify-between">
          <Link href="/" className="group flex cursor-pointer items-center gap-3">
            <img
              src="/logo-128.png"
              alt="لوگوی پوشاک ترنم"
              className="h-12 w-12 object-contain transition-transform duration-250 group-hover:scale-[1.03]"
            />
            <div className="leading-tight">
              <div className="text-lg font-extrabold tracking-tight text-primary">پوشاک ترنم</div>
              <div className="text-[11px] font-medium text-gray-400">تولیدی مانتو زنانه مشهد</div>
            </div>
          </Link>

          <MegaNav items={main} megaEnabled={menus.megaEnabled !== false} />

          <div className="flex items-center gap-1.5">
            <button
              className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-200 hover:bg-surface-muted hover:text-primary sm:flex"
              aria-label="جستجو"
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              href="/portal"
              className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-200 hover:bg-surface-muted hover:text-primary sm:flex"
              aria-label="پنل مشتری"
            >
              <User className="h-5 w-5" />
            </Link>

            <CartBadge />

            <Link href="/portal/register" className="hidden cursor-pointer sm:flex">
              <Button variant="primary" size="sm">
                ثبت‌نام عمده‌فروش
              </Button>
            </Link>

            <MobileMenuButton items={menus.mobile?.length ? menus.mobile : main} />
          </div>
        </div>
      </div>
    </header>
  );
}
