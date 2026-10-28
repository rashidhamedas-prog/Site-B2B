/**
 * npx tsx apps/web/src/components/admin/admin-omnichannel-coverage.spec.ts
 * Source-level + pure helpers (no React runtime required).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cellLabel,
  cellTone,
  primaryDestByProvider,
  type CoverageCell,
} from './admin-omnichannel-coverage';

const src = readFileSync(join(__dirname, 'admin-omnichannel-coverage.tsx'), 'utf8');
const admin = readFileSync(join(__dirname, 'AdminOmnichannel.tsx'), 'utf8');

assert.match(src, /data-omni-coverage/);
assert.match(src, /data-omni-coverage-dup-badge|تکراری/);
assert.match(src, /data-omni-coverage-filter/);
assert.match(src, /وضعیت نامعلوم/);
assert.match(src, /gap_rubika_not_bale/);
assert.match(src, /ثبت دلیل/);
assert.match(src, /حذف نسخه‌های قدیمی/);
assert.match(admin, /AdminOmnichannelCoverage/);
assert.match(admin, /coverageUi|پوشش و تکرار/);

const live: CoverageCell = {
  state: 'live',
  liveCount: 1,
  messageIds: ['1'],
  deliveryIds: ['d'],
  sentAtTehran: '2026-10-28 12:00',
  updatedAtTehran: null,
  link: null,
  duplicateOf: [],
  absenceReason: null,
  missingKind: null,
};
const dup: CoverageCell = { ...live, liveCount: 2, duplicateOf: ['2'], messageIds: ['1', '2'] };

assert.equal(cellTone(null, true), 'info');
assert.equal(cellTone(dup), 'danger');
assert.equal(cellTone(live), 'ok');
assert.match(cellLabel(dup), /تکراری/);
assert.equal(cellLabel(null, true), 'نامعلوم');
assert.notEqual(cellTone(null, true), 'ok');

const cols = primaryDestByProvider([
  { destinationId: 'b', provider: 'BALE' },
  { destinationId: 't', provider: 'TELEGRAM' },
  { destinationId: 'r', provider: 'RUBIKA' },
]);
assert.equal(cols.TELEGRAM?.destinationId, 't');
assert.equal(cols.BALE?.destinationId, 'b');

console.log('admin-omnichannel-coverage.spec.ts OK');
