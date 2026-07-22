'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { MenuItem } from '@/lib/menus';

/** Glass mega menu inspired by 21st Rich Navigation, adapted to Soft UI brand. */
export function MegaNav({ items, megaEnabled }: { items: MenuItem[]; megaEnabled: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <nav className="hidden items-center gap-0.5 lg:flex" onMouseLeave={() => setOpenId(null)}>
      {items.map((link) => {
        const hasMega = megaEnabled && (link.children?.length ?? 0) > 0;

        if (link.highlight) {
          return (
            <Link
              key={link.id}
              href={link.href}
              className="ms-1 cursor-pointer rounded-lg bg-secondary px-3.5 py-2 text-sm font-bold text-white shadow-sm transition-colors duration-200 hover:bg-secondary-light"
            >
              {link.label}
            </Link>
          );
        }

        if (!hasMega) {
          return (
            <Link
              key={link.id}
              href={link.href}
              className="cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors duration-200 hover:bg-primary-50 hover:text-primary"
            >
              {link.label}
            </Link>
          );
        }

        return (
          <div
            key={link.id}
            className="relative"
            onMouseEnter={() => setOpenId(link.id)}
          >
            <button
              type="button"
              className={cn(
                'inline-flex cursor-pointer items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200',
                openId === link.id ? 'bg-primary-50 text-primary' : 'text-gray-600 hover:bg-primary-50 hover:text-primary',
              )}
              aria-expanded={openId === link.id}
            >
              {link.label}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openId === link.id && 'rotate-180')} />
            </button>

            {openId === link.id && (
              <div className="absolute end-0 top-full z-50 pt-2 animate-fade-in">
                <div className="glass-strong w-[min(92vw,36rem)] rounded-2xl p-4">
                  <div className="mb-3 flex items-center justify-between gap-3 px-1">
                    <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">دسته‌بندی‌ها</p>
                    <Link
                      href={link.href}
                      className="cursor-pointer text-xs font-medium text-primary hover:underline"
                    >
                      مشاهده همه
                    </Link>
                  </div>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {link.children!.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={child.href}
                          className="group flex cursor-pointer flex-col gap-2 rounded-xl border border-transparent p-2.5 transition-colors duration-200 hover:border-primary/15 hover:bg-white/70"
                        >
                          <div className="aspect-[4/3] overflow-hidden rounded-lg bg-primary-50">
                            {child.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={child.imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs font-medium text-primary/50">
                                {child.label}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-primary">{child.label}</p>
                            {child.description && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{child.description}</p>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
