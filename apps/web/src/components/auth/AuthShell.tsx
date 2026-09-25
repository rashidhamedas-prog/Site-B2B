'use client';

import { useRef, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/cn';
import { Confetti, type ConfettiRef, fireSideCanons } from './Confetti';
import './auth-glass.css';

function BrandGradient() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 800 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="taranom_auth_g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0.85 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-primary-dark)', stopOpacity: 0.55 }} />
        </linearGradient>
        <linearGradient id="taranom_auth_g2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--color-secondary)', stopOpacity: 0.75 }} />
          <stop offset="100%" style={{ stopColor: 'var(--brand-ivory)', stopOpacity: 0.45 }} />
        </linearGradient>
        <radialGradient id="taranom_auth_g3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: 'var(--color-primary-light)', stopOpacity: 0.7 }} />
          <stop offset="100%" style={{ stopColor: 'var(--color-secondary)', stopOpacity: 0.25 }} />
        </radialGradient>
        <filter id="taranom_auth_blur1" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="35" />
        </filter>
        <filter id="taranom_auth_blur2" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="28" />
        </filter>
      </defs>
      <g className="auth-grad-float-1">
        <ellipse
          cx="200"
          cy="500"
          rx="250"
          ry="180"
          fill="url(#taranom_auth_g1)"
          filter="url(#taranom_auth_blur1)"
          transform="rotate(-30 200 500)"
        />
        <rect
          x="500"
          y="100"
          width="300"
          height="250"
          rx="80"
          fill="url(#taranom_auth_g2)"
          filter="url(#taranom_auth_blur2)"
          transform="rotate(15 650 225)"
        />
      </g>
      <g className="auth-grad-float-2">
        <circle
          cx="650"
          cy="450"
          r="140"
          fill="url(#taranom_auth_g3)"
          filter="url(#taranom_auth_blur1)"
          opacity="0.75"
        />
        <ellipse
          cx="60"
          cy="140"
          rx="170"
          ry="110"
          fill="var(--color-primary)"
          filter="url(#taranom_auth_blur2)"
          opacity="0.35"
        />
      </g>
    </svg>
  );
}

export type AuthShellProps = {
  brandName?: string;
  logo?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  confettiRef?: RefObject<ConfettiRef | null>;
  /** Compact card layout (retail account inside storefront chrome) */
  compact?: boolean;
};

export function AuthShell({
  brandName = 'پوشاک ترنم',
  logo,
  children,
  footer,
  className,
  confettiRef,
  compact = false,
}: AuthShellProps) {
  const localRef = useRef<ConfettiRef>(null);
  const ref = confettiRef ?? localRef;

  const defaultLogo = (
    <div className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white/95 p-1 shadow-sm border border-white/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-128.png" alt="" width={28} height={28} className="h-full w-full object-contain" />
    </div>
  );

  return (
    <div
      className={cn(
        'auth-glass-root relative flex w-full flex-col bg-[var(--brand-ivory,#F6F1E8)]',
        compact ? 'min-h-[70vh]' : 'min-h-screen w-screen',
        className,
      )}
      dir="rtl"
    >
      <Confetti
        ref={ref}
        manualstart
        className="pointer-events-none fixed inset-0 z-[999] h-full w-full"
        aria-hidden
      />

      <div
        className={cn(
          'fixed z-20 flex items-center gap-2',
          compact ? 'top-3 right-4' : 'top-4 right-4 md:right-1/2 md:translate-x-1/2 md:left-auto',
        )}
      >
        {logo ?? defaultLogo}
        <h1 className="text-base font-bold text-[var(--brand-ink,#1A1A1A)]">{brandName}</h1>
      </div>

      <div
        className={cn(
          'relative flex flex-1 items-center justify-center overflow-hidden',
          compact ? 'bg-[var(--brand-card,#F3EEE6)] px-4 py-16' : 'bg-[var(--brand-card,#F3EEE6)]',
        )}
      >
        <div className="pointer-events-none absolute inset-0 z-0 opacity-90">
          <BrandGradient />
        </div>
        <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6 px-4 py-20">
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}

export { fireSideCanons };
export type { ConfettiRef };
