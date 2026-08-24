#!/usr/bin/env node
/** PHASE-03A live retail census. node scripts/seo/phase-03a-census.mjs */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://www.poshaktaranom.ir';
const UA = 'TaranomPhase03ACensus/1.0';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.tmp-p03a');
const CONCURRENCY = 5;
mkdirSync(OUT_DIR, { recursive: true });

const locRe = /<loc>\s*([^<]+?)\s*<\/loc>/g;
const locs = (xml) => [...xml.matchAll(locRe)].map((m) => m[1].replace(/&amp;/g, '&').trim());

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
function titleOf(html) {
  return html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
}
function h1Count(html) {
  return [...html.matchAll(/<h1\b/gi)].length;
}
function jsonLd(html) {
  const types = [];
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1]);
      const nodes = Array.isArray(data) ? data : [data];
      for (const n of nodes) {
        if (n?.['@type']) types.push(String(n['@type']));
        for (const g of n?.['@graph'] || []) if (g?.['@type']) types.push(String(g['@type']));
      }
    } catch {
      /* ignore */
    }
  }
  return [...new Set(types)].join('|');
}
function words(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html;
  const text = main
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(' ').length : 0;
}
function linksOf(html, pageUrl) {
  const out = [];
  for (const m of html.matchAll(/<a\b([^>]*)>/gi)) {
    const raw = m[1].match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) continue;
    const wrap = html.slice(m.index).match(/^<a\b[^>]*>([\s\S]*?)<\/a>/i);
    const anchor = (wrap ? wrap[1] : '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    try {
      out.push({ href: new URL(raw, pageUrl).href, raw, anchor });
    } catch {
      /* skip */
    }
  }
  return out;
}
function pageType(url) {
  try {
    const p = new URL(url).pathname.replace(/\/+$/, '') || '/';
    if (p === '/') return 'home';
    if (p === '/products') return 'products';
    if (p.startsWith('/products/')) return 'pdp';
    if (p.startsWith('/category/')) return 'category';
    if (p === '/blog') return 'blog_index';
    if (p.startsWith('/blog/')) return 'blog';
    if (p.startsWith('/retail')) return 'retail_internal';
    if (/^\/(account|checkout|admin|portal|login)/.test(p)) return 'private';
    return 'page';
  } catch {
    return 'unknown';
  }
}
function intent({ status, robots, pathname }) {
  const r = String(robots || '').toLowerCase();
  if (status === 404 || status === 410) return '404_GONE';
  if (status >= 300 && status < 400) return 'REDIRECT';
  if (/^\/(account|checkout|admin|portal|login)/.test(pathname)) return 'PRIVATE';
  if (/noindex/.test(r) || pathname.startsWith('/retail')) return 'NOINDEX';
  if (status === 200) return 'INDEX';
  return 'UNKNOWN';
}

async function fetchOnce(url) {
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': UA, accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
  });
  const headers = {};
  res.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  let body = '';
  try {
    body = await res.text();
  } catch {
    body = '';
  }
  return { status: res.status, location: headers.location || '', xRobots: headers['x-robots-tag'] || '', body };
}

async function follow(url, max = 6) {
  const hops = [];
  let current = url;
  let last = { status: 0, location: '', xRobots: '', body: '' };
  for (let i = 0; i < max; i += 1) {
    last = await fetchOnce(current);
    hops.push({ url: current, status: last.status, location: last.location, xRobots: last.xRobots });
    if (last.status >= 300 && last.status < 400 && last.location) {
      current = new URL(last.location, current).href;
      continue;
    }
    break;
  }
  return { ...last, url: current, hops };
}

