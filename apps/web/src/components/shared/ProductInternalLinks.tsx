import type { InternalLinkView } from '@/lib/hooks/useProducts';

/**
 * Renders a product's curated internal-link list (per channel) below the
 * product content, plus an ItemList JSON-LD for richer crawling.
 *
 * Server component — no client JS. Links are relative paths so they resolve
 * to the correct channel host automatically (retail .ir vs wholesale .com).
 */
export function ProductInternalLinks({
  links,
  heading = 'لینک‌های مرتبط',
}: {
  links: InternalLinkView[] | undefined | null;
  heading?: string;
}) {
  if (!links || links.length === 0) return null;

  const rel = (r: string) => (r === 'dofollow' ? undefined : r);

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: links.length,
    itemListElement: links.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: l.anchorText,
      url: l.targetUrl,
    })),
  };

  return (
    <section className="container-site pb-16" aria-label={heading}>
      <h2 className="text-xl font-extrabold text-gray-900">{heading}</h2>
      <p className="mt-1 text-sm text-gray-500">صفحات مرتبط برای راهنمایی خرید</p>
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {links.map((l) => (
          <li key={l.id}>
            <a
              href={l.targetUrl}
              title={l.title || undefined}
              rel={rel(l.rel)}
              className="text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-4 hover:text-gray-900 hover:decoration-gray-500"
            >
              {l.anchorText}
            </a>
          </li>
        ))}
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
