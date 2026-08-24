import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'SEO-IMPLEMENTATION-REPORTS');
const TMP = join(ROOT, '.tmp-p03a');
mkdirSync(OUT, { recursive: true });

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers, rows) {
  return [headers.join(','), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','))].join('\n') + '\n';
}

const sitemap = JSON.parse(readFileSync(join(TMP, 'sitemap-probes.json'), 'utf8'));
const crawl = JSON.parse(readFileSync(join(TMP, 'crawl-rows.json'), 'utf8'));
const targets = JSON.parse(readFileSync(join(TMP, 'target-probes.json'), 'utf8'));
const report = JSON.parse(readFileSync(join(TMP, 'report.json'), 'utf8'));
const analysis = JSON.parse(readFileSync(join(TMP, 'analysis.json'), 'utf8'));

const inlinks = new Map();
for (const row of crawl) {
  if (row.owned !== 'yes') continue;
  const t = (row.target_url || '').replace(/\/$/, '');
  inlinks.set(t, (inlinks.get(t) || 0) + 1);
}

const sitemapSet = new Set(sitemap.map((s) => s.url.replace(/\/$/, '')));

const extraUrls = [];

const invMap = new Map();
function putInv(row) {
  const key = row.url;
  if (!invMap.has(key)) invMap.set(key, row);
}

for (const s of sitemap) {
  putInv({
    url: s.url,
    source: 'sitemap',
    entity_type: s.entity_type,
    entity_id: s.entity_id || '',
    status_code: s.status_code,
    final_url: s.final_url,
    redirect_hops: s.redirect_hops,
    canonical: s.canonical,
    robots_meta: s.robots_meta,
    x_robots_tag: s.x_robots_tag,
    in_sitemap: 'yes',
    internal_links_to_url: inlinks.get(s.url.replace(/\/$/, '')) || s.internal_links_to_url || 0,
    index_intent: s.index_intent,
    notes: s.notes || '',
  });
}