async function poolMap(items, fn) {
  const out = new Array(items.length);
  let i = 0;
  const n = Math.min(CONCURRENCY, items.length || 1);
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i;
        i += 1;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

const report = { fetchedAt: new Date().toISOString(), hostHops: [], seedPages: [], errors: [] };

for (const u of [
  'http://poshaktaranom.ir/',
  'http://www.poshaktaranom.ir/',
  'https://poshaktaranom.ir/',
  'https://www.poshaktaranom.ir/',
]) {
  try {
    const f = await follow(u);
    report.hostHops.push({
      start: u,
      hops: f.hops.length,
      chain: f.hops.map((h) => `${h.status} ${h.url} -> ${h.location || '(final)'}`).join(' | '),
      final: f.url,
      finalStatus: f.status,
    });
    console.log(`HOST ${u} hops=${f.hops.length} final=${f.status} ${f.url}`);
  } catch (e) {
    report.errors.push(`host ${u}: ${e.message}`);
    console.error(`HOST FAIL ${u}`, e.message);
  }
}

try {
  const robots = await fetchOnce(`${ORIGIN}/robots.txt`);
  writeFileSync(join(OUT_DIR, 'robots.txt'), robots.body);
  console.log('robots.txt', robots.status, robots.body.length);
} catch (e) {
  report.errors.push(`robots: ${e.message}`);
}

const sm = await fetchOnce(`${ORIGIN}/sitemap.xml`);
writeFileSync(join(OUT_DIR, 'sitemap-index.xml'), sm.body);
console.log('sitemap index', sm.status);
const children = locs(sm.body);
const allLocs = [];
for (const child of children) {
  const { body } = await fetchOnce(child);
  writeFileSync(join(OUT_DIR, child.split('/').pop() || 'child.xml'), body);
  const found = locs(body);
  console.log(child, found.length);
  for (const loc of found) allLocs.push({ loc, source: child });
}
const unique = [];
const seen = new Set();
for (const row of allLocs) {
  if (seen.has(row.loc)) continue;
  seen.add(row.loc);
  unique.push(row);
}

const sitemapProbes = await poolMap(unique, async ({ loc, source }, idx) => {
  const f = await follow(loc);
  const html = f.body || '';
  const robotsMeta = metaRobots(html);
  const xRobots = f.xRobots || f.hops.at(-1)?.xRobots || '';
  const firstStatus = f.hops[0]?.status || f.status;
  const notes = [];
  if (firstStatus !== 200) notes.push('SITEMAP_NON_200');
  if (f.hops.length > 1) notes.push('SITEMAP_REDIRECT');
  if (/noindex/i.test(`${robotsMeta} ${xRobots}`)) notes.push('SITEMAP_NOINDEX');
  if (!loc.startsWith(`${ORIGIN}/`) && loc !== ORIGIN && loc !== `${ORIGIN}/`) notes.push('WRONG_HOST');
  const row = {
    url: loc,
    source,
    entity_type: pageType(loc),
    entity_id: '',
    status_code: firstStatus,
    final_url: f.url,
    redirect_hops: Math.max(0, f.hops.length - 1),
    canonical: canonical(html),
    robots_meta: robotsMeta,
    x_robots_tag: xRobots,
    in_sitemap: 'yes',
    internal_links_to_url: 0,
    index_intent: intent({ status: firstStatus, robots: `${robotsMeta} ${xRobots}`, pathname: new URL(loc).pathname }),
    notes: notes.join(';'),
    title: titleOf(html),
    h1_count: h1Count(html),
    word_count_main_content: words(html),
    schema_types: jsonLd(html),
  };
  console.log(`[sitemap ${idx + 1}/${unique.length}] ${row.status_code} hops=${row.redirect_hops} ${loc}`);
  return row;
});

const extraPdp = unique.filter((r) => pageType(r.loc) === 'pdp').slice(0, 3).map((r) => new URL(r.loc).pathname);
const extraBlog = unique.filter((r) => pageType(r.loc) === 'blog').slice(0, 2).map((r) => new URL(r.loc).pathname);
const crawlSeeds = [
  ...new Set([
    '/',
    '/products',
    '/products?page=2',
    '/products?sort=price',
    '/products?q=%D9%85%D8%A7%D9%86%D8%AA%D9%88',
    '/category/shomiz',
    '/blog',
    '/about',
    '/contact',
    '/shipping',
    '/returns',
    '/collections',
    '/account',
    '/checkout',
    '/search',
    '/shop',
    '/retail',
    '/retail/products',
    '/this-page-does-not-exist-p03a',
    ...extraPdp,
    ...extraBlog,
  ]),
];

const crawlRows = [];
const inlinkCounts = new Map();
const discovered = [];

for (const path of crawlSeeds) {
  const pageUrl = path.startsWith('http') ? path : `${ORIGIN}${path}`;
  try {
    const f = await follow(pageUrl);
    const html = f.body || '';
    const links = f.status === 200 ? linksOf(html, f.url) : [];
    report.seedPages.push({
      url: pageUrl,
      final: f.url,
      status: f.hops[0]?.status || f.status,
      hops: Math.max(0, f.hops.length - 1),
      canonical: canonical(html),
      robots: metaRobots(html),
      xRobots: f.xRobots,
      linkCount: links.length,
    });
    console.log(
      `SEED ${f.hops[0]?.status || f.status} hops=${Math.max(0, f.hops.length - 1)} ${pageUrl} -> ${f.url} links=${links.length}`,
    );
    for (const link of links) {
      let host = '';
      try {
        host = new URL(link.href).host;
      } catch {
        host = '';
      }
      const owned = [
        'www.poshaktaranom.ir',
        'poshaktaranom.ir',
        'poshaktaranom.com',
        'www.poshaktaranom.com',
      ].includes(host);
      const target = link.href.split('#')[0];
      inlinkCounts.set(target, (inlinkCounts.get(target) || 0) + 1);
      crawlRows.push({
        source_page: pageUrl,
        source_final: f.url,
        anchor_text: link.anchor,
        target_raw: link.raw,
        target_url: target,
        owned: owned ? 'yes' : 'no',
      });
      if (owned) discovered.push(target);
    }
  } catch (e) {
    report.errors.push(`seed ${pageUrl}: ${e.message}`);
    console.error('SEED FAIL', pageUrl, e.message);
  }
}

const ownedTargets = [...new Set(discovered)];
const targetProbes = await poolMap(ownedTargets, async (url, idx) => {
  const f = await follow(url);
  const html = f.body || '';
  const first = f.hops[0] || { status: f.status };
  if (idx % 15 === 0) console.log(`[target ${idx + 1}/${ownedTargets.length}] ${first.status} ${url}`);
  return {
    target_url: url,
    status: first.status,
    final_url: f.url,
    hops: Math.max(0, f.hops.length - 1),
    canonical: canonical(html),
    robots_meta: metaRobots(html),
    x_robots_tag: f.xRobots,
  };
});

const probeByUrl = new Map(targetProbes.map((p) => [p.target_url, p]));
for (const row of crawlRows) Object.assign(row, probeByUrl.get(row.target_url) || {});
for (const row of sitemapProbes) row.internal_links_to_url = inlinkCounts.get(row.url) || 0;

writeFileSync(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(join(OUT_DIR, 'sitemap-probes.json'), JSON.stringify(sitemapProbes, null, 2));
writeFileSync(join(OUT_DIR, 'crawl-rows.json'), JSON.stringify(crawlRows, null, 2));
writeFileSync(join(OUT_DIR, 'target-probes.json'), JSON.stringify(targetProbes, null, 2));

console.log(
  JSON.stringify(
    {
      sitemapCount: sitemapProbes.length,
      sitemapNon200: sitemapProbes.filter((r) => r.status_code !== 200).length,
      sitemapRedirects: sitemapProbes.filter((r) => r.redirect_hops > 0).length,
      sitemapNoindex: sitemapProbes.filter((r) =>
        /noindex/i.test(`${r.robots_meta} ${r.x_robots_tag}`),
      ).length,
      crawlLinks: crawlRows.length,
      ownedTargets: ownedTargets.length,
      hostHops: report.hostHops,
      errors: report.errors,
    },
    null,
    2,
  ),
);
