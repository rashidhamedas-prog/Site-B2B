import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code', 'hr', 'div', 'span',
];

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
    const clean = DOMPurify.sanitize(raw, {
      ALLOWED_TAGS,
      ALLOWED_ATTR: ['href', 'name', 'target', 'rel', 'title', 'src', 'alt', 'width', 'height', 'loading', 'decoding', 'colspan', 'rowspan', 'class', 'id'],
    });
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
