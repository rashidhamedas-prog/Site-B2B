'use client';

import Link from 'next/link';
import { User, Phone } from 'lucide-react';
import { StorefrontSearch } from '@/components/shared/StorefrontSearch';
import { Button } from '@/components/ui';
import { MobileMenuButton } from './MobileMenu';
import { CartBadge } from './CartBadge';
import { MegaNav } from './MegaNav';
import { useMenus } from '@/lib/hooks/useMenus';
import { DEFAULT_MENUS } from '@/lib/menus';
import { chromeStr, useSiteChrome } from '@/lib/cms/useSiteChrome';
import { useWholesaleChrome } from '@/components/wholesale/WholesaleChromeProvider';

export function Header() {
  const bag = useWholesaleChrome();
  const { menus } = useMenus(
    bag ? { initial: bag.menus, skipNetwork: true } : undefined,
  );
  const main = menus.main?.length ? menus.main : DEFAULT_MENUS.main;
  const { announcement, chrome } = useSiteChrome('WHOLESALE', bag?.chrome ?? null);

  const brandName = chromeStr(chrome, 'brandName', 'پوشاک ترنم');
  const brandTagline = chromeStr(chrome, 'brandTagline', 'تولیدی مانتو زنانه مشهد');
  const logoUrl = chromeStr(chrome, 'logoUrl', '/logo-128.png');
  // Relative CMS paths only — a header <img> is auto-preloaded by React 19
  // ahead of the LCP hero even with loading=lazy / fetchPriority=low.
  const logoHref =
    logoUrl.startsWith('/') && !logoUrl.startsWith('//') && !/[\s"'()\\]/.test(logoUrl)
      ? logoUrl
      : '/logo-128.png';
  const registerLabel = chromeStr(chrome, 'registerLabel', 'ثبت‌نام عمده‌فروش');
  const registerHref = chromeStr(chrome, 'registerHref', '/portal/register');
  const portalHref = chromeStr(chrome, 'portalHref', '/portal');

  const showAnn = announcement?.enabled !== false;
  const phoneLabel = announcement?.phoneLabel || chromeStr(chrome, 'phoneLabel', '۰۹۱۵-۲۴۲-۴۶۲۴');
  const phoneHref = announcement?.phoneHref || chromeStr(chrome, 'phoneHref', 'tel:09152424624');
  const telegramLabel = announcement?.telegramLabel || '@toliditaranom کانال تلگرام';
  const telegramHref =
    announcement?.telegramHref || chromeStr(chrome, 'telegramHref', 'https://t.me/toliditaranom');
  const annText =
    announcement?.text || 'ارسال به سراسر ایران — حداقل سفارش در محصول از 6 عدد به بالا می باشد.';

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-white/90 backdrop-blur-xl">
      {showAnn ? (
        <div className="bg-primary-dark text-white">
          <div className="container-site flex items-center justify-between py-1.5 text-xs">
            <div className="flex items-center gap-4">
              {phoneLabel ? (
                <a
                  href={phoneHref || undefined}
                  className="flex cursor-pointer items-center gap-1.5 transition-colors duration-200 hover:text-secondary"
                >
                  <Phone className="h-3 w-3" />
                  <span>{phoneLabel}</span>
                </a>
              ) : null}
              {telegramLabel ? (
                <>
                  <span className="hidden text-white/40 sm:inline">|</span>
                  <a
                    href={telegramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden cursor-pointer transition-colors duration-200 hover:text-secondary sm:inline"
                  >
                    {telegramLabel}
                  </a>
                </>
              ) : null}
            </div>
            {annText ? <p className="hidden text-white/70 md:block">{annText}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="container-site">
        <div className="flex h-[4.25rem] items-center justify-between">
          <Link href="/" className="group flex cursor-pointer items-center gap-3">
            <span
              role="img"
              aria-label={`لوگوی ${brandName}`}
              className="h-12 w-12 shrink-0 bg-contain bg-center bg-no-repeat transition-transform duration-250 group-hover:scale-[1.03]"
              style={{ backgroundImage: `url("${logoHref}")` }}
            />
            <div className="leading-tight">
              <div className="text-lg font-extrabold tracking-tight text-primary">{brandName}</div>
              {brandTagline ? (
                <div className="text-[11px] font-medium text-gray-400">{brandTagline}</div>
              ) : null}
            </div>
          </Link>

          <MegaNav items={main} megaEnabled={menus.megaEnabled !== false} />

          <div className="flex items-center gap-1.5">
            <StorefrontSearch
              channel="WHOLESALE"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-200 hover:bg-surface-muted hover:text-primary"
            />

            <Link
              href={portalHref}
              className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-200 hover:bg-surface-muted hover:text-primary sm:flex"
              aria-label="پنل مشتری"
            >
              <User className="h-5 w-5" />
            </Link>

            <CartBadge />

            {registerLabel ? (
              <Link href={registerHref} className="hidden cursor-pointer sm:flex">
                <Button variant="primary" size="sm">
                  {registerLabel}
                </Button>
              </Link>
            ) : null}

            <MobileMenuButton items={menus.mobile?.length ? menus.mobile : main} />
          </div>
        </div>
      </div>
    </header>
  );
}
