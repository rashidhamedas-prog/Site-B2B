import { ChevronLeft } from 'lucide-react';
import { ProductImage } from '@/components/ui/ProductImage';
import type { InternalLinkView } from '@/lib/hooks/useProducts';

/**
 * PDP guide list: full-width rows with image + short excerpt, plus ItemList JSON-LD.
 * Server component — no client JS. Relative hrefs resolve per channel host.
 */
export function ProductInternalLinks({
  links,
  heading = 'راهنما',
  tone = 'wholesale',
  embedded = false,
}: {
  links: InternalLinkView[] | undefined | null;
  heading?: string;
  tone?: 'wholesale' | 'retail';
  embedded?: boolean;
}) {
  if (!links || links.length === 0) return null;

  const rel = (r: string) => (r === 'dofollow' ? undefined : r);
  const retail = tone === 'retail';
  const subtitle = retail
    ? 'دسته‌ها و مطلب‌هایی که انتخاب مدل را دقیق‌تر می‌کنند'
    : 'دسته‌ها و مدل‌هایی که تکمیل سفارش عمده را روشن‌تر می‌کنند';

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: heading,
    numberOfItems: links.length,
    itemListElement: links.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: l.anchorText,
      url: l.targetUrl,
      ...(l.cardImageUrl || l.imageUrl ? { image: l.cardImageUrl || l.imageUrl } : {}),
      ...(l.cardExcerpt || l.excerpt ? { description: l.cardExcerpt || l.excerpt } : {}),
    })),
  };

  return (
    <section
      className={embedded ? '' : 'container-site pb-16'}
      aria-labelledby="pdp-guide-heading"
    >
      <h2
        id="pdp-guide-heading"
        className={
          retail
            ? 'text-lg font-bold text-[var(--retail-ink)] sm:text-xl'
            : 'text-lg font-bold text-gray-900 sm:text-xl'
        }
      >
        {heading}
      </h2>
      <p
        className={
          retail
            ? 'mt-1 text-sm text-[var(--retail-muted)]'
            : 'mt-1 text-sm text-gray-500'
        }
      >
        {subtitle}
      </p>
      <ul className="mt-5 space-y-3">
        {links.map((l) => {
          const image = l.cardImageUrl || l.imageUrl;
          const excerpt = l.cardExcerpt || l.excerpt;
          return (
            <li key={l.id}>
              <a
                href={l.targetUrl}
                title={l.title || undefined}
                rel={rel(l.rel)}
                className={
                  retail
                    ? 'group flex min-h-[5.5rem] items-stretch gap-3 rounded-2xl border border-[var(--retail-border)] bg-white p-2.5 transition hover:border-[var(--retail-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--retail-gold)] sm:gap-4 sm:p-3'
                    : 'group flex min-h-[5.5rem] items-stretch gap-3 rounded-2xl border border-[var(--brand-border,#E8E0D4)] bg-[var(--brand-ivory,#F6F1E8)] p-2.5 transition hover:border-[var(--brand-gold,#C9A84C)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-gold,#C9A84C)] sm:gap-4 sm:p-3'
                }
              >
                <div
                  className={
                    retail
                      ? 'relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--retail-bg)] sm:h-24 sm:w-24'
                      : 'relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--brand-card,#F3EEE6)] sm:h-24 sm:w-24'
                  }
                >
                  <ProductImage src={image} alt="" sizes="96px" />
                </div>
                <span className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
                  <span
                    className={
                      retail
                        ? 'text-sm font-bold text-[var(--retail-ink)] sm:text-base'
                        : 'text-sm font-bold text-[var(--brand-ink,#1A1A1A)] sm:text-base'
                    }
                  >
                    {l.anchorText}
                  </span>
                  {excerpt ? (
                    <span
                      className={
                        retail
                          ? 'mt-1 line-clamp-2 text-xs leading-6 text-[var(--retail-muted)] sm:text-sm'
                          : 'mt-1 line-clamp-2 text-xs leading-6 text-[var(--brand-muted,#6B7280)] sm:text-sm'
                      }
                    >
                      {excerpt}
                    </span>
                  ) : null}
                </span>
                <span
                  className={
                    retail
                      ? 'flex items-center text-[var(--retail-muted)] transition group-hover:-translate-x-0.5 motion-reduce:transform-none'
                      : 'flex items-center text-[var(--brand-muted,#6B7280)] transition group-hover:-translate-x-0.5 motion-reduce:transform-none'
                  }
                  aria-hidden
                >
                  <ChevronLeft className="h-5 w-5" />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemList)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />
    </section>
  );
}
