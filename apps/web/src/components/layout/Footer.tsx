'use client';

import Link from 'next/link';
import { Phone, MapPin, Send, Instagram } from 'lucide-react';
import { useMenus } from '@/lib/hooks/useMenus';
import { DEFAULT_MENUS } from '@/lib/menus';

export function Footer() {
  const { menus } = useMenus();
  const quickLinks = menus.footer?.length ? menus.footer : DEFAULT_MENUS.footer;
  const legalLinks = menus.legal?.length ? menus.legal : DEFAULT_MENUS.legal;

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
                <img src="/logo-128.png" alt="لوگوی پوشاک ترنم" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="text-base font-bold text-white">پوشاک ترنم</div>
                <div className="text-xs text-white/50">تولیدی مانتو زنانه مشهد</div>
              </div>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-white/55">
              از سال ۱۳۹۴ تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد. فروش عمده به بوتیک‌ها و
              فروشندگان در سراسر ایران.
            </p>
            <div className="flex items-center gap-2.5">
              <a
                href="https://t.me/toliditaranom"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-white transition-colors duration-200 hover:bg-secondary"
                aria-label="تلگرام ترنم"
              >
                <Send className="h-4 w-4" />
              </a>
              <a
                href="https://instagram.com/tolidi.taranom"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/10 text-white transition-colors duration-200 hover:bg-secondary"
                aria-label="اینستاگرام ترنم"
              >
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-white">دسترسی سریع</h3>
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
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-white">اطلاعات حقوقی</h3>
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
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-white">اطلاعات تماس</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-2.5 text-sm text-white/55">
                <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary" />
                <div>
                  <a
                    href="tel:09152424624"
                    className="block cursor-pointer transition-colors duration-200 hover:text-secondary"
                  >
                    ۰۹۱۵-۲۴۲-۴۶۲۴
                  </a>
                  <span className="text-xs text-white/40">حامد رشید — مدیر فروش</span>
                </div>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-white/55">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary" />
                <div>
                  <p>دفتر پخش:</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/40">
                    مشهد — میدان ۱۷ شهریور
                    <br />
                    پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

          <div className="relative border-t border-white/10">
        <div className="container-site flex flex-col items-center justify-between gap-3 py-5 text-xs text-white/40 sm:flex-row">
          <p>© ۱۴۰۳ پوشاک ترنم — تمامی حقوق محفوظ است</p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>تولید و طراحی در مشهد</span>
            <a
              href="https://www.poshaktaranom.ir"
              className="cursor-pointer text-secondary transition-colors hover:text-white"
            >
              فروشگاه خرید تکی
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
