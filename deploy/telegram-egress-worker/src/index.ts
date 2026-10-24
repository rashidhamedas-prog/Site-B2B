/**
 * Cloudflare Worker: authenticated proxy to api.telegram.org
 *
 * Why: Iran-hosted API often cannot reach api.telegram.org. Cloudflare edge can.
 * Nest sets TELEGRAM_API_URL to this Worker origin (no /bot… suffix). The adapter
 * still calls {base}/bot{token}/{method}. See docs/architecture/telegram-egress.md.
 *
 * EGRESS_SECRET is optional. When it is set, callers must send
 * x-taranom-egress-secret (same header as the SMS egress worker). When it is
 * unset, the header is not required — TelegramAdapter does not send it yet.
 *
 * Allowed paths only: /bot{token}/{method}
 */

const UPSTREAM_ORIGIN = 'https://api.telegram.org';
const BOT_PATH = /^\/bot([0-9]{6,16}:[A-Za-z0-9_-]{8,128})\/([A-Za-z][A-Za-z0-9]{0,64})$/;

export interface Env {
  EGRESS_SECRET?: string;
}

/**
 * Album uploads are JPEGs capped on the API (~9 MB each, usually far smaller).
 * 32 MB covers a full album without holding an unbounded body in the Worker.
 * Oversized bodies are rejected whole — a cut multipart would be another truncated file.
 */
export const MAX_EGRESS_BODY_BYTES = 32 * 1024 * 1024;
/** Shorter than the API's 28s upload timeout so a hung Bot API returns 502 instead of an abort race. */
export const UPSTREAM_TIMEOUT_MS = 26_000;

export type EgressDeps = {
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
  maxBodyBytes?: number;
  upstreamTimeoutMs?: number;
};

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, x-taranom-egress-secret',
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Strip `/bot…/` token segments and bare `id:secret` tokens before any log or error text. */
export function redactBotSecrets(message: string): string {
  return String(message || '')
    .replace(/\/bot[^/\s?#]+/gi, '/bot[redacted]')
    .replace(/\d{6,}:[A-Za-z0-9_-]{8,}/g, '[redacted-token]');
}

function declaredLength(request: Request): number | null {
  const raw = request.headers.get('content-length');
  if (raw == null || raw.trim() === '') return null;
  if (!/^\d{1,12}$/.test(raw.trim())) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

/** Stream-read until `maxBytes`. Returns null when the body would exceed the cap. */
export async function readCappedBody(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (!stream) return new Uint8Array(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch (err) {
    await reader.cancel().catch(() => undefined);
    throw err;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function upstreamSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms).unref?.();
  return ctrl.signal;
}

function safeContentType(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200 || /[\r\n\0]/.test(trimmed)) return null;
  if (!/^[\w!#$%&'*+.^`|~-]+\/[\w!#$%&'*+.^`|~-]+(?:\s*;\s*[\w!#$%&'*+.^`|~-]+=(?:"[^"\r\n]*"|[\w!#$%&'*+.^`|~-]+))*$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/** Query is forwarded only when it cannot change host or smuggle a path. */
function safeSearch(search: string): string | null {
  if (!search || search === '?') return '';
  if (search.length > 2048) return null;
  if (!/^\?[A-Za-z0-9._~%=&+-]*$/.test(search)) return null;
  const lower = search.toLowerCase();
  if (
    lower.includes('..')
    || lower.includes('%2e')
    || lower.includes('%2f')
    || lower.includes('%5c')
    || lower.includes('%00')
    || lower.includes('@')
    || lower.includes('\\')
    || lower.includes('//')
  ) {
    return null;
  }
  return search;
}

export function resolveBotRoute(pathname: string): { token: string; method: string } | null {
  let path = String(pathname || '');
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '');
  if (path.includes('..') || path.includes('\\') || path.includes('@') || path.includes('%') || path.includes('//')) {
    return null;
  }
  const match = BOT_PATH.exec(path);
  if (!match) return null;
  return { token: match[1], method: match[2] };
}

function upstreamUrl(token: string, method: string, search: string): URL | null {
  let upstream: URL;
  try {
    upstream = new URL(`${UPSTREAM_ORIGIN}/bot${token}/${method}${search}`);
  } catch {
    return null;
  }
  if (
    upstream.protocol !== 'https:'
    || upstream.hostname !== 'api.telegram.org'
    || upstream.port !== ''
    || upstream.username
    || upstream.password
    || upstream.pathname !== `/bot${token}/${method}`
  ) {
    return null;
  }
  return upstream;
}

export async function handleTelegramEgress(request: Request, env: Env, deps: EgressDeps = {}): Promise<Response> {
  const log = deps.log ?? ((message: string) => console.error(redactBotSecrets(message)));
  const fetchImpl = deps.fetchImpl ?? fetch;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const secret = String(env.EGRESS_SECRET || '').trim();
  if (secret) {
    const provided = String(request.headers.get('x-taranom-egress-secret') || '').trim();
    if (!provided || !timingSafeEqual(provided, secret)) {
      return json(401, { ok: false, description: 'unauthorized egress' });
    }
  }

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return json(400, { ok: false, description: 'bad request' });
  }

  const route = resolveBotRoute(url.pathname);
  if (!route) {
    return json(404, { ok: false, description: 'path not allowed' });
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json(405, { ok: false, description: 'method not allowed' });
  }

  const search = safeSearch(url.search);
  if (search === null) {
    return json(400, { ok: false, description: 'query not allowed' });
  }

  const upstream = upstreamUrl(route.token, route.method, search);
  if (!upstream) {
    return json(404, { ok: false, description: 'path not allowed' });
  }

  const upstreamHeaders: Record<string, string> = {};
  const accept = request.headers.get('Accept');
  if (accept && !/[\r\n\0]/.test(accept) && accept.length <= 200) {
    upstreamHeaders.Accept = accept.trim();
  }

  let bodyBytes: Uint8Array | undefined;
  if (request.method === 'POST') {
    const contentType = safeContentType(request.headers.get('Content-Type'));
    if (request.headers.get('Content-Type') && !contentType) {
      return json(400, { ok: false, description: 'content-type not allowed' });
    }
    const maxBody = deps.maxBodyBytes ?? MAX_EGRESS_BODY_BYTES;
    const declared = declaredLength(request);
    if (declared !== null && declared > maxBody) {
      return json(413, { ok: false, description: 'body too large' });
    }
    const capped = await readCappedBody(request.body, maxBody);
    if (!capped) {
      return json(413, { ok: false, description: 'body too large' });
    }
    if (capped.byteLength) {
      if (contentType) upstreamHeaders['Content-Type'] = contentType;
      upstreamHeaders['Content-Length'] = String(capped.byteLength);
      bodyBytes = capped;
    }
  }

  try {
    const upstreamRes = await fetchImpl(upstream.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: bodyBytes,
      redirect: 'manual',
      signal: upstreamSignal(deps.upstreamTimeoutMs ?? UPSTREAM_TIMEOUT_MS),
    });
    const contentType = safeContentType(upstreamRes.headers.get('Content-Type')) || 'application/octet-stream';
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: { 'Content-Type': contentType, ...corsHeaders() },
    });
  } catch (err: unknown) {
    const detail = redactBotSecrets(err instanceof Error ? err.message : String(err)).slice(0, 120);
    log(`telegram egress upstream failed: ${detail}`);
    return json(502, { ok: false, description: `upstream failed: ${detail}` });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleTelegramEgress(request, env);
  },
};
