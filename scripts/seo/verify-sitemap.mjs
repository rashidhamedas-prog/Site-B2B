#!/usr/bin/env node
/**
 * Sitemap verifier — fetches a sitemap, validates every URL:
 *   - no duplicates, no query strings
 *   - every URL responds 200 (no redirect)
 *   - no robots noindex (meta or X-Robots-Tag)
 *   - canonical (if present) points to the URL itself
 * Writes SEO-SITEMAP-VALIDATION.csv and exits non-zero on any failure.
 *
 * Usage:
 *   node scripts/seo/verify-sitemap.mjs https://poshaktaranom.com/sitemap.xml
 *   node scripts/seo/verify-sitemap.mjs https://www.poshaktaranom.ir/sitemap.xml --out SEO-SITEMAP-VALIDATION-IR.csv
 *   node scripts/seo/verify-sitemap.mjs http://localhost:3000/sitemap.xml --host poshaktaranom.com
 */

import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const sitemapUrl = args.find((a) => !a.startsWith('--'));
const outFlagIdx = args.indexOf('--out');
const outFile = outFlagIdx !== -1 ? args[outFlagIdx + 1] : 'SEO-SITEMAP-VALIDATION.csv';
const hostFlagIdx = args.indexOf('--host');
const hostOverride = hostFlagIdx !== -1 ? args[hostFlagIdx + 1] : null;
const CONCURRENCY = 6;

if (!sitemapUrl) {
  console.error('Usage: node scripts/seo/verify-sitemap.mjs <sitemap-url> [--out file.csv] [--host host-header]');
  process.exit(2);
}

const UA = 'TaranomSeoVerifier/1.0 (+https://poshaktaranom.com)';

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, ...(hostOverride ? { host: hostOverride } : {}) },
    redirect: 'manual',
  });
  return { res, text: res.status >= 200 && res.status < 300 ? await res.text() : '' };
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) =>
    m[1].replace(/&amp;/g, '&'),
  );
}

function extractCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
  if (!m) return null;
  const href = m[0].match(/href=["']([^"']+)["']/i);
  return href ? href[1] : null;
}

function extractMetaRobots(html) {
  const tags = [...html.matchAll(/<meta[^>]+name=["']robots["'][^>]*>/gi)];
  return tags
    .map((t) => {
      const c = t[0].match(/content=["']([^"']+)["']/i);
      return c ? c[1] : '';
    })
    .filter(Boolean);
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function checkUrl(url) {
  const row = {
    url,
    status: '',
    redirect_location: '',
    noindex: '',
    canonical: '',
    canonical_ok: '',
    problems: [],
  };
  try {
    const target = hostOverride
      ? url.replace(/^https?:\/\/[^/]+/, new URL(sitemapUrl).origin)
      : url;
    const res = await fetch(target, {
      headers: { 'user-agent': UA, ...(hostOverride ? { host: hostOverride } : {}) },
      redirect: 'manual',
    });
    row.status = res.status;
    if (res.status >= 300 && res.status < 400) {
      row.redirect_location = res.headers.get('location') || '';
      row.problems.push('REDIRECT');
    } else if (res.status !== 200) {
      row.problems.push(`STATUS_${res.status}`);
    }
    const xRobots = res.headers.get('x-robots-tag') || '';
    if (/noindex/i.test(xRobots)) {
      row.noindex = `header:${xRobots}`;
      row.problems.push('NOINDEX_HEADER');
    }
    if (res.status === 200 && /text\/html/i.test(res.headers.get('content-type') || '')) {
      const html = await res.text();
      const robotsMetas = extractMetaRobots(html);
      if (robotsMetas.some((c) => /noindex/i.test(c))) {
        row.noindex = (row.noindex ? row.noindex + ' ' : '') + `meta:${robotsMetas.join('|')}`;
        row.problems.push('NOINDEX_META');
      }
      const canonical = extractCanonical(html);
      row.canonical = canonical || '';
      if (canonical) {
        const norm = (u) => u.replace(/\/+$/, '');
        row.canonical_ok = norm(canonical) === norm(url) ? 'yes' : 'no';
        if (row.canonical_ok === 'no') row.problems.push('CANONICAL_MISMATCH');
      } else {
        row.problems.push('CANONICAL_MISSING');
      }
    }
  } catch (err) {
    row.status = 'ERROR';
    row.problems.push(`FETCH_ERROR:${err.message}`);
  }
  return row;
}

async function main() {
  console.log(`Fetching sitemap: ${sitemapUrl}`);
  const { res, text } = await fetchText(sitemapUrl);
  if (res.status !== 200) {
    console.error(`Sitemap fetch failed: HTTP ${res.status}`);
    process.exit(1);
  }
  let urls = extractLocs(text);

  // sitemap index support
  if (/<sitemapindex/i.test(text)) {
    const children = urls;
    urls = [];
    for (const child of children) {
      const { text: childXml } = await fetchText(child);
      urls.push(...extractLocs(childXml));
    }
  }

  console.log(`Found ${urls.length} URLs`);
  const structuralProblems = [];

  const seen = new Set();
  for (const u of urls) {
    if (seen.has(u)) structuralProblems.push(`DUPLICATE: ${u}`);
    seen.add(u);
    if (u.includes('?')) structuralProblems.push(`QUERY_STRING: ${u}`);
    if (/%7B|\{/.test(u)) structuralProblems.push(`PLACEHOLDER: ${u}`);
  }

  const rows = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const row = await checkUrl(urls[idx]);
      rows[idx] = row;
      const flag = row.problems.length ? ` !! ${row.problems.join(',')}` : '';
      console.log(`[${idx + 1}/${urls.length}] ${row.status} ${urls[idx]}${flag}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const header = 'url,status,redirect_location,noindex,canonical,canonical_ok,problems';
  const csv = [
    header,
    ...rows.map((r) =>
      [r.url, r.status, r.redirect_location, r.noindex, r.canonical, r.canonical_ok, r.problems.join(';')]
        .map(csvEscape)
        .join(','),
    ),
  ].join('\n');
  writeFileSync(outFile, csv, 'utf8');
  console.log(`\nWrote ${outFile}`);

  const failures = rows.filter((r) => r.problems.length > 0);
  if (structuralProblems.length) {
    console.error('\nStructural problems:');
    for (const p of structuralProblems) console.error(`  ${p}`);
  }
  if (failures.length) {
    console.error(`\n${failures.length}/${rows.length} URLs failed validation:`);
    for (const f of failures) console.error(`  ${f.url} -> ${f.problems.join(',')}`);
  }
  if (failures.length || structuralProblems.length) process.exit(1);
  console.log('\nAll sitemap URLs valid.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
