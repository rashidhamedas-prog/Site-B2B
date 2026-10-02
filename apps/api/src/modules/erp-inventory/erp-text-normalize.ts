/** Normalize Persian/Arabic labels for ERP ↔ site variant matching. */
export function normalizeErpLabel(value: string | null | undefined): string {
  let s = String(value ?? '').trim();
  if (!s) return '';
  s = s.replace(/[\u200c\u200f\u200e\u202a-\u202e]/g, '');
  s = s.replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  s = s.replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
  s = s.replace(/[\u06f0-\u06f9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
  // Strip parenthetical fit hints: «فری سایز (مناسب تا 48)» → «فری سایز»
  s = s.replace(/\s*[(\u060c\u061f（][^)]*[)\u060c\u061f）]\s*/g, ' ');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  // Free-size aliases
  if (/^(فری\s*سایز|free\s*size|onesize|one\s*size|f)$/i.test(s.replace(/\s+/g, ' '))) {
    return 'فری سایز';
  }
  return s;
}

export function variantMatchKey(color: string, size: string): string {
  return `${normalizeErpLabel(color)}|${normalizeErpLabel(size)}`;
}
