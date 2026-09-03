'use client';

import Link from 'next/link';
import { Phone, MapPin, Send, Instagram } from 'lucide-react';
import { useMenus } from '@/lib/hooks/useMenus';
import { DEFAULT_MENUS } from '@/lib/menus';
import { chromeLines, chromeStr, useSiteChrome } from '@/lib/cms/useSiteChrome';
import { EnamadSeal } from '@/components/shared/EnamadSeal';
import { useWholesaleChrome } from '@/components/wholesale/WholesaleChromeProvider';

export function Footer() {
  const bag = useWholesaleChrome();
  const { menus } = useMenus(
    bag ? { initial: bag.menus, skipNetwork: true } : undefined,
  );
  const quickLinks = menus.footer?.length ? menus.footer : DEFAULT_MENUS.footer;
  const legalLinks = menus.legal?.length ? menus.legal : DEFAULT_MENUS.legal;
  const { chrome } = useSiteChrome('WHOLESALE', bag?.chrome ?? null);

  const brandName = chromeStr(chrome, 'brandName', 'پوشاک ترنم');
  const brandTagline = chromeStr(chrome, 'brandTagline', 'تولیدی مانتو زنانه مشهد');
  const logoUrl = chromeStr(chrome, 'logoUrl', '/logo-128.png');
  const logoHref =
    logoUrl.startsWith('/') && !logoUrl.startsWith('//') && !/[\s"'()\\]/.test(logoUrl)
      ? logoUrl
      : '/logo-128.png';
  const blurb = chromeStr(
    chrome,
    'blurb',
    'از سال ۱۳۹۴ تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد. فروش عمده به بوتیک‌ها و فروشندگان در سراسر ایران.',
  );
  const telegramHref = chromeStr(chrome, 'telegramHref', 'https://t.me/toliditaranom');
  const instagramHref = chromeStr(chrome, 'instagramHref', 'https://instagram.com/tolidi.taranom');
  const quickTitle = chromeStr(chrome, 'footerQuickTitle', 'دسترسی سریع');
  const legalTitle = chromeStr(chrome, 'footerLegalTitle', 'اطلاعات حقوقی');
  const contactTitle = chromeStr(chrome, 'footerContactTitle', 'اطلاعات تماس');
  const phoneLabel = chromeStr(chrome, 'phoneLabel', '۰۹۱۵-۲۴۲-۴۶۲۴');
  const phoneHref = chromeStr(chrome, 'phoneHref', 'tel:09152424624');
  const ownerLabel = chromeStr(chrome, 'ownerLabel', 'حامد رشید — مدیر فروش');
  const addressTitle = chromeStr(chrome, 'addressTitle', 'دفتر پخش:');
  const addressLines = chromeLines(chrome).length
    ? chromeLines(chrome)
    : ['مشهد — میدان ۱۷ شهریور', 'پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳'];
  const copyright = chromeStr(chrome, 'copyright', '© ۱۴۰۳ پوشاک ترنم — تمامی حقوق محفوظ است');
  const madeInLabel = chromeStr(chrome, 'madeInLabel', 'تولید و طراحی در مشهد');
  const retailStoreLabel = chromeStr(chrome, 'retailStoreLabel', 'فروشگاه خرید تکی');
  const retailStoreHref = chromeStr(chrome, 'retailStoreHref', 'https://www.poshaktaranom.ir');

  return (
    <footer className="relative overflow-hidden bg-primary-dark text-gray-300">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 90% 0%, rgba(201,168,76,0.15), transparent 55%)',
        }}
      />

      <div className="container-site relative py-14 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="lg:col-span-1">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 p-1">
                <span
                  role="img"
                  aria-label={`لوگوی ${brandName}`}
                  className="h-full w-full bg-contain bg-center bg-no-repeat"
                  style={{ backgroundImage: `url("${logoHref}")` }}
                />
              </div>
              <div>
                <div className="text-base font-bold text-white">{brandName}</div>
                {brandTagline ? <div className="text-xs text-white/50">{brandTagline}</div> : null}
              </div>
            </div>
            {blurb ? (
              <p className="mb-5 text-sm leading-relaxed text-white/55">{blurb}</p>
            ) : null}
            <div className="flex items-center gap-2.5">
              {telegramHref ? (
                <a
                  href={telegramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-white transition-colors duration-200 hover:bg-secondary"
                  aria-label="تلگرام"
                >
                  <Send className="h-4 w-4" />
                </a>
              ) : null}
              {instagramHref ? (
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-white transition-colors duration-200 hover:bg-secondary"
                  aria-label="اینستاگرام"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-white">{quickTitle}</h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    className="cursor-pointer text-sm text-white/55 transition-colors duration-200 hover:text-secondary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-white">{legalTitle}</h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    className="cursor-pointer text-sm text-white/55 transition-colors duration-200 hover:text-secondary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-white">{contactTitle}</h3>
            <ul className="space-y-4">
              {phoneLabel ? (
                <li className="flex items-start gap-2.5 text-sm text-white/55">
                  <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary" />
                  <div>
                    <a
                      href={phoneHref || undefined}
                      className="block cursor-pointer transition-colors duration-200 hover:text-secondary"
                    >
                      {phoneLabel}
                    </a>
                    {ownerLabel ? (
                      <span className="text-xs text-white/40">{ownerLabel}</span>
                    ) : null}
                  </div>
                </li>
              ) : null}
              {addressLines.length > 0 ? (
                <li className="flex items-start gap-2.5 text-sm text-white/55">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary" />
                  <div>
                    {addressTitle ? <p>{addressTitle}</p> : null}
                    <p className="mt-0.5 text-xs leading-relaxed text-white/40">
                      {addressLines.map((line, i) => (
                        <span key={i}>
                          {i > 0 ? <br /> : null}
                          {line}
                        </span>
                      ))}
                    </p>
                  </div>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="container-site flex flex-col items-center justify-between gap-4 py-5 text-xs text-white/40 sm:flex-row">
          <p>{copyright}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <EnamadSeal
              channel="WHOLESALE"
              size={72}
              className="opacity-95"
              config={bag ? bag.enamad : undefined}
            />
            <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              {madeInLabel ? <span>{madeInLabel}</span> : null}
              {retailStoreLabel && retailStoreHref ? (
                <a
                  href={retailStoreHref}
                  className="cursor-pointer text-secondary transition-colors hover:text-white"
                >
                  {retailStoreLabel}
                </a>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
