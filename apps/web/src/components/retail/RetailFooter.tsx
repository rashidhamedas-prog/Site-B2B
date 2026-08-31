'use client';

import Link from 'next/link';
import { chromeStr, useSiteChrome } from '@/lib/cms/useSiteChrome';
import { EnamadSeal } from '@/components/shared/EnamadSeal';
import { useRetailChrome } from '@/components/retail/RetailChromeProvider';

const COLS = [
  {
    title: 'فروشگاه',
    links: [
      { href: '/products', label: 'جدیدترین‌ها' },
      { href: '/collections', label: 'کلکسیون‌ها' },
      { href: '/products', label: 'مانتو' },
    ],
  },
  {
    title: 'خدمات',
    links: [
      { href: '/shipping', label: 'ارسال' },
      { href: '/returns', label: 'مرجوعی و تعویض' },
      { href: '/account', label: 'حساب کاربری' },
    ],
  },
  {
    title: 'ترنم',
    links: [
      { href: '/about', label: 'درباره ما' },
      { href: '/contact', label: 'تماس' },
      { href: 'https://poshaktaranom.com', label: 'سایت بوتیک‌داران' },
    ],
  },
];

export function RetailFooter() {
  const bag = useRetailChrome();
  const { chrome } = useSiteChrome('RETAIL', bag?.chrome ?? null);
  const brandName = chromeStr(chrome, 'brandName', 'POSHAK TARANOM');
  const blurb = chromeStr(
    chrome,
    'blurb',
    'فروشگاه آنلاین پوشاک زنانه — مستقیم از تولیدی مشهد.',
  );
  const copyright = chromeStr(
    chrome,
    'copyright',
    `© ${new Date().getFullYear()} پوشاک ترنم — www.poshaktaranom.ir`,
  );

  return (
    <footer className="mt-auto border-t border-[var(--retail-border)] bg-[var(--retail-primary-dark)] text-white">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
        <div>
          <p className="text-sm font-semibold tracking-[0.14em] text-[var(--retail-gold)]">
            {brandName}
          </p>
          {blurb ? (
            <p className="mt-3 text-sm leading-7 text-white/70">{blurb}</p>
          ) : null}
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <p className="mb-4 text-sm font-bold text-[var(--retail-gold)]">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map((l, i) => (
                <li key={`${col.title}-${i}`}>
                  <Link href={l.href} className="text-sm text-white/75 transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 py-4">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-center gap-3 px-4 sm:px-6 sm:flex-row sm:justify-between lg:px-8">
          <p className="text-center text-xs text-white/45">{copyright}</p>
          <EnamadSeal
            channel="RETAIL"
            size={72}
            className="opacity-95"
            config={bag ? bag.enamad : undefined}
          />
        </div>
      </div>
    </footer>
  );
}
