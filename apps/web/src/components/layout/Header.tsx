import Link from 'next/link';
import { User, Phone, Search } from 'lucide-react';
import { Button } from '@/components/ui';
import { MobileMenuButton } from './MobileMenu';
import { CartBadge } from './CartBadge';

const navLinks = [
  { href: '/products', label: 'محصولات' },
  { href: '/about', label: 'درباره ترنم' },
  { href: '/wholesale', label: 'شرایط عمده' },
  { href: '/blog', label: 'وبلاگ' },
  { href: '/contact', label: 'تماس با ما' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      {/* Top bar */}
      <div className="bg-primary text-white">
        <div className="container-site flex items-center justify-between py-1.5 text-xs">
          <div className="flex items-center gap-4">
            <a href="tel:09152424624" className="flex items-center gap-1.5 hover:text-secondary transition-colors">
              <Phone className="h-3 w-3" />
              <span>۰۹۱۵-۲۴۲-۴۶۲۴</span>
            </a>
            <span className="hidden sm:inline text-white/60">|</span>
            <a
              href="https://t.me/toliditaranom"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline hover:text-secondary transition-colors"
            >
              @toliditaranom کانال تلگرام
            </a>
          </div>
          <p className="hidden md:block text-white/80">
            ارسال به سراسر ایران — حداقل سفارش ۵ عدد
          </p>
        </div>
      </div>

      {/* Main nav */}
      <div className="container-site">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo-128.png"
              alt="لوگوی پوشاک ترنم"
              className="h-11 w-11 object-contain group-hover:scale-105 transition-transform"
            />
            <div className="leading-tight">
              <div className="text-base font-bold text-primary">پوشاک ترنم</div>
              <div className="text-xs text-gray-400">تولیدی مانتو زنانه</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-primary hover:bg-primary-50 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary transition-colors" aria-label="جستجو">
              <Search className="h-5 w-5" />
            </button>

            <Link
              href="/portal"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary transition-colors"
              aria-label="پنل مشتری"
            >
              <User className="h-5 w-5" />
            </Link>

            <CartBadge />

            <Link href="/portal/register" className="hidden sm:flex">
              <Button variant="primary" size="sm">ثبت‌نام عمده‌فروش</Button>
            </Link>

            <MobileMenuButton />
          </div>
        </div>
      </div>
    </header>
  );
}
