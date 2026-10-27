/**
 * npx tsx apps/web/src/components/admin/admin-omnichannel-health.spec.ts
 * Source-level + pure helpers (no React runtime required).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HEALTH_MISMATCH_BANNER_FA,
  healthStripTone,
  providerHealthCardTone,
  type OmnichannelHealthPayload,
} from './admin-omnichannel-health';

const src = readFileSync(join(__dirname, 'admin-omnichannel-health.tsx'), 'utf8');
const admin = readFileSync(join(__dirname, 'AdminOmnichannel.tsx'), 'utf8');

assert.match(src, /HEALTH_MISMATCH_BANNER_FA|تست موفق ولی ارسال واقعی ممکن است DEAD شود/);
assert.ok(
  HEALTH_MISMATCH_BANNER_FA.includes('DEAD') && HEALTH_MISMATCH_BANNER_FA.includes('ناهمخوانی'),
  'Persian mismatch banner warns that real send can DEAD',
);
assert.match(src, /وضعیت نامعلوم/);
assert.match(src, /data-omni-health-mismatch/);
assert.match(src, /never greens|هرگز.*سبز|unknown/i);
assert.match(admin, /AdminOmnichannelHealth/);
assert.match(admin, /omnichannel\/health/);

assert.equal(healthStripTone({ health: null, error: true }), 'unknown');
assert.equal(healthStripTone({ health: null, loading: true }), 'unknown');
assert.equal(healthStripTone({ health: null }), 'unknown');

const healthy: OmnichannelHealthPayload = {
  generatedAt: new Date().toISOString(),
  worker: { heartbeatAt: new Date().toISOString(), heartbeatAgeSec: 10, stale: false, drain: false },
  killSwitch: {
    api: { connectorsEnabled: true, disabledProviders: [] },
    worker: { connectorsEnabled: true, disabledProviders: [] },
    mismatch: false,
  },
  providers: [{
    provider: 'TELEGRAM',
    effectiveMode: 'LIVE',
    modeSource: 'destination',
    emergencyHold: false,
    killSwitchApi: false,
    killSwitchWorker: false,
    lastSuccessAt: null,
    lastError: null,
    countsToday: { retry: 0, dead: 0, hold: 0, stalled: 0 },
  }],
};
assert.equal(healthStripTone({ health: healthy }), 'ok');
assert.equal(
  healthStripTone({
    health: { ...healthy, killSwitch: { ...healthy.killSwitch, mismatch: true } },
  }),
  'danger',
);

assert.equal(providerHealthCardTone(null), 'unknown');
assert.equal(providerHealthCardTone(healthy.providers[0], { healthUnknown: true }), 'unknown');
assert.equal(
  providerHealthCardTone({ ...healthy.providers[0], killSwitchWorker: null }),
  'unknown',
);
assert.notEqual(providerHealthCardTone(null), 'ok');
assert.notEqual(healthStripTone({ health: null, error: true }), 'ok');

console.log('admin-omnichannel-health.spec.ts OK');
