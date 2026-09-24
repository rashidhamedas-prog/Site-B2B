/** Size labels in catalog are often already "سایز ۱" — avoid "از سایز سایز ۱". */
export function formatSizePhrase(size?: string | null): string {
  const raw = String(size || '').trim();
  if (!raw) return '';
  // \b is unreliable for Persian; match prefix explicitly.
  if (raw.startsWith('سایز') || /^size(\s|$)/i.test(raw)) return raw;
  return `سایز ${raw}`;
}

export function stockRemainingCopy(stock: number, size?: string | null): string {
  const n = Math.max(0, Math.floor(Number(stock) || 0));
  if (n <= 0) return 'ناموجود';
  if (n > 4) return 'موجود';
  const sizePart = formatSizePhrase(size);
  return sizePart
    ? `فقط ${n.toLocaleString('fa-IR')} عدد از ${sizePart}`
    : `فقط ${n.toLocaleString('fa-IR')} عدد`;
}