for (const seed of report.seedPages) {
  const path = new URL(seed.url).pathname;
  let intent = 'INDEX';
  if (seed.status >= 300 && seed.status < 400) intent = 'REDIRECT';
  if (seed.status === 404 || seed.status === 410) intent = '404_GONE';
  if (/^\/(account|checkout)/.test(path)) intent = 'PRIVATE';
  if (/noindex/i.test(`${seed.robots} ${seed.xRobots}`) || path.startsWith('/retail')) intent = 'NOINDEX';
  if (seed.url.includes('?')) intent = /noindex/i.test(seed.robots) ? 'NOINDEX' : intent;
  putInv({
    url: seed.url,
    source: 'crawl_seed',
    entity_type: path.startsWith('/retail') ? 'retail_internal' : path.replace(/^\//, '') || 'home',
    entity_id: '',
    status_code: seed.status,
    final_url: seed.final,
    redirect_hops: seed.hops,
    canonical: seed.canonical,
    robots_meta: seed.robots,
    x_robots_tag: seed.xRobots,
    in_sitemap: sitemapSet.has(seed.url.replace(/\/$/, '')) ? 'yes' : 'no',
    internal_links_to_url: inlinks.get(seed.url.replace(/\/$/, '')) || 0,
    index_intent: intent,
    notes: seed.hops ? 'SEED_REDIRECT' : '',
  });
}

for (const hop of report.hostHops) {
  putInv({
    url: hop.start,
    source: 'host_matrix',
    entity_type: 'host',
    entity_id: '',
    status_code: Number(String(hop.chain).split(' ')[0]) || 301,
    final_url: hop.final,
    redirect_hops: Math.max(0, hop.hops - 1),
    canonical: hop.final,
    robots_meta: '',
    x_robots_tag: '',
    in_sitemap: hop.start.startsWith('https://www.') ? 'yes' : 'no',
    internal_links_to_url: 0,
    index_intent: hop.start === 'https://www.poshaktaranom.ir/' ? 'INDEX' : 'REDIRECT',
    notes: hop.chain,
  });
}

const invHeaders = [
  'url',
  'source',
  'entity_type',
  'entity_id',
  'status_code',
  'final_url',
  'redirect_hops',
  'canonical',
  'robots_meta',
  'x_robots_tag',
  'in_sitemap',
  'internal_links_to_url',
  'index_intent',
  'notes',
];
writeFileSync(join(OUT, 'PHASE-03A-URL-INVENTORY.csv'), toCsv(invHeaders, [...invMap.values()]));

const crawlHeaders = [
  'source_page',
  'anchor_text',
  'target_url',
  'status_code',
  'final_url',
  'canonical',
  'indexability',
  'owned',
  'hops',
];
const crawlOut = crawl.map((r) => ({
  source_page: r.source_page,
  anchor_text: r.anchor_text,
  target_url: r.target_url,
  status_code: r.status ?? '',
  final_url: r.final_url ?? '',
  canonical: r.canonical ?? '',
  indexability: /noindex/i.test(`${r.robots_meta || ''} ${r.x_robots_tag || ''}`)
    ? 'NOINDEX'
    : r.status === 200 && (r.hops || 0) === 0
      ? 'INDEXABLE'
      : r.hops > 0
        ? 'REDIRECT'
        : r.status === 404
          ? 'NOT_FOUND'
          : 'UNKNOWN',
  owned: r.owned,
  hops: r.hops ?? '',
}));
writeFileSync(join(OUT, 'PHASE-03A-INTERNAL-LINK-CRAWL.csv'), toCsv(crawlHeaders, crawlOut));

const redirectRows = [
  {
    source_url: 'http://poshaktaranom.ir/',
    status: 301,
    target_url: 'https://poshaktaranom.ir/',
    final_url: 'https://www.poshaktaranom.ir/',
    hops: 2,
    target_status: 301,
    target_canonical: 'https://www.poshaktaranom.ir',
    internal_links_to_source: 0,
    in_sitemap: 'no',
    classification: 'REDIRECT_CHAIN',
    action: 'COLLAPSE_TO_ONE_HOP_NGINX_REPO_ONLY_NOT_DEPLOYED',
  },
  {
    source_url: 'http://www.poshaktaranom.ir/',
    status: 301,
    target_url: 'https://www.poshaktaranom.ir/',
    final_url: 'https://www.poshaktaranom.ir/',
    hops: 1,
    target_status: 200,
    target_canonical: 'https://www.poshaktaranom.ir',
    internal_links_to_source: 0,
    in_sitemap: 'no',
    classification: 'EXPECTED_REDIRECT',
    action: 'KEEP',
  },
  {
    source_url: 'https://poshaktaranom.ir/',
    status: 301,
    target_url: 'https://www.poshaktaranom.ir/',
    final_url: 'https://www.poshaktaranom.ir/',
    hops: 1,
    target_status: 200,
    target_canonical: 'https://www.poshaktaranom.ir',
    internal_links_to_source: 0,
    in_sitemap: 'no',
    classification: 'EXPECTED_REDIRECT',
    action: 'KEEP',
  },
  {
    source_url: 'https://www.poshaktaranom.ir/search',
    status: 301,
    target_url: 'https://www.poshaktaranom.ir/products',
    final_url: 'https://www.poshaktaranom.ir/products',
    hops: 1,
    target_status: 200,
    target_canonical: 'https://www.poshaktaranom.ir/products',
    internal_links_to_source: crawl.filter((r) => r.target_url.includes('/search')).length,
    in_sitemap: 'no',
    classification: 'EXPECTED_REDIRECT',
    action: 'KEEP',
  },
  {
    source_url: 'https://www.poshaktaranom.ir/shop',
    status: 301,
    target_url: 'https://www.poshaktaranom.ir/products',
    final_url: 'https://www.poshaktaranom.ir/products',
    hops: 1,
    target_status: 200,
    target_canonical: 'https://www.poshaktaranom.ir/products',
    internal_links_to_source: crawl.filter((r) => /\/shop(\/|$)/.test(r.target_url || r.target_raw || '')).length,
    in_sitemap: 'no',
    classification: 'EXPECTED_REDIRECT',
    action: 'KEEP',
  },
];

writeFileSync(
  join(OUT, 'PHASE-03A-REDIRECT-MAP.csv'),
  toCsv(
    [
      'source_url',
      'status',
      'target_url',
      'final_url',
      'hops',
      'target_status',
      'target_canonical',
      'internal_links_to_source',
      'in_sitemap',
      'classification',
      'action',
    ],
    redirectRows,
  ),
);

const noindexRows = [
  {
    url_pattern: '/account*',
    actual_sample: 'https://www.poshaktaranom.ir/account',
    reason: 'private customer account',
    should_index: 'NO',
    current_signal: 'meta noindex,nofollow + robots.txt Disallow',
    robots_allowed: 'NO',
    in_sitemap: 'no',
    internally_linked: 'yes',
    action: 'KEEP_NOINDEX',
  },
  {
    url_pattern: '/checkout*',
    actual_sample: 'https://www.poshaktaranom.ir/checkout',
    reason: 'private checkout',
    should_index: 'NO',
    current_signal: 'layout robots index:false + robots.txt Disallow',
    robots_allowed: 'NO',
    in_sitemap: 'no',
    internally_linked: 'yes',
    action: 'KEEP_NOINDEX',
  },
  {
    url_pattern: '/admin/*',
    actual_sample: 'https://www.poshaktaranom.ir/admin',
    reason: 'admin',
    should_index: 'NO',
    current_signal: 'robots.txt Disallow /admin/',
    robots_allowed: 'NO',
    in_sitemap: 'no',
    internally_linked: 'no',
    action: 'KEEP_NOINDEX',
  },
  {
    url_pattern: '/products?*',
    actual_sample: 'https://www.poshaktaranom.ir/products?page=2',
    reason: 'filtered/paginated listing; canonical is /products',
    should_index: 'NO',
    current_signal: 'meta noindex,follow; canonical /products',
    robots_allowed: 'YES',
    in_sitemap: 'no',
    internally_linked: 'yes',
    action: 'KEEP_NOINDEX',
  },
  {
    url_pattern: '/retail/*',
    actual_sample: 'https://www.poshaktaranom.ir/retail/products',
    reason: 'internal App Router tree; Torob rewrite ping-pong if 301',
    should_index: 'NO',
    current_signal: 'middleware X-Robots-Tag noindex,nofollow; HTTP 200',
    robots_allowed: 'YES',
    in_sitemap: 'no',
    internally_linked: 'no_public_nav',
    action: 'KEEP_200_NOINDEX_DO_NOT_301',
  },
  {
    url_pattern: '/blog/search',
    actual_sample: 'https://www.poshaktaranom.ir/blog/search',
    reason: 'utility search',
    should_index: 'NO',
    current_signal: 'robots.txt Disallow',
    robots_allowed: 'NO',
    in_sitemap: 'no',
    internally_linked: 'unknown',
    action: 'KEEP_NOINDEX',
  },
];
writeFileSync(
  join(OUT, 'PHASE-03A-NOINDEX-MAP.csv'),
  toCsv(
    [
      'url_pattern',
      'actual_sample',
      'reason',
      'should_index',
      'current_signal',
      'robots_allowed',
      'in_sitemap',
      'internally_linked',
      'action',
    ],
    noindexRows,
  ),
);

const notFoundSeed = report.seedPages.find((s) => s.status === 404);
const four04 = [
  {
    url: notFoundSeed?.url || 'https://www.poshaktaranom.ir/this-page-does-not-exist-p03a',
    referenced_internally: 'no',
    referrer: '',
    matching_current_entity: '',
    semantic_replacement: '',
    backlink_signal_known: 'no',
    classification: 'LEGITIMATE_404',
    action: 'KEEP_404',
  },
  {
    url: 'GSC_NOT_FOUND_SET_33_URLS',
    referenced_internally: 'no_live_internal_404_refs',
    referrer: '',
    matching_current_entity: '',
    semantic_replacement: '',
    backlink_signal_known: 'no',
    classification: 'UNKNOWN_GSC_SAMPLE_REQUIRED',
    action: 'REQUEST_GSC_EXPORT',
  },
];
writeFileSync(
  join(OUT, 'PHASE-03A-404-MAP.csv'),
  toCsv(
    [
      'url',
      'referenced_internally',
      'referrer',
      'matching_current_entity',
      'semantic_replacement',
      'backlink_signal_known',
      'classification',
      'action',
    ],
    four04,
  ),
);

const candHeaders = [
  'url',
  'page_type',
  'status',
  'canonical',
  'in_sitemap',
  'word_count_main_content',
  'title',
  'meta_description',
  'h1_count',
  'internal_inlinks',
  'unique_images',
  'schema_types',
  'near_duplicate_candidate',
  'content_source',
  'last_modified',
  'flags',
];
const candidates = sitemap.map((s) => {
  const flags = [];
  if ((s.word_count_main_content || 0) < 80) flags.push('WORDCOUNT_UNRELIABLE_RSC');
  if (s.h1_count !== 1) flags.push('MISSING_OR_MULTI_H1');
  if ((inlinks.get(s.url.replace(/\/$/, '')) || 0) === 0 && s.entity_type !== 'home') {
    flags.push('LOW_INTERNAL_LINKS');
  }
  if (s.status_code === 200 && !/noindex/i.test(s.robots_meta) && s.redirect_hops === 0) {
    flags.push('TECHNICALLY_CLEAN');
  }
  return {
    url: s.url,
    page_type: s.entity_type,
    status: s.status_code,
    canonical: s.canonical,
    in_sitemap: 'yes',
    word_count_main_content: s.word_count_main_content,
    title: s.title,
    meta_description: '',
    h1_count: s.h1_count,
    internal_inlinks: inlinks.get(s.url.replace(/\/$/, '')) || 0,
    unique_images: '',
    schema_types: s.schema_types,
    near_duplicate_candidate: 'unknown_without_gsc_pair',
    content_source: 'live_html',
    last_modified: '',
    flags: flags.join('|'),
  };
});
writeFileSync(join(OUT, 'PHASE-03A-INDEXABILITY-CANDIDATES.csv'), toCsv(candHeaders, candidates));

const broken = crawl
  .filter((r) => r.owned === 'yes')
  .filter((r) => r.status && (r.status !== 200 || r.hops > 0 || /\/retail(\/|$)/.test(r.target_url || '')))
  .map((r) => ({
    source_page: r.source_page,
    target_url: r.target_url,
    status_code: r.status,
    hops: r.hops,
    final_url: r.final_url,
    issue:
      r.hops > 0 ? 'POINTS_AT_REDIRECT' : r.status === 404 ? 'POINTS_AT_404' : /\/retail/.test(r.target_url) ? 'INTERNAL_RETAIL_PATH' : 'NON_200',
    action: 'NONE_IN_PUBLIC_NAV_CRAWL',
  }));
writeFileSync(
  join(OUT, 'PHASE-03A-BROKEN-INTERNAL-LINKS.csv'),
  toCsv(['source_page', 'target_url', 'status_code', 'hops', 'final_url', 'issue', 'action'], broken),
);

const summary = {
  sitemapCount: sitemap.length,
  indexIntended: sitemap.filter((s) => s.index_intent === 'INDEX').length,
  intentionalNoindex: noindexRows.length,
  intentionalRedirects: redirectRows.filter((r) => r.classification === 'EXPECTED_REDIRECT').length,
  liveBrokenInternal: broken.length,
  liveBrokenFixed: 0,
  sitemapInvalidFound: sitemap.filter((s) => s.notes).length,
  sitemapInvalidFixed: 0,
  redirectChainsFound: 1,
  redirectChainsFixedRepo: 1,
  accidentalNoindex: 0,
  accidentalRobots: 0,
  live404Refs: crawl.filter((r) => r.owned === 'yes' && r.status === 404).length,
  crawledNotIndexedCandidates: sitemap.length,
};
writeFileSync(join(TMP, 'summary-numbers.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ inventory: invMap.size, crawl: crawlOut.length, broken: broken.length, summary }, null, 2));
