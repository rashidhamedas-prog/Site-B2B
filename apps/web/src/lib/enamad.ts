/** Public-safe Enamad (اینماد) seal config — one per sales channel. */
export type EnamadSealConfig = {
  enabled: boolean;
  id: string;
  code: string;
  linkUrl: string;
  imageUrl: string;
  htmlSnippet: string;
};

export const EMPTY_ENAMAD: EnamadSealConfig = {
  enabled: false,
  id: '',
  code: '',
  linkUrl: '',
  imageUrl: '',
  htmlSnippet: '',
};

export function normalizeEnamad(raw: Partial<EnamadSealConfig> | null | undefined): EnamadSealConfig {
  return {
    enabled: raw?.enabled === true,
    id: String(raw?.id ?? '').trim(),
    code: String(raw?.code ?? '').trim(),
    linkUrl: String(raw?.linkUrl ?? '').trim(),
    imageUrl: String(raw?.imageUrl ?? '').trim(),
    htmlSnippet: String(raw?.htmlSnippet ?? '').trim(),
  };
}

/** Official Enamad verify URL from id + Code. */
export function enamadVerifyUrl(id: string, code: string) {
  if (!id || !code) return '';
  return `https://trustseal.enamad.ir/?id=${encodeURIComponent(id)}&Code=${encodeURIComponent(code)}`;
}

/** Official Enamad logo URL from id + Code. */
export function enamadLogoUrl(id: string, code: string) {
  if (!id || !code) return '';
  return `https://trustseal.enamad.ir/logo.aspx?id=${encodeURIComponent(id)}&Code=${encodeURIComponent(code)}`;
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

/**
 * Extract id / Code / link / image from HTML pasted from the Enamad panel.
 * Supports trustseal.enamad.ir query params and common <a><img> snippets.
 */
export function parseEnamadHtml(html: string): Partial<EnamadSealConfig> {
  const raw = String(html || '').trim();
  if (!raw) return {};

  const out: Partial<EnamadSealConfig> = {};
  const decode = (s: string) =>
    s
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

  const hrefMatch =
    raw.match(/href\s*=\s*["']([^"']*trustseal\.enamad\.ir[^"']*)["']/i) ||
    raw.match(/href\s*=\s*["']([^"']+)["']/i);
  if (hrefMatch?.[1]) {
    const href = decode(hrefMatch[1]).trim();
    out.linkUrl = href;
    try {
      const u = new URL(href);
      const id = u.searchParams.get('id') || '';
      const code = u.searchParams.get('Code') || u.searchParams.get('code') || '';
      if (id) out.id = id;
      if (code) out.code = code;
    } catch {
      /* ignore invalid URL */
    }
  }

  const srcMatch = raw.match(/src\s*=\s*["']([^"']+)["']/i);
  if (srcMatch?.[1]) {
    const src = decode(srcMatch[1]).trim();
    out.imageUrl = src;
    try {
      const u = new URL(src, 'https://trustseal.enamad.ir');
      if (!out.id) {
        const id = u.searchParams.get('id') || '';
        if (id) out.id = id;
      }
      if (!out.code) {
        const code = u.searchParams.get('Code') || u.searchParams.get('code') || '';
        if (code) out.code = code;
      }
    } catch {
      /* ignore */
    }
  }

  // Enamad often sets img id="{Code}"
  if (!out.code) {
    const imgId = raw.match(/<img\b[^>]*\bid\s*=\s*["']([^"']+)["']/i);
    if (imgId?.[1]) out.code = decode(imgId[1]).trim();
  }

  // Fallback: bare id= / Code= in the blob
  if (!out.id) {
    const m = raw.match(/[?&]id=([0-9]+)/i);
    if (m?.[1]) out.id = m[1];
  }
  if (!out.code) {
    const m = raw.match(/[?&]Code=([A-Za-z0-9_-]+)/i);
    if (m?.[1]) out.code = m[1];
  }

  return out;
}

/** Apply pasted HTML: keep snippet + fill structured fields when parseable. */
export function applyEnamadHtmlPaste(
  current: EnamadSealConfig,
  html: string,
): EnamadSealConfig {
  const snippet = String(html || '').trim();
  if (!snippet) {
    return { ...current, htmlSnippet: '' };
  }
  const parsed = parseEnamadHtml(snippet);
  return {
    ...current,
    htmlSnippet: snippet,
    enabled: true,
    id: parsed.id || current.id,
    code: parsed.code || current.code,
    linkUrl: parsed.linkUrl || current.linkUrl,
    // Prefer already-uploaded custom image; otherwise take src from snippet
    imageUrl: current.imageUrl || parsed.imageUrl || '',
  };
}

/** Resolved href/src for safe structured rendering. */
export function resolveEnamadAssets(cfg: EnamadSealConfig): { href: string; src: string } | null {
  const href =
    cfg.linkUrl ||
    enamadVerifyUrl(cfg.id, cfg.code) ||
    '';
  const src =
    resolveMediaUrl(cfg.imageUrl) ||
    enamadLogoUrl(cfg.id, cfg.code) ||
    '';
  if (!href && !src) return null;
  if (!src) return null;
  return {
    href: href || 'https://trustseal.enamad.ir/',
    src,
  };
}

/** True when there is something renderable for the footer. */
export function enamadHasRenderable(cfg: EnamadSealConfig) {
  if (!cfg.enabled) return false;
  if (resolveEnamadAssets(cfg)) return true;
  if (cfg.htmlSnippet) return true;
  return false;
}
