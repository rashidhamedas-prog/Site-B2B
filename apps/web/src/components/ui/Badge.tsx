import { cn } from '@/lib/cn';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' | 'gold';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  error:   'bg-red-100 text-red-800',
  info:    'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary-100 text-primary-dark',
  gold:    'bg-secondary-50 text-secondary-dark border border-secondary-200',
};

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error:   'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-gray-500',
  primary: 'bg-primary',
  gold:    'bg-secondary',
};

export function Badge({ variant = 'neutral', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', dotColors[variant])} />
      )}
      {children}
    </span>
  );
}

// ── Order status badge ────────────────────────────────────────────────────────

const ORDER_STATUS_FA: Record<string, string> = {
  DRAFT:            'پیش‌نویس',
  PENDING_REVIEW:   'در انتظار بررسی',
  CONFIRMED:        'تأیید شده',
  PROCESSING:       'در حال پردازش',
  PACKED:           'بسته‌بندی شده',
  SHIPPED:          'ارسال شده',
  DELIVERED:        'تحویل داده شده',
  COMPLETED:        'تکمیل شده',
  CANCELLED:        'لغو شده',
  RETURN_REQUESTED: 'درخواست مرجوع',
  RETURN_APPROVED:  'مرجوع تأیید شده',
  RETURNED:         'مرجوع شده',
  REFUNDED:         'بازپرداخت شده',
};

const ORDER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT:            'neutral',
  PENDING_REVIEW:   'warning',
  CONFIRMED:        'primary',
  PROCESSING:       'info',
  PACKED:           'info',
  SHIPPED:          'primary',
  DELIVERED:        'success',
  COMPLETED:        'success',
  CANCELLED:        'error',
  RETURN_REQUESTED: 'warning',
  RETURN_APPROVED:  'warning',
  RETURNED:         'neutral',
  REFUNDED:         'success',
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={ORDER_STATUS_VARIANT[status] ?? 'neutral'} dot>
      {ORDER_STATUS_FA[status] ?? status}
    </Badge>
  );
}

// ── Customer segment badge ────────────────────────────────────────────────────

const SEGMENT_STYLES: Record<string, { label: string; variant: BadgeVariant }> = {
  VIP:     { label: 'VIP', variant: 'gold' },
  A:       { label: 'سگمنت A', variant: 'primary' },
  B:       { label: 'سگمنت B', variant: 'info' },
  C:       { label: 'سگمنت C', variant: 'neutral' },
  BLOCKED: { label: 'مسدود', variant: 'error' },
};

export function SegmentBadge({ segment }: { segment: string }) {
  const config = SEGMENT_STYLES[segment] ?? { label: segment, variant: 'neutral' as BadgeVariant };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
