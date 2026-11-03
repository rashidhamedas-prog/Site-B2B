'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.E2E_PRODUCT_VIDEO_API_PORT || 4014);
const baseProduct = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'product.json'), 'utf8'),
);
const video = {
  mp4_720: 'http://127.0.0.1:3104/video/product-720.mp4',
  mp4_480: 'http://127.0.0.1:3104/video/product-480.mp4',
  webm_720: 'http://127.0.0.1:3104/video/product-720.webm',
  poster: 'http://127.0.0.1:3104/video/poster.webp',
  duration_sec: 12,
  width: 720,
  height: 960,
  sort_order: 2,
  upload_date: '2026-11-03T08:00:00.000Z',
};

function productFor(slug) {
  const noVideo = slug === 'no-video';
  return {
    ...baseProduct,
    id: noVideo ? 'prod-e2e-no-video' : 'prod-e2e-video',
    slug,
    name: noVideo ? 'مانتو بدون ویدیو' : 'مانتو آزمون ویدیو',
  };
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body == null ? '' : JSON.stringify(body));
}

http
  .createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    const pathname = url.pathname.replace(/^\/v1/, '');
    const slugMatch = pathname.match(/^\/products\/slug\/([^/]+)$/);
    const videoMatch = pathname.match(/^\/products\/([^/]+)\/video\/public$/);

    if (req.method === 'GET' && pathname === '/health') return send(res, 200, { ok: true });
    if (req.method === 'GET' && slugMatch) {
      const slug = decodeURIComponent(slugMatch[1]);
      if (slug === 'video-product' || slug === 'no-video') {
        return send(res, 200, productFor(slug));
      }
    }
    if (req.method === 'GET' && videoMatch) {
      return send(res, 200, videoMatch[1] === 'prod-e2e-video' ? video : null);
    }
    if (req.method === 'GET' && pathname === '/products') {
      return send(res, 200, { data: [], meta: { page: 1, limit: 4, total: 0, totalPages: 1 } });
    }
    if (req.method === 'POST' && /^\/products\/[^/]+\/view$/.test(pathname)) {
      res.writeHead(204);
      return res.end();
    }
    if (req.method === 'GET' && pathname === '/settings/public') return send(res, 200, {});
    if (req.method === 'GET' && pathname === '/blog/redirects/match') return send(res, 404, {});
    return send(res, 404, { message: 'not found', path: pathname });
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`product-video mock api http://127.0.0.1:${port}/v1`);
  });
