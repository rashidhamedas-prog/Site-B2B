'use client';

import { cn } from '@/lib/cn';

type GlassInputProps = {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function GlassInput({ icon, trailing, className, children }: GlassInputProps) {
  return (
    <div className={cn('auth-glass-input-wrap', className)}>
      <div className="auth-glass-input">
        {icon ? (
          <div className="relative z-10 flex w-10 flex-shrink-0 items-center justify-center pl-1 text-[color-mix(in_srgb,var(--brand-ink)_70%,transparent)]">
            {icon}
          </div>
        ) : null}
        {children}
        {trailing ? <div className="relative z-10 flex flex-shrink-0 items-center pr-1">{trailing}</div> : null}
      </div>
    </div>
  );
}
