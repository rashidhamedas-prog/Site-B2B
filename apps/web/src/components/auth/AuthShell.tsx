'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import './auth.css';

export type AuthShellProps = {
  brandName?: string;
  logo?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** @deprecated Confetti removed for performance */
  confettiRef?: unknown;
  /** Compact card layout (retail account inside storefront chrome) */
  compact?: boolean;
};

export function AuthShell({
  brandName = 'پوشاک ترنم',
  logo,
  children,
  footer,
  className,
  compact = false,
}: AuthShellProps) {
  const defaultLogo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-128.png"
      alt=""
      width={40}
      height={40}
      className="h-10 w-10 object-contain"
    />
  );

  return (
    <div
      className={cn(
        'auth-root relative flex w-full flex-col bg-[var(--brand-ivory,#F6F1E8)]',
        compact ? 'min-h-[70vh]' : 'min-h-[100dvh]',
        className,
      )}
      dir="rtl"
    >
      <main
        className={cn(
          'flex flex-1 flex-col items-center justify-center',
          compact ? 'px-4 py-10 sm:py-12' : 'px-4 py-12 md:py-[48px]',
        )}
      >
        <div className="auth-card flex w-full flex-col items-center gap-6">
          <div className="flex w-full flex-col items-center gap-2 text-center">
            {logo ?? defaultLogo}
            <h1 className="text-base font-bold text-[var(--brand-ink,#1A1A1A)]">{brandName}</h1>
          </div>
          {children}
          {footer ? <div className="w-full">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

/** @deprecated Confetti removed */
export function fireSideCanons(_fire?: unknown) {
  /* no-op */
}

/** @deprecated Confetti removed */
export type ConfettiRef = { fire: (options?: unknown) => void } | null;
