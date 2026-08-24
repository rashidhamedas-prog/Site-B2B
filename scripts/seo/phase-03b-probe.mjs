#!/usr/bin/env node
/** PHASE-03B live probe of exact GSC URLs. node scripts/seo/phase-03b-probe.mjs */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UA = 'TaranomPhase03BProbe/1.0';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.tmp-p03b');
mkdirSync(OUT_DIR, { recursive: true });

const WWW = 'https://www.poshaktaranom.ir';

/** Exact rows from PHASE-03B brief (GSC export 2026-08-24). Incomplete paste kept as note. */
const ROWS = [
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://www.poshaktaranom.ir/fonts/Vazirmatn-Bold.woff2' },
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://www.poshaktaranom.ir/_next/image?url=https://poshaktaranom.com/media/products/1785660477650-5136facc592ea.jpg&w=1920&q=75' },
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://www.poshaktaranom.ir/_next/image?url=https://poshaktaranom.com/media/products/1785661993661-df011b0d16fd5.jpg&w=1920&q=75' },
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://www.poshaktaranom.ir/_next/image?url=https://poshaktaranom.com/media/products/1785661680882-0f1c5cc19bd52.jpg&w=1920&q=75' },
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://www.poshaktaranom.ir/manifest.json' },
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://www.poshaktaranom.ir/_next/image?url=https://poshaktaranom.com/media/products/1785326795221-b16555e02a001.jpg&w=1920&q=75' },
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://www.poshaktaranom.ir/fonts/Vazirmatn-Regular.woff2' },
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://www.poshaktaranom.ir/_next/image?url=https://poshaktaranom.com/media/products/1785661253126-5646a837787c1.jpg&w=1920&q=75' },
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://www.poshaktaranom.ir/_next/image?url=https://poshaktaranom.com/media/products/1785659290880-f5a7185ba2c45.jpg&w=1920&q=75' },
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://poshaktaranom.ir/api/shop/product/catalog/' },
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://poshaktaranom.ir/api/' },
  { gsc_reason: 'Crawled - currently not indexed', url: 'https://poshaktaranom.ir/blog/feed/' },
  { gsc_reason: 'Not found (404)', url: `${WWW}/_next/static/media/c098cac0448557e8.p.woff2` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/_next/static/media/831abf37d56e5f7d.p.woff2` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/_next/static/media/6041bf25671dbd43.p.woff2` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/_next/static/media/f94d05c93b9a3732.p.woff2` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/productsجدیدترین‌ها` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/contactتماس` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/shippingارسال` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/&` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/collectionsکلکسیون‌ها` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/productsمانتو` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/$` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/tag/2%20%D8%B3%D8%A7%DB%8C%D8%B2/` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/category/17/${encodeURIComponent('کت-کتان')}/` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/tag/ENCODED_INCOMPLETE_EXPORT_ROW`, note: 'brief listed "encoded /tag/..." without the exact path; not invented' },
  { gsc_reason: 'Not found (404)', url: `${WWW}/product/152/${encodeURIComponent('مانتو-شومیزی-ترگل')}/?vid=1234` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/page/3/${encodeURIComponent('تماس-با-ما')}/` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/product/151/${encodeURIComponent('مانتو-شومیزی-ساغر')}/?vid=1221` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/category/20/` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/category/10` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/product/160/${encodeURIComponent('مانتو-شومیزی-سهند')}/?vid=1291` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/product/161/${encodeURIComponent('شلوار-ماهین')}/?vid=1299` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/category/20` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/cert-logo/1/` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/category/20/${encodeURIComponent('شلوار')}/` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/blog/${encodeURIComponent('معرفی')}/P52-${encodeURIComponent('اپل-واچ-3-معرفی-شد')}.html` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/a-b-c-d/` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/static/bEHf0138/2.0.0/` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/static/bEHf0137/2.0.0/` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/static/bEHf0136/2.0.0/` },
  { gsc_reason: 'Not found (404)', url: `${WWW}/product/59` },
  { gsc_reason: 'Duplicate without user-selected canonical', url: 'https://poshaktaranom.ir/blog/31-' + encodeURIComponent('معرفی') + '/feed/' },
  { gsc_reason: 'Blocked by robots.txt', url: 'https://www.poshaktaranom.ir/account' },
  { gsc_reason: '403', url: 'https://poshaktaranom.ir/uploads/' },
];

function canonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
  if (!m) return '';
  return m[0].match(/href=["']([^"']+)["']/i)?.[1] || '';
}
function metaRobots(html) {
  return [...html.matchAll(/<meta[^>]+name=["']robots["'][^>]*>/gi)]
    .map((t) => t[0].match(/content=["']([^"']+)["']/i)?.[1] || '')
    .filter(Boolean)
    .join('|');
}

async function probeOne(row) {
  if (row.note) {
    return {
      ...row,
      skipped: true,
      http_status: '',
      final_url: '',
      hops: [],
      content_type: '',
      canonical: '',
      robots_meta: '',
      x_robots_tag: '',
      error: row.note,
    };
  }
  const hops = [];
  let current = row.url;
  let lastStatus = 0;
  let contentType = '';
  let html = '';
  let xRobots = '';
  try {
    for (let i = 0; i < 8; i++) {
      const res = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': UA, accept: '*/*' },
      });
      lastStatus = res.status;
      contentType = res.headers.get('content-type') || '';
      xRobots = res.headers.get('x-robots-tag') || '';
      const loc = res.headers.get('location') || '';
      hops.push({ url: current, status: res.status, location: loc, content_type: contentType, x_robots_tag: xRobots });
      if (res.status >= 300 && res.status < 400 && loc) {
        current = new URL(loc, current).href;
        continue;
      }
      if (contentType.includes('text/html') || contentType.includes('xml') || contentType.includes('json')) {
        html = await res.text();
      } else {
        await res.arrayBuffer();
      }
      break;
    }
  } catch (err) {
    return {
      ...row,
      http_status: lastStatus || '',
      final_url: current,
      hops,
      content_type: contentType,
      canonical: '',
      robots_meta: '',
      x_robots_tag: xRobots,
      error: String(err?.message || err),
    };
  }
  return {
    ...row,
    http_status: lastStatus,
    final_url: current,
    hops,
    hop_count: Math.max(0, hops.length - 1),
    content_type: contentType,
    canonical: html ? canonical(html) : '',
    robots_meta: html ? metaRobots(html) : '',
    x_robots_tag: xRobots,
    body_snippet: html ? html.slice(0, 240).replace(/\s+/g, ' ') : '',
  };
}

function locRe() {
  return /<loc>\s*([^<]+?)\s*<\/loc>/g;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  return { status: res.status, type: res.headers.get('content-type') || '', text: await res.text(), final: res.url };
}

const MALFORMED = [
  '/productsجدیدترین‌ها',
  '/contactتماس',
  '/shippingارسال',
  '/collectionsکلکسیون‌ها',
  '/productsمانتو',
  '/&',
  '/$',
];

async function scanHome() {
  const page = await fetchText(`${WWW}/`);
  const hrefs = [...page.text.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const hits = MALFORMED.filter((p) => page.text.includes(p));
  const comMedia = [...page.text.matchAll(/poshaktaranom\.com\/media\/[^"' )\s]+/g)].map((m) => m[0]);
  const nextImage = [...page.text.matchAll(/\/_next\/image\?[^"' ]+/g)].map((m) => m[0]).slice(0, 20);
  const fontHrefs = hrefs.filter((h) => /font|woff/i.test(h));
  return {
    status: page.status,
    malformed_in_html: hits,
    com_media_count: comMedia.length,
    com_media_sample: [...new Set(comMedia)].slice(0, 8),
    next_image_sample: nextImage,
    font_hrefs: fontHrefs,
    has_products_href: hrefs.some((h) => h === '/products' || h.endsWith('/products')),
    footerish_hrefs: hrefs.filter((h) =>
      ['/products', '/collections', '/contact', '/shipping', '/account'].some((p) => h === p || h.endsWith(p)),
    ),
  };
}

async function sitemapLocs() {
  const index = await fetchText(`${WWW}/sitemap.xml`);
  const child = [...index.text.matchAll(locRe())].map((m) => m[1].replace(/&amp;/g, '&').trim());
  const all = [];
  for (const u of child) {
    if (u.endsWith('.xml')) {
      const xml = await fetchText(u);
      all.push(...[...xml.text.matchAll(locRe())].map((m) => m[1].replace(/&amp;/g, '&').trim()));
    } else {
      all.push(u);
    }
  }
  return { index_status: index.status, child_count: child.length, locs: all };
}

async function robotsTxt() {
  const r = await fetchText(`${WWW}/robots.txt`);
  return { status: r.status, text: r.text, account_disallow: /disallow:\s*\/account/i.test(r.text) };
}

async function extraTargets() {
  const extras = [
    `${WWW}/blog/feed.xml`,
    `${WWW}/category/women-pants`,
    `${WWW}/products/maserati-pants-mahin`,
    `${WWW}/products`,
    `${WWW}/contact`,
    `${WWW}/shipping`,
    `${WWW}/collections`,
    'https://poshaktaranom.com/media/products/1785660477650-5136facc592ea.jpg',
  ];
  const out = [];
  for (const url of extras) out.push(await probeOne({ gsc_reason: 'current-equivalent', url }));
  return out;
}

const probes = [];
for (const row of ROWS) probes.push(await probeOne(row));
const home = await scanHome();
const sitemap = await sitemapLocs();
const robots = await robotsTxt();
const extras = await extraTargets();

const sitemapSet = new Set(sitemap.locs);
for (const p of probes) {
  p.in_sitemap = sitemapSet.has(p.url) || sitemapSet.has(p.final_url);
}

const report = { probed_at: new Date().toISOString(), probes, home, sitemap: { ...sitemap, locs: sitemap.locs.length }, robots, extras };
writeFileSync(join(OUT_DIR, 'probes.json'), JSON.stringify(report, null, 2), 'utf8');
writeFileSync(join(OUT_DIR, 'probes-summary.json'), JSON.stringify(
  probes.map((p) => ({
    gsc_reason: p.gsc_reason,
    url: p.url,
    http_status: p.http_status,
    final_url: p.final_url,
    hop_count: p.hop_count || 0,
    content_type: p.content_type,
    canonical: p.canonical,
    robots_meta: p.robots_meta,
    x_robots_tag: p.x_robots_tag,
    in_sitemap: p.in_sitemap,
    error: p.error || '',
  })),
  null,
  2,
), 'utf8');
console.log(`wrote ${probes.length} probes to ${OUT_DIR}`);
console.log(JSON.stringify({ home_malformed: home.malformed_in_html, com_media: home.com_media_count, sitemap: sitemap.locs.length, robots_account: robots.account_disallow }, null, 2));
