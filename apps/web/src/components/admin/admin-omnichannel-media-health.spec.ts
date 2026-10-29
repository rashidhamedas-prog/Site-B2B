/**
 * npx tsx apps/web/src/components/admin/admin-omnichannel-media-health.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  mediaIssueLabelFa,
  mediaIssueTone,
  productReplaceHref,
} from './admin-omnichannel-media-health';

const src = readFileSync(join(__dirname, 'admin-omnichannel-media-health.tsx'), 'utf8');
const admin = readFileSync(join(__dirname, 'AdminOmnichannel.tsx'), 'utf8');

assert.match(src, /data-omni-media-health/);
assert.match(src, /data-omni-media-scan/);
assert.match(src, /هنوز اسکن نشده/);
assert.match(src, /JPEG ناقص/);
assert.match(src, /canScan/);
assert.match(src, /media\/scan/);
assert.match(src, /media\/health/);
assert.doesNotMatch(src, /OMNICHANNEL_CONNECTORS_ENABLED\s*=\s*['"]true['"]/);
assert.doesNotMatch(src, /TELEGRAM_API_URL/);

assert.match(admin, /AdminOmnichannelMediaHealth/);
assert.match(admin, /mediaHealthUi|رسانه/);
assert.match(admin, /media-health/);

assert.equal(mediaIssueLabelFa('truncated'), 'JPEG ناقص (بدون EOI)');
assert.equal(mediaIssueTone('truncated'), 'danger');
assert.equal(mediaIssueTone('ok'), 'ok');
assert.equal(productReplaceHref('p1'), '/admin/products/p1');
assert.equal(productReplaceHref(null), null);

// Viewer: scan button gated by canScan prop
assert.match(src, /canScan \? \(/);

console.log('admin-omnichannel-media-health.spec.ts OK');
