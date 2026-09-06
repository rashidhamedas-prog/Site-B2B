/**
 * The template renderer emits one canonical text: HTML-escaped copy where the only tag is
 * `<b>…</b>` (see publication-template.ts). Telegram sends it as-is with parse_mode=HTML; the
 * other vendors need their own wire format, derived here without ever re-parsing user copy as
 * markup. Everything in this file is pure.
 */

export type RichSpan = { text: string; bold: boolean };

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function unescapeCanonicalHtml(value: string): string {
  return String(value || '').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (match) => ENTITY_MAP[match] ?? match);
}

/** Splits canonical HTML into bold/plain spans. Unknown tags are dropped, their text kept. */
export function parseCanonicalSpans(html: string): RichSpan[] {
  const source = String(html || '');
  const spans: RichSpan[] = [];
  const re = /<\/?b>|<[^>]+>/gi;
  let bold = false;
  let last = 0;
  const push = (raw: string) => {
    if (!raw) return;
    const text = unescapeCanonicalHtml(raw);
    const prev = spans[spans.length - 1];
    if (prev && prev.bold === bold) prev.text += text;
    else spans.push({ text, bold });
  };
  for (let match = re.exec(source); match; match = re.exec(source)) {
    push(source.slice(last, match.index));
    const tag = match[0].toLowerCase();
    if (tag === '<b>') bold = true;
    else if (tag === '</b>') bold = false;
    last = match.index + match[0].length;
  }
  push(source.slice(last));
  return spans;
}

export function canonicalToPlain(html: string): string {
  return parseCanonicalSpans(html).map((span) => span.text).join('');
}

/**
 * Bale formats every message as Markdown and its docs require a space before the opening `*`
 * and after the closing one. Literal `*`/`_` in copy are replaced with look-alikes so a product
 * name can never open an unintended bold/italic run. Newlines count as separators.
 */
export function canonicalToBaleMarkdown(html: string): string {
  const spans = parseCanonicalSpans(html).map((span) => ({
    bold: span.bold,
    text: span.text.replace(/\*/g, '✱').replace(/_/g, '‗'),
  }));
  let out = '';
  spans.forEach((span, index) => {
    const body = span.text.trim();
    if (!span.bold || !body) {
      out += span.text;
      return;
    }
    const leading = span.text.slice(0, span.text.length - span.text.trimStart().length);
    const trailing = span.text.slice(span.text.trimEnd().length);
    if (out && !leading && !/\s$/.test(out)) out += ' ';
    out += `${leading}*${body}*${trailing}`;
    const next = spans[index + 1];
    if (next && !trailing && next.text && !/^\s/.test(next.text)) out += ' ';
  });
  return out;
}

export type RubikaMetadataPart = { type: 'Bold' | 'Link'; from_index: number; length: number; link_url?: string };

/** Rubika indexes metadata in UTF-16 code units (JS string length), max 30 parts per message. */
export const RUBIKA_METADATA_LIMIT = 30;

export function canonicalToRubika(html: string): { text: string; parts: RubikaMetadataPart[] } {
  const spans = parseCanonicalSpans(html);
  let text = '';
  const parts: RubikaMetadataPart[] = [];
  for (const span of spans) {
    const from = text.length;
    text += span.text;
    if (span.bold && span.text.trim() && parts.length < RUBIKA_METADATA_LIMIT) {
      parts.push({ type: 'Bold', from_index: from, length: span.text.length });
    }
  }
  return { text, parts };
}

/** Appends `🔗 label: url` lines; Rubika's official Button model documents no URL field. */
export function appendLinkLines(text: string, buttons: Array<{ label: string; url: string }>): string {
  if (!buttons.length) return text;
  const lines = buttons.map((button) => `🔗 ${button.label}: ${button.url}`);
  return `${text}${text ? '\n\n' : ''}${lines.join('\n')}`;
}
