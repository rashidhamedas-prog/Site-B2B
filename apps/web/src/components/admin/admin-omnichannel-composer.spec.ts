/**
 * npx tsx apps/web/src/components/admin/admin-omnichannel-composer.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canAdvanceComposerStep,
  selectedDestinationDefaults,
} from './admin-omnichannel-composer';

const src = readFileSync(join(__dirname, 'admin-omnichannel-composer.tsx'), 'utf8');
const admin = readFileSync(join(__dirname, 'AdminOmnichannel.tsx'), 'utf8');
const coverage = readFileSync(join(__dirname, 'admin-omnichannel-coverage.tsx'), 'utf8');

assert.match(src, /data-omni-composer/);
assert.match(src, /data-omni-composer-destinations/);
assert.match(src, /data-omni-composer-confirm-modal/);
assert.match(src, /selectedDestinationDefaults/);
assert.match(src, /هیچ‌کدام پیش‌فرض تیک نیست|هیچ مقصدی/);
assert.match(src, /composer\/plan/);
assert.match(src, /goRef/);
assert.doesNotMatch(src, /OMNICHANNEL_CONNECTORS_ENABLED\s*=\s*['"]true['"]/);
assert.match(admin, /AdminOmnichannelComposer/);
assert.match(admin, /composerUi|انتشار جدید/);
assert.match(coverage, /productId|انتشار جدا/);

const empty = selectedDestinationDefaults();
assert.equal(empty.size, 0, 'no default checked destination');

assert.equal(
  canAdvanceComposerStep({
    step: 2,
    productId: 'p1',
    freePost: false,
    freeCaption: '',
    selectedIds: new Set(),
    reason: '',
  }),
  false,
  'step 2 gated without destinations',
);
assert.equal(
  canAdvanceComposerStep({
    step: 2,
    productId: 'p1',
    freePost: false,
    freeCaption: '',
    selectedIds: new Set(['d1']),
    reason: '',
  }),
  true,
  'step 2 ok with destination',
);
assert.equal(
  canAdvanceComposerStep({
    step: 7,
    productId: 'p1',
    freePost: false,
    freeCaption: '',
    selectedIds: new Set(['d1']),
    reason: '',
  }),
  false,
  'confirm requires reason',
);
assert.equal(
  canAdvanceComposerStep({
    step: 7,
    productId: 'p1',
    freePost: false,
    freeCaption: '',
    selectedIds: new Set(['d1']),
    reason: 'canary',
  }),
  true,
  'confirm ok with reason',
);

console.log('admin-omnichannel-composer.spec.ts OK');
