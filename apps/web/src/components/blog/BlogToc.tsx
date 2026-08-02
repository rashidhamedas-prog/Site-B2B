/** Extract h2/h3 headings for TOC from HTML or markdown. */
export function extractToc(
  content: string,
  depth = 3,
): Array<{ id: string; text: string; level: 2 | 3 }> {
  const items: Array<{ id: string; text: string; level: 2 | 3 }> = [];
  const html = content?.trim().startsWith('<');
  if (html) {
    const re = depth >= 3 ? /<h([23])[^>]*>(.*?)<\/h\1>/gi : /<h(2)[^>]*>(.*?)<\/h\1>/gi;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(content)) && i < 40) {
      const text = m[2].replace(/<[^>]+>/g, '').trim();
      if (!text) continue;
      const id = `toc-${i}-${slugifyHeading(text)}`;
      items.push({ id, text, level: Number(m[1]) as 2 | 3 });
      i += 1;
    }
    return items;
  }
  const lines = (content || '').split('\n');
  let i = 0;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = depth >= 3 ? line.match(/^###\s+(.+)/) : null;
    if (h2) {
      items.push({ id: `toc-${i}-${slugifyHeading(h2[1])}`, text: h2[1].trim(), level: 2 });
      i += 1;
    } else if (h3) {
      items.push({ id: `toc-${i}-${slugifyHeading(h3[1])}`, text: h3[1].trim(), level: 3 });
      i += 1;
    }
    if (items.length >= 40) break;
  }
  return items;
}

function slugifyHeading(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]/g, '')
    .slice(0, 48);
}

export function BlogToc({
  items,
  tone = 'wholesale',
}: {
  items: Array<{ id: string; text: string; level: 2 | 3 }>;
  tone?: 'wholesale' | 'retail';
}) {
  if (!items.length) return null;
  const box =
    tone === 'retail'
      ? 'mb-8 rounded-2xl border border-stone-200 bg-white p-5'
      : 'card mb-8 p-5';
  return (
    <nav className={box} aria-label="فهرست مطالب">
      <p className="mb-3 text-sm font-bold">فهرست مطالب</p>
      <ol className="space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'pr-4' : ''}>
            <a href={`#${item.id}`} className="text-gray-600 hover:text-primary">
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Inject id attributes into HTML headings for TOC anchors. */
export function injectHeadingIds(html: string, items: Array<{ id: string; text: string; level: 2 | 3 }>) {
  let out = html;
  let idx = 0;
  out = out.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (full, level, attrs, inner) => {
    const text = String(inner).replace(/<[^>]+>/g, '').trim();
    const match = items[idx];
    if (!match || match.text !== text) {
      // still consume sequential if close enough
    }
    const id = items[idx]?.id;
    idx += 1;
    if (!id) return full;
    if (/\sid=/.test(attrs)) return full;
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });
  return out;
}
