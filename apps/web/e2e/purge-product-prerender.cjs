/**
 * Drop build-time ISR output for product routes so the e2e server renders
 * them against the local mock. Compiled page.js modules stay in place.
 *
 * The Build web step still points API_INTERNAL_URL at production, and
 * /products is force-static, so the HTML baked during `next build` must not
 * be what Playwright sees.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const roots = [
  path.join(process.cwd(), '.next'),
  path.join(process.cwd(), '.next', 'standalone', 'apps', 'web', '.next'),
];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

let removed = 0;

for (const root of roots) {
  const serverApp = path.join(root, 'server', 'app');
  const files = [];
  walk(serverApp, files);
  for (const file of files) {
    const rel = file.slice(serverApp.length).split(path.sep).join('/');
    const base = path.basename(file);
    const onProductRoute = /(?:^|\/)products(?:\/|\.)/.test(rel);
    const cacheArtifact =
      /\.(html|rsc|meta|body)$/.test(base) ||
      base.endsWith('.segment.rsc') ||
      base === 'prefetch.rsc';
    if (!onProductRoute || !cacheArtifact) continue;
    // Never delete the route module itself.
    if (base.endsWith('.js') || base.endsWith('.json') || base.endsWith('.map')) continue;
    fs.rmSync(file, { force: true });
    removed += 1;
    console.log(`purged ${path.relative(process.cwd(), file)}`);
  }

  const fetchCache = path.join(root, 'cache', 'fetch-cache');
  if (fs.existsSync(fetchCache)) {
    fs.rmSync(fetchCache, { recursive: true, force: true });
    removed += 1;
    console.log(`purged ${path.relative(process.cwd(), fetchCache)}`);
  }
}

if (!removed) {
  console.log('purge-product-prerender: no product ISR artifacts found');
}
