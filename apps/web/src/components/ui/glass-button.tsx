'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const glassButtonVariants = cva('auth-glass-button relative z-10 isolate cursor-pointer rounded-full', {
  variants: {
    size: {
      default: 'text-base font-medium',
      sm: 'text-sm font-medium',
      lg: 'text-lg font-medium',
      icon: 'h-10 w-10',
      full: 'w-full text-base font-bold',
    },
  },
  defaultVariants: { size: 'default' },
});

const glassButtonTextVariants = cva('auth-glass-button-text relative block tracking-tight', {
  variants: {
    size: {
      default: 'px-6 py-3.5',
      sm: 'px-4 py-2',
      lg: 'px-8 py-4',
      icon: 'flex h-10 w-10 items-center justify-center p-0',
      full: 'px-6 py-3.5 text-center',
    },
  },
  defaultVariants: { size: 'default' },
});

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, ...props }, ref) => (
    <div className={cn('auth-glass-button-wrap cursor-pointer rounded-full relative', className)}>
      <button className={cn(glassButtonVariants({ size }))} ref={ref} {...props}>
        <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
      </button>
      <div className="auth-glass-button-shadow rounded-full pointer-events-none" aria-hidden />
    </div>
  ),
);
GlassButton.displayName = 'GlassButton';
