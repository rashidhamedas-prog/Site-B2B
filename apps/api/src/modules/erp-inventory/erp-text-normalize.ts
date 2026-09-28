/** Normalize Persian/Arabic labels for ERP ↔ site variant matching. */
export function normalizeErpLabel(value: string | null | undefined): string {
  let s = String(value ?? '').trim();
  if (!s) return '';
  s = s.replace(/[\u200c\u200f\u200e\u202a-\u202e]/g, '');
  s = s.replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  s = s.replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
  s = s.replace(/[\u06f0-\u06f9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
}

export function variantMatchKey(color: string, size: string): string {
  return `${normalizeErpLabel(color)}|${normalizeErpLabel(size)}`;
}
