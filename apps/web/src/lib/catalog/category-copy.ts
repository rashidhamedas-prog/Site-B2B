/** Keep in sync with apps/api/src/modules/category/category-copy.ts */
export function isInternalCategoryHref(raw: string): boolean {
  const value = String(raw ?? '').trim();
  if (!value || value.length > 300) return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (/[\u0000-\u0020"'<>\\]/.test(value)) return false;
  if (value.includes('://') || value.includes('..')) return false;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return false;
  if (/[\u0000-\u0020"'<>\\]/.test(decoded)) return false;
  if (decoded.includes('://') || decoded.includes('..')) return false;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(decoded)) return false;
  return /^\/[A-Za-z0-9._~:/?#\[\]@!$&()*+,;=%-]*$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Show existing plain paragraphs in the editor without saving HTML until the manager edits. */
export function plainToEditorHtml(value: string): string {
  const text = value ?? '';
  if (!text.trim()) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\n\n+/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
