import { readFileSync, writeFileSync } from 'node:fs';

const crawl = JSON.parse(readFileSync('.tmp-p03a/crawl-rows.json', 'utf8'));
const targets = JSON.parse(readFileSync('.tmp-p03a/target-probes.json', 'utf8'));
const sitemap = JSON.parse(readFileSync('.tmp-p03a/sitemap-probes.json', 'utf8'));
const report = JSON.parse(readFileSync('.tmp-p03a/report.json', 'utf8'));

const broken = crawl.filter((r) => r.owned === 'yes' && r.status && r.status !== 200);
const redirects = crawl.filter((r) => r.owned === 'yes' && r.hops > 0);
const retail = crawl.filter((r) => /\/retail/.test(`${r.target_raw}${r.target_url}`));
const com = crawl.filter((r) => /poshaktaranom\.com/.test(r.target_url || ''));
const non200t = targets.filter((t) => t.status !== 200);
const hops = targets.filter((t) => t.hops > 0);
const noidx = targets.filter((t) => /noindex/i.test(`${t.robots_meta || ''} ${t.x_robots_tag || ''}`));
const q = targets.filter((t) => t.target_url.includes('?'));
const canMismatch = sitemap.filter((s) => {
  const a = (s.canonical || '').replace(/\/$/, '');
  const b = (s.url || '').replace(/\/$/, '');
  return a && b && a !== b;
});
const thin = sitemap.filter((s) => s.word_count_main_content < 80);
const noh1 = sitemap.filter((s) => s.h1_count !== 1);
const noschema = sitemap.filter((s) => !s.schema_types);
const orphan = sitemap.filter((s) => s.internal_links_to_url === 0 && s.entity_type !== 'home');

const out = {
  crawl: crawl.length,
  brokenOwned: broken.map((r) => ({ src: r.source_page, t: r.target_url, st: r.status, hops: r.hops })),
  redirectOwned: [...new Set(redirects.map((r) => `${r.status} ${r.target_url} -> ${r.final_url}`))],
  retailLinks: [...new Set(retail.map((r) => `${r.source_page} -> ${r.target_url}`))],
  comLinks: [...new Set(com.map((c) => `${c.source_page} -> ${c.target_url}`))],
  non200Targets: non200t,
  hopTargets: hops,
  queryTargets: q.map((t) => ({
    u: t.target_url,
    st: t.status,
    h: t.hops,
    r: t.robots_meta,
    x: t.x_robots_tag,
    c: t.canonical,
  })),
  noindexTargets: noidx.map((t) => `${t.target_url} meta=${t.robots_meta} x=${t.x_robots_tag}`),
  canonicalMismatch: canMismatch.map((s) => ({ u: s.url, c: s.canonical })),
  thin: thin.map((s) => `${s.url} w=${s.word_count_main_content}`),
  h1: noh1.map((s) => `${s.url} h1=${s.h1_count}`),
  noSchema: noschema.map((s) => s.url),
  orphanSitemap: orphan.map((s) => `${s.url} type=${s.entity_type}`),
  seeds: report.seedPages,
};
writeFileSync('.tmp-p03a/analysis.json', JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      broken: out.brokenOwned.length,
      redirectUnique: out.redirectOwned,
      retailLinks: out.retailLinks,
      comLinks: out.comLinks,
      non200: non200t.map((t) => `${t.status} ${t.target_url}`),
      hops: hops.map((t) => `${t.hops} ${t.target_url} -> ${t.final_url}`),
      noindexCount: noidx.length,
      queryCount: q.length,
      canMismatch: out.canonicalMismatch,
      thinCount: thin.length,
      h1bad: noh1.length,
      noSchema: noschema.length,
      orphan: orphan.length,
    },
    null,
    2,
  ),
);
