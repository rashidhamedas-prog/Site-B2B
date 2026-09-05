import Link from 'next/link';

const LINKS = [
  { href: '/category/shomiz', label: 'شومیز زنانه' },
  { href: '/category/women-coats', label: 'کت زنانه' },
  { href: '/category/winter-wear', label: 'کاپشن زنانه' },
  { href: '/category/kaftan', label: 'کفتان زنانه' },
] as const;

/** Home shortcuts to the four category owners — no images, below the hero LCP. */
export function RetailHomeCategoryLinks() {
  return (
    <nav
      className="border-b border-[var(--retail-border)] bg-[var(--retail-bg)]"
      aria-label="دسته‌های خرید تکی"
    >
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm leading-7 text-[var(--retail-muted)]">
          اگر یک تکه برای خودتان می‌خواهید، از شومیز و کت شروع کنید؛ کاپشن و کفتان هم همین‌جا هستند.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex rounded-full border border-[var(--retail-border)] bg-white px-4 py-2 text-sm font-bold text-[var(--retail-ink)] transition hover:border-[var(--retail-gold)] hover:text-[var(--retail-primary)]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
