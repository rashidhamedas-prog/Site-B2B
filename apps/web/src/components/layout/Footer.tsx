import Link from 'next/link';
import { Phone, MapPin, Send, Instagram } from 'lucide-react';

const quickLinks = [
  { href: '/products', label: 'محصولات' },
  { href: '/wholesale', label: 'شرایط عمده‌فروشی' },
  { href: '/about', label: 'درباره ما' },
  { href: '/blog', label: 'وبلاگ' },
  { href: '/contact', label: 'تماس با ما' },
];

const legalLinks = [
  { href: '/privacy', label: 'حریم خصوصی' },
  { href: '/terms', label: 'شرایط و قوانین' },
  { href: '/returns', label: 'شرایط مرجوعی' },
  { href: '/shipping', label: 'شرایط ارسال' },
];

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main footer */}
      <div className="container-site py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 p-1">
                <img src="/logo-128.png" alt="لوگوی پوشاک ترنم" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="text-white font-bold text-base">پوشاک ترنم</div>
                <div className="text-xs text-gray-400">تولیدی مانتو زنانه مشهد</div>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              از سال ۱۳۹۴ تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد. فروش عمده به بوتیک‌ها و
              فروشندگان در سراسر ایران.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://t.me/toliditaranom"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-secondary hover:text-white transition-colors"
                aria-label="تلگرام ترنم"
              >
                <Send className="h-4 w-4" />
              </a>
              <a
                href="https://instagram.com/tolidi.taranom"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-secondary hover:text-white transition-colors"
                aria-label="اینستاگرام ترنم"
              >
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-sm">دسترسی سریع</h3>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-secondary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-sm">اطلاعات حقوقی</h3>
            <ul className="space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-secondary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-sm">اطلاعات تماس</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5 text-sm text-gray-400">
                <Phone className="h-4 w-4 text-secondary flex-shrink-0 mt-0.5" />
                <div>
                  <a href="tel:09152424624" className="hover:text-secondary transition-colors block">
                    ۰۹۱۵-۲۴۲-۴۶۲۴
                  </a>
                  <span className="text-xs text-gray-500">حامد رشید — مدیر فروش</span>
                </div>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-400">
                <MapPin className="h-4 w-4 text-secondary flex-shrink-0 mt-0.5" />
                <div>
                  <p>دفتر پخش:</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    مشهد — میدان ۱۷ شهریور<br />
                    پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-site flex flex-col sm:flex-row items-center justify-between gap-3 py-4 text-xs text-gray-500">
          <p>© ۱۴۰۳ پوشاک ترنم — تمامی حقوق محفوظ است</p>
          <p>ساخته شده با ❤️ در مشهد</p>
        </div>
      </div>
    </footer>
  );
}
