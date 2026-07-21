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
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-200 hover:bg-surface-muted lg:hidden"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'بستن منو' : 'باز کردن منو'}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed inset-x-0 top-[108px] z-40 animate-slide-down border-t border-[color:var(--color-border)] bg-white/95 shadow-lg backdrop-blur-xl lg:hidden">
          <nav className="container-site space-y-1 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex cursor-pointer items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-primary-50 hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 border-t border-gray-100 pt-3">
              <Link href="/portal/register" onClick={() => setOpen(false)} className="cursor-pointer">
                <Button variant="primary" fullWidth>
                  ثبت‌نام عمده‌فروش
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
