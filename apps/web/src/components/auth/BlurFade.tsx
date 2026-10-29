'use client';

import { cn } from '@/lib/cn';

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  /** Ignored — kept for call-site compatibility */
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
}

export function BlurFade({ children, className, delay = 0 }: BlurFadeProps) {
  const delayMs = Math.min(Math.max(delay, 0), 0.15) * 1000;
  return (
    <div
      className={cn('auth-fade-in', className)}
      style={delayMs > 0 ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
