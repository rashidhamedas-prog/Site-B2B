#!/usr/bin/env node
/**
 * SEO audit for Taranom storefronts.
 * Uses native fetch. Writes reports/seo-audit.md + reports/seo-audit.json.
 *
 * Usage:
 *   node scripts/seo-audit.mjs
 *   node scripts/seo-audit.mjs --skip-live
 *   API_URL=https://api.poshaktaranom.com/v1 node scripts/seo-audit.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const skipLive = args.includes('--skip-live');
const API_URL = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.poshaktaranom.com/v1').replace(
  /\/$/,
  '',
);
const RETAIL = 'https://www.poshaktaranom.ir';
const WHOLESALE = 'https://poshaktaranom.com';
const UA = 'TaranomSeoAudit/1.0 (+https://poshaktaranom.com)';

const pages = [
  { id: 'retail-home', url: `${RETAIL}/` },
  { id: 'retail-products', url: `${RETAIL}/products` },
  { id: 'wholesale-home', url: `${WHOLESALE}/` },
  { id: 'wholesale-products', url: `${WHOLESALE}/products` },
];

function pick(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : '';
}

function titles(html) {
  return pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
}

function h1s(html) {
  return [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim(),
  );
}

function canonical(html) {
  return pick(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    || pick(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
}

function locUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
}

const findings = [];
function add(check, status, detail, extra = {}) {
  findings.push({ check, status, detail, ...extra });
}

async function get(url, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': UA },
      signal: ctrl.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, finalUrl: res.url };
  } finally {
    clearTimeout(t);
  }
}

const crawled = [];
let liveSkipped = skipLive;

if (skipLive) {
  add('live-crawl', 'SKIPPED', 'Invoked with --skip-live; no storefront HTML fetched.');
} else {
  for (const page of pages) {
    try {
      const res = await get(page.url);
      const title = titles(res.text);
      const heading = h1s(res.text);
      const canon = canonical(res.text);
      crawled.push({
        id: page.id,
        url: page.url,
        httpStatus: res.status,
        title,
        h1: heading,
        canonical: canon,
      });
      add(`${page.id}/http`, res.ok ? 'PASS' : 'FAIL', `status=${res.status}`);
      add(`${page.id}/title`, title ? 'PASS' : 'FAIL', title || 'missing <title>');
      add(`${page.id}/h1`, heading.length === 1 ? 'PASS' : heading.length ? 'WARN' : 'FAIL', heading.join(' | ') || 'missing H1');
      add(`${page.id}/canonical`, canon ? 'PASS' : 'FAIL', canon || 'missing canonical');
    } catch (err) {
      liveSkipped = true;
      add(`${page.id}/fetch`, 'SKIPPED', `Live fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

const titleCounts = new Map();
for (const row of crawled) {
  if (!row.title) continue;
  titleCounts.set(row.title, (titleCounts.get(row.title) || 0) + 1);
}
for (const [title, count] of titleCounts) {
  add(
    'duplicate-title',
    count > 1 ? 'FAIL' : 'PASS',
    count > 1 ? `"${title}" used ${count} times in this crawl set` : `"${title}" unique in crawl set`,
  );
}

for (const origin of [RETAIL, WHOLESALE]) {
  const sitemapUrl = `${origin}/sitemap.xml`;
  try {
    const res = await get(sitemapUrl);
    if (!res.ok) {
      add(`sitemap/${origin}`, liveSkipped ? 'SKIPPED' : 'FAIL', `status=${res.status}`);
      continue;
    }
    const urls = locUrls(res.text);
    const withQuery = urls.filter((u) => u.includes('?'));
    add(
      `sitemap/${origin}/query-urls`,
      withQuery.length ? 'FAIL' : 'PASS',
      withQuery.length ? `${withQuery.length} loc URLs contain query strings` : 'no query-string loc URLs',
      { sample: withQuery.slice(0, 8) },
    );
  } catch (err) {
    add(
      `sitemap/${origin}`,
      'SKIPPED',
      `Sitemap fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

try {
  const res = await get(`${API_URL}/feeds/google-merchant.xml`);
  add(
    'google-merchant-feed',
    res.ok && res.text.includes('<rss') ? 'PASS' : res.status ? 'FAIL' : 'SKIPPED',
    `API_URL=${API_URL} status=${res.status} bytes=${res.text.length}`,
  );
} catch (err) {
  add(
    'google-merchant-feed',
    'SKIPPED',
    `API feed fetch failed: ${err instanceof Error ? err.message : String(err)}`,
  );
}

const summary = {
  generatedAt: new Date().toISOString(),
  liveSkipped,
  apiUrl: API_URL,
  counts: findings.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {}),
  crawled,
  findings,
};

const outDir = join(root, 'reports');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'seo-audit.json'), JSON.stringify(summary, null, 2), 'utf8');

const md = [
  '# SEO audit',
  '',
  `- Generated: ${summary.generatedAt}`,
  `- Live crawl skipped: ${liveSkipped ? 'yes' : 'no'}`,
  `- API_URL: ${API_URL}`,
  `- Counts: ${JSON.stringify(summary.counts)}`,
  '',
  '## Findings',
  '',
  '| Status | Check | Detail |',
  '| --- | --- | --- |',
  ...findings.map((f) => `| ${f.status} | ${f.check} | ${String(f.detail).replace(/\|/g, '\\|')} |`),
  '',
  liveSkipped
    ? 'Live HTML crawl was skipped or failed. Title/H1/canonical results above are incomplete; do not treat SKIPPED as PASS.'
    : 'Live HTML was fetched for the listed storefront URLs. This is a small sample, not a full catalog crawl.',
  '',
].join('\n');
writeFileSync(join(outDir, 'seo-audit.md'), md, 'utf8');

const failed = findings.filter((f) => f.status === 'FAIL').length;
console.log(md);
process.exit(failed ? 1 : 0);
