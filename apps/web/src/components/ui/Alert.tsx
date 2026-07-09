'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const alertStyles: Record<AlertVariant, { container: string; icon: React.ReactNode }> = {
  success: {
    container: 'bg-green-50 border-green-200 text-green-800',
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: <AlertCircle className="h-5 w-5 text-red-500" />,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: <Info className="h-5 w-5 text-blue-500" />,
  },
};

export function Alert({ variant = 'info', title, children, dismissible, onDismiss, className }: AlertProps) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const { container, icon } = alertStyles[variant];

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-xl border p-4 text-sm',
        container,
        className
      )}
    >
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
      {dismissible && (
        <button
          onClick={() => { setVisible(false); onDismiss?.(); }}
          className="flex-shrink-0 self-start rounded-lg p-0.5 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="بستن"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
