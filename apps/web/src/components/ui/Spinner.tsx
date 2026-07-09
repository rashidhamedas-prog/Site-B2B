import { cn } from '@/lib/cn';

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

const sizes: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
  xl: 'h-12 w-12 border-[3px]',
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

export function Spinner({ size = 'md', className, label = 'در حال بارگذاری...' }: SpinnerProps) {
  return (
    <div role="status" className={cn('inline-flex flex-col items-center gap-2', className)}>
      <span
        className={cn(
          'inline-block animate-spin rounded-full border-primary border-t-transparent',
          sizes[size]
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Spinner size="xl" />
    </div>
  );
}
