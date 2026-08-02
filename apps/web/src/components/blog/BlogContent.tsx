/** Lightweight HTML guard for already API-sanitized blog content (no heavy DOMPurify on Node 20). */
const DANGEROUS = /<\/?(?:script|iframe|object|embed|form|link|meta|base)[^>]*>/gi;
const ON_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_HREF = /\s(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi;

export function lightSanitizeHtml(html: string): string {
  return (html || '')
    .replace(DANGEROUS, '')
    .replace(ON_ATTR, '')
    .replace(JS_HREF, '');
}

function renderMarkdown(md: string, tone: 'wholesale' | 'retail' = 'wholesale') {
  const heading = tone === 'retail' ? 'text-stone-900' : 'text-gray-900';
  const body = tone === 'retail' ? 'text-stone-600' : 'text-gray-600';
  const strong = tone === 'retail' ? 'text-stone-800' : 'text-gray-800';
  const blocks = md.split(/\n\n+/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={i} className={`mt-6 mb-2 text-base font-bold ${heading}`}>
          {trimmed.slice(4)}
        </h3>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={i} className={`mt-8 mb-3 text-lg font-bold ${heading}`}>
          {trimmed.slice(3)}
        </h2>
      );
    }
    if (trimmed.split('\n').every((l) => l.trim().startsWith('- '))) {
      return (
        <ul key={i} className={`list-disc space-y-1.5 pr-5 text-sm leading-relaxed ${body}`}>
          {trimmed.split('\n').map((l, j) => {
            const item = l.trim().slice(2);
            const parts = item.split(/\*\*(.+?)\*\*/g);
            return (
              <li key={j}>
                {parts.map((p, k) =>
                  k % 2 === 1 ? (
                    <strong key={k} className={strong}>
                      {p}
                    </strong>
                  ) : (
                    p
                  ),
                )}
              </li>
            );
          })}
        </ul>
      );
    }
    const parts = trimmed.split(/\*\*(.+?)\*\*/g);
    return (
      <p key={i} className={`text-sm leading-loose ${body}`}>
        {parts.map((p, k) =>
          k % 2 === 1 ? (
            <strong key={k} className={strong}>
              {p}
            </strong>
          ) : (
            p
          ),
        )}
      </p>
    );
  });
}

export function BlogContent({
  content,
  contentFormat,
  tone = 'wholesale',
  className,
}: {
  content: string;
  contentFormat?: string;
  tone?: 'wholesale' | 'retail';
  className?: string;
}) {
  const raw = content || '';
  const isHtml = contentFormat === 'HTML' || raw.trim().startsWith('<');
  if (isHtml) {
    const clean = lightSanitizeHtml(raw);
    return (
      <div
        className={
          className ||
          (tone === 'retail'
            ? 'blog-prose space-y-3 text-sm leading-loose text-stone-600 [&_a]:text-amber-800 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-stone-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_img]:my-4 [&_img]:rounded-xl [&_ul]:list-disc [&_ul]:pr-5'
            : 'blog-prose space-y-3 text-sm leading-loose text-gray-600 [&_a]:text-primary [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_img]:my-4 [&_img]:rounded-xl [&_ul]:list-disc [&_ul]:pr-5')
        }
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }
  return <div className={className}>{renderMarkdown(raw, tone)}</div>;
}
