'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui';

const navLinks = [
  { href: '/products', label: 'محصولات' },
  { href: '/about', label: 'درباره ترنم' },
  { href: '/wholesale', label: 'شرایط عمده' },
  { href: '/blog', label: 'وبلاگ' },
  { href: '/contact', label: 'تماس با ما' },
];

export function MobileMenuButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'بستن منو' : 'باز کردن منو'}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="lg:hidden fixed top-[108px] inset-x-0 border-t border-gray-100 bg-white animate-slide-down z-40 shadow-lg">
          <nav className="container-site py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:text-primary hover:bg-primary-50 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-gray-100 mt-3">
              <Link href="/portal/register" onClick={() => setOpen(false)}>
                <Button variant="primary" fullWidth>ثبت‌نام عمده‌فروش</Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
