'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart';

export function CartBadge() {
  const { count } = useCart();
  return (
    <Link href="/checkout"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary transition-colors"
      aria-label="سبد خرید">
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-white text-[10px] font-bold">
          {count > 9 ? '۹+' : count.toLocaleString('fa-IR')}
        </span>
      )}
    </Link>
  );
}
