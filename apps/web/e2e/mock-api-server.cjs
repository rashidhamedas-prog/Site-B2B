/**
 * Local catalog stand-in for product-card e2e.
 * Node http only — no extra dependencies.
 *
 *   node e2e/mock-api-server.cjs
 *   API_INTERNAL_URL=http://127.0.0.1:4010/v1
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.E2E_MOCK_API_PORT || 4010);
const HOST = '127.0.0.1';
const FIXTURES = path.join(__dirname, 'fixtures');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

const product = readJson('product.json');
const settings = readJson('settings-public.json');
const categories = readJson('categories.json');
const collections = readJson('collections.json');
const cms = readJson('cms-site-content.json');
const redirectMatch = readJson('redirect-match.json');

function listBody(url) {
  const relatedTo = url.searchParams.get('relatedTo');
  const limit = Math.max(1, Number(url.searchParams.get('limit') || 24) || 24);
  const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1);
  if (relatedTo) {
    return { data: [], meta: { page, limit, total: 0, totalPages: 1 } };
  }
  const rows = page === 1 ? [product] : [];
  return {
    data: rows,
    meta: { page, limit, total: 1, totalPages: 1 },
  };
}

/** Strip optional /api and /v1 prefixes so both server and browser bases match. */
function normalizePath(pathname) {
  let p = pathname.replace(/\/+$/, '') || '/';
  if (p.startsWith('/api/')) p = p.slice(4);
  if (p === '/v1') return '/';
  if (p.startsWith('/v1/')) p = p.slice(3);
  return p;
}

function resolve(method, url) {
  const p = normalizePath(url.pathname);

  if (method === 'GET' && (p === '/health' || p === '/')) {
    return { status: 200, body: { ok: true } };
  }

  if (method === 'GET' && p === '/products') {
    return { status: 200, body: listBody(url) };
  }

  const slug = p.match(/^\/products\/slug\/([^/]+)$/);
  if (method === 'GET' && slug) {
    const wanted = decodeURIComponent(slug[1]);
    if (wanted === product.slug) return { status: 200, body: product };
    return { status: 404, body: { message: 'not found' } };
  }

  const byId = p.match(/^\/products\/([^/]+)$/);
  if (byId && byId[1] !== 'slug') {
    if (method === 'GET' && byId[1] === product.id) return { status: 200, body: product };
    if (method === 'POST' && /\/view$/.test(p)) return { status: 204, body: null };
    const view = p.match(/^\/products\/([^/]+)\/view$/);
    if (method === 'POST' && view) return { status: 204, body: null };
    if (method === 'GET') return { status: 404, body: { message: 'not found' } };
  }

  if (method === 'POST' && /^\/products\/[^/]+\/view$/.test(p)) {
    return { status: 204, body: null };
  }

  if (method === 'GET' && p === '/settings/public') {
    return { status: 200, body: settings };
  }
  if (method === 'GET' && p === '/categories') {
    return { status: 200, body: categories };
  }
  if (method === 'GET' && p === '/collections') {
    return { status: 200, body: collections };
  }
  if (method === 'GET' && /^\/cms\/site-content\/[^/]+\/[^/]+$/.test(p)) {
    return { status: 200, body: cms };
  }
  if (method === 'GET' && p === '/blog/redirects/match') {
    return { status: 200, body: redirectMatch };
  }

  return null;
}

function send(res, status, body) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store',
  };
  if (status === 204 || body == null) {
    res.writeHead(status, headers);
    res.end();
    return;
  }
  headers['Content-Type'] = 'application/json; charset=utf-8';
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

  if (method === 'OPTIONS' || method === 'HEAD') {
    const hit = resolve('GET', url);
    if (!hit) {
      send(res, 404, { message: 'e2e mock has no fixture', path: url.pathname });
      return;
    }
    if (method === 'HEAD') {
      send(res, hit.status, null);
      return;
    }
    send(res, 204, null);
    return;
  }

  const hit = resolve(method, url);
  if (!hit) {
    console.error(`e2e-mock 404 ${method} ${url.pathname}${url.search}`);
    send(res, 404, { message: 'e2e mock has no fixture', path: url.pathname });
    return;
  }
  send(res, hit.status, hit.body);
});

server.listen(PORT, HOST, () => {
  console.log(`e2e mock api http://${HOST}:${PORT}/v1`);
});
