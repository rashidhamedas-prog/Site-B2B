#!/usr/bin/env node
/**
 * SEO smoke audit — runs a fixed URL/behavior matrix against both storefronts
 * and reports PASS/FAIL per check. Non-zero exit on any failure.
 *
 * Usage:
 *   node scripts/seo/audit.mjs                       # live sites
 *   node scripts/seo/audit.mjs --base-com http://localhost:3000 --base-ir http://localhost:3000
 *     (with --host headers sent automatically per check)
 */

const args = process.argv.slice(2);
function flag(name, dflt) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : dflt;
}

const BASE_COM = flag('--base-com', 'https://poshaktaranom.com');
const BASE_IR = flag('--base-ir', 'https://www.poshaktaranom.ir');
const isLocal = BASE_COM.includes('localhost') || BASE_IR.includes('localhost');

const UA = 'TaranomSeoAudit/1.0 (+https://poshaktaranom.com)';
// Crawler UA: pages render blocking (htmlLimitedBots) so 404 statuses are real.
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

async function probe(base, path, hostHeader, { asBot = false } = {}) {
  const res = await fetch(`${base}${path}`, {
    redirect: 'manual',
    headers: {
      'user-agent': asBot ? BOT_UA : UA,
      ...(isLocal && hostHeader ? { host: hostHeader } : {}),
    },
  });
  const text = res.status >= 200 && res.status < 300 ? await res.text() : '';
  return { status: res.status, location: res.headers.get('location') || '', text, xRobots: res.headers.get('x-robots-tag') || '' };
}

function metaRobots(html) {
  const m = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
  return m ? m[1] : '';
}
function canonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const COM_HOST = 'poshaktaranom.com';
const IR_HOST = 'www.poshaktaranom.ir';

// ---- Wholesale (.com) ----
{
  const home = await probe(BASE_COM, '/', COM_HOST);
  check('com / is 200', home.status === 200, `status=${home.status}`);
  check('com / has no search_term_string placeholder', !home.text.includes('search_term_string'));
  check('com / canonical', canonical(home.text) === 'https://poshaktaranom.com', canonical(home.text));

  const search = await probe(BASE_COM, '/products?q=test', COM_HOST);
  check('com /products?q= noindex', metaRobots(search.text).includes('noindex'), metaRobots(search.text));

  // Policy: streamed shell (loading.tsx) fixes TTFB but pins status to 200,
  // so a missing product must carry noindex in <head> (404 also accepted).
  const missing = await probe(BASE_COM, '/products/definitely-missing-slug-404', COM_HOST, { asBot: true });
  check(
    'com missing product excluded (404 or noindex)',
    missing.status === 404 || metaRobots(missing.text).includes('noindex'),
    `status=${missing.status} robots=${metaRobots(missing.text)}`,
  );

  const shop = await probe(BASE_COM, '/shop/some-old-category', COM_HOST);
  check('com /shop/* → 301 /products', shop.status === 301 && /\/products$/.test(shop.location), `status=${shop.status} loc=${shop.location}`);

  // NOTE: asset extensions (.jpg etc.) bypass the middleware matcher and 404
  // naturally — probe an extension-less legacy path for the 410.
  const wp = await probe(BASE_COM, '/wp-content/themes/legacy', COM_HOST);
  check('com /wp-content/* is 410', wp.status === 410, `status=${wp.status}`);

  const feed = await probe(BASE_COM, '/comments/feed', COM_HOST);
  check('com legacy feed is 410', feed.status === 410, `status=${feed.status}`);

  const retailPath = await probe(BASE_COM, '/retail/products', COM_HOST);
  check(
    'com /retail/* → 301 retail origin',
    retailPath.status === 301 && retailPath.location.startsWith('https://www.poshaktaranom.ir'),
    `status=${retailPath.status} loc=${retailPath.location}`,
  );

  const robots = await probe(BASE_COM, '/robots.txt', COM_HOST);
  check('com robots.txt has sitemap', robots.text.includes('sitemap'), '');
}

// ---- Retail (.ir) ----
{
  const home = await probe(BASE_IR, '/', IR_HOST);
  check('ir / is 200', home.status === 200, `status=${home.status}`);
  check('ir / canonical', canonical(home.text) === 'https://www.poshaktaranom.ir', canonical(home.text));

  const collections = await probe(BASE_IR, '/collections', IR_HOST);
  check(
    'ir /collections canonical is /collections',
    canonical(collections.text) === 'https://www.poshaktaranom.ir/collections',
    canonical(collections.text),
  );

  const search = await probe(BASE_IR, '/products?q=test', IR_HOST);
  check('ir /products?q= noindex', metaRobots(search.text).includes('noindex'), metaRobots(search.text));

  const missing = await probe(BASE_IR, '/products/definitely-missing-slug-404', IR_HOST, { asBot: true });
  check(
    'ir missing product excluded (404 or noindex)',
    missing.status === 404 || metaRobots(missing.text).includes('noindex'),
    `status=${missing.status} robots=${metaRobots(missing.text)}`,
  );

  const notFound = await probe(BASE_IR, '/some-definitely-missing-page', IR_HOST);
  check('ir 404 page is noindex', notFound.status === 404, `status=${notFound.status}`);
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
