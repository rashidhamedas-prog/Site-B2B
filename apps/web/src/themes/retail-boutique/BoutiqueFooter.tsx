'use client';

import Link from 'next/link';
import { chromeStr, useSiteChrome } from '@/lib/cms/useSiteChrome';
import { EnamadSeal } from '@/components/shared/EnamadSeal';
import { useRetailChrome } from '@/components/retail/RetailChromeProvider';

const COLS = [
  {
    title: 'فروشگاه',
    links: [
      { href: '/category/shomiz', label: 'شومیز زنانه' },
      { href: '/category/women-coats', label: 'کت زنانه' },
      { href: '/category/winter-wear', label: 'کاپشن زنانه' },
      { href: '/category/kaftan', label: 'کفتان زنانه' },
      { href: '/products', label: 'همه محصولات' },
    ],
  },
  {
    title: 'خرید',
    links: [
      { href: '/shipping', label: 'ارسال' },
      { href: '/returns', label: 'مرجوعی و تعویض' },
      { href: '/account', label: 'حساب کاربری' },
      { href: '/checkout', label: 'سبد و پرداخت' },
    ],
  },
  {
    title: 'ترنم',
    links: [
      { href: '/about', label: 'درباره ما' },
      { href: '/contact', label: 'تماس' },
      { href: '/blog', label: 'وبلاگ' },
      { href: 'https://poshaktaranom.com', label: 'سایت بوتیک‌داران' },
    ],
  },
];

export function BoutiqueFooter() {
  const bag = useRetailChrome();
  const { chrome } = useSiteChrome('RETAIL', bag?.chrome ?? null);
  const brandName = chromeStr(chrome, 'brandName', 'پوشاک ترنم');
  const blurb = chromeStr(
    chrome,
    'blurb',
    'خرید تکی از کارگاه ترنم در مشهد؛ همان تولیدی که برای بوتیک‌ها هم می‌دوزد.',
  );
  const copyright = chromeStr(
    chrome,
    'copyright',
    `© ${new Date().getFullYear()} پوشاک ترنم — www.poshaktaranom.ir`,
  );
  const phone = chromeStr(chrome, 'phoneLabel', '۰۹۱۵-۲۴۲-۴۶۲۴');
  const phoneHref = chromeStr(chrome, 'phoneHref', 'tel:09152424624');

  return (
    <footer className="mt-auto border-t border-white/10 bg-[#0b0f0e] text-white">
      <div className="bq-container grid gap-10 py-14 md:grid-cols-4">
        <div>
          <p className="text-sm font-extrabold tracking-wide text-[#c9a84c]">{brandName}</p>
          <p className="mt-3 text-sm leading-7 text-white/70">{blurb}</p>
          <a href={phoneHref} className="mt-4 inline-block text-sm font-bold text-white">
            {phone}
          </a>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <p className="mb-4 text-sm font-bold text-[#c9a84c]">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/75 hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 py-4">
        <div className="bq-container flex flex-col items-center justify-between gap-3 sm:flex-row">
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
