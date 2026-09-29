/**
 * Cloudflare Worker: authenticated proxy to api.sms.ir
 *
 * Why: EU VPS (Hetzner) often cannot complete TLS to api.sms.ir; CF edge can.
 * Nest sets SMS_EGRESS_BASE_URL to this Worker and SMS_EGRESS_SECRET to match
 * the Worker secret EGRESS_SECRET.
 *
 * Allowed paths only: /v1/send/bulk, /v1/send/verify, /v1/credit, /v1/line
 */

const UPSTREAM = 'https://api.sms.ir';
const ALLOWED = new Set(['/v1/send/bulk', '/v1/send/verify', '/v1/credit', '/v1/line']);

export interface Env {
  EGRESS_SECRET: string;
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, x-api-key, x-taranom-egress-secret',
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const secret = String(env.EGRESS_SECRET || '').trim();
    if (!secret) {
      return json(503, { status: 0, message: 'egress secret not configured' });
    }
    const provided = String(request.headers.get('x-taranom-egress-secret') || '').trim();
    if (!provided || !timingSafeEqual(provided, secret)) {
      return json(401, { status: 0, message: 'unauthorized egress' });
    }

    const url = new URL(request.url);
    let path = url.pathname.replace(/\/+$/, '') || '/';
    // Accept both /v1/... and /... (Nest may call base+/send/bulk)
    if (!path.startsWith('/v1/')) {
      path = `/v1${path.startsWith('/') ? path : `/${path}`}`;
    }
    if (!ALLOWED.has(path)) {
      return json(404, { status: 0, message: 'path not allowed' });
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      return json(405, { status: 0, message: 'method not allowed' });
    }

    const apiKey = String(request.headers.get('x-api-key') || '').trim();
    if (!apiKey) {
      return json(400, { status: 0, message: 'x-api-key required' });
    }

    const upstreamHeaders: Record<string, string> = {
      Accept: request.headers.get('Accept') || 'application/json',
      'x-api-key': apiKey,
    };
    let body: ArrayBuffer | undefined;
    if (request.method === 'POST') {
      upstreamHeaders['Content-Type'] = 'application/json';
      body = await request.arrayBuffer();
    }

    try {
      const upstream = await fetch(`${UPSTREAM}${path}`, {
        method: request.method,
        headers: upstreamHeaders,
        body: body && body.byteLength ? body : undefined,
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
          ...corsHeaders(),
        },
      });
    } catch (err: any) {
      return json(502, {
        status: 0,
        message: `upstream failed: ${String(err?.message || err).slice(0, 120)}`,
      });
    }
  },
};
