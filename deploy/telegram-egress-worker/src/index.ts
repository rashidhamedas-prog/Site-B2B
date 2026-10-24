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

export type EgressDeps = {
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
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

  let body: ArrayBuffer | undefined;
  if (request.method === 'POST') {
    const contentType = safeContentType(request.headers.get('Content-Type'));
    if (request.headers.get('Content-Type') && !contentType) {
      return json(400, { ok: false, description: 'content-type not allowed' });
    }
    if (contentType) upstreamHeaders['Content-Type'] = contentType;
    body = await request.arrayBuffer();
  }

  try {
    const upstreamRes = await fetchImpl(upstream.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body: body && body.byteLength ? body : undefined,
      redirect: 'manual',
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
