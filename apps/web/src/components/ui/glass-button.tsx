'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const glassButtonVariants = cva('auth-button', {
  variants: {
    size: {
      default: 'px-6',
      sm: 'px-4 text-sm min-h-[44px]',
      lg: 'px-8 text-lg',
      icon: 'auth-button--icon',
      full: 'auth-button--full',
    },
  },
  defaultVariants: { size: 'default' },
});

const glassButtonTextVariants = cva('auth-button-text', {
  variants: {
    size: {
      default: 'py-3',
      sm: 'py-2',
      lg: 'py-3.5',
      icon: 'flex h-full w-full items-center justify-center p-0',
      full: 'w-full py-3 text-center',
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
    <button className={cn(glassButtonVariants({ size }), className)} ref={ref} {...props}>
      <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
    </button>
  ),
);
GlassButton.displayName = 'GlassButton';
