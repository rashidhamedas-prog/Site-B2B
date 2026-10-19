import Link from 'next/link';
import { cn } from '@/lib/cn';
import {
  resolveCategoryCtaHref,
  type CategoryCtaConfig,
} from '@/lib/catalog/category-cta';
import type { CategoryChannel } from './category-search-params';

export function CategoryCtaLink({
  cta,
  channel,
  className,
}: {
  cta: CategoryCtaConfig | null | undefined;
  channel: CategoryChannel;
  className?: string;
}) {
  if (!cta?.enabled) return null;
  const href = resolveCategoryCtaHref(cta);
  if (!href) return null;

  const retail = channel === 'RETAIL';
  const primary = cta.variant !== 'secondary';
  const external = href.startsWith('https://');

  const classes = cn(
    'inline-flex min-h-11 items-center justify-center rounded-full px-6 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    primary
      ? retail
        ? 'bg-[var(--retail-ink,#1A1A1A)] text-white hover:opacity-90 focus-visible:ring-[var(--retail-ink,#1A1A1A)]'
        : 'bg-[var(--brand-green,#1B5C4A)] text-white hover:bg-[var(--brand-green-dark,#0F2F28)] focus-visible:ring-[var(--brand-gold,#C9A84C)]'
      : retail
        ? 'border border-[var(--retail-border,#E8E2D9)] bg-white text-[var(--retail-ink,#1A1A1A)] hover:border-[var(--retail-ink,#1A1A1A)] focus-visible:ring-[var(--retail-ink,#1A1A1A)]'
        : 'border border-[var(--brand-border,#E8E0D4)] bg-white text-[var(--brand-green-dark,#0F2F28)] hover:border-[var(--brand-gold,#C9A84C)] focus-visible:ring-[var(--brand-gold,#C9A84C)]',
    className,
  );

  if (external) {
    return (
      <a href={href} className={classes} rel="noopener noreferrer">
        {cta.label.trim()}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {cta.label.trim()}
    </Link>
  );
}
