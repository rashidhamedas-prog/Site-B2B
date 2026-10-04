/**
 * OtpService resend-cooldown contract: remaining seconds on both the Redis and
 * the in-memory fallback path (no Nest bootstrap, no real Redis).
 * Prefer: npx ts-node --transpile-only src/modules/redis/otp-cooldown.spec.ts
 */
import * as assert from 'node:assert/strict';
import { OtpCooldownError, OtpService } from './redis.module';

const config = {
  get(key: string, fallback?: unknown) {
    if (key === 'OTP_RESEND_COOLDOWN_SECONDS') return 60;
    if (key === 'OTP_SALES_PARTNER_RESEND_COOLDOWN_SECONDS') return 120;
    if (key === 'OTP_TTL_SECONDS') return 300;
    return fallback;
  },
} as any;

function memoryOnlyService() {
  const redis = {
    isReady: false,
    async get() { return null; },
    async setex() { return false; },
    async del() { /* noop */ },
    async pttl() { return null; },
    async setNxEx() { return false; },
  } as any;
  return new OtpService(redis, config);
}

function redisService(pttlSeconds: number | null, firstWriterWins: boolean) {
  const redis = {
    isReady: true,
    async get() { return null; },
    async setex() { return true; },
    async del() { /* noop */ },
    async pttl() { return pttlSeconds; },
    async setNxEx() { return firstWriterWins; },
  } as any;
  return new OtpService(redis, config);
}

async function main() {
  const fresh = memoryOnlyService();
  assert.equal(fresh.ttlSeconds(), 600, 'legacy 300s OTP lifetime is lifted to 10 minutes');
  assert.equal(fresh.cooldownSeconds(), 60, 'public cooldown window');
  assert.equal(fresh.cooldownSeconds('sales_partner_apply'), 120, 'sales-partner apply cooldown');
  assert.equal(fresh.cooldownSeconds('sales_partner'), 120, 'sales-partner login cooldown');
  assert.equal(await fresh.getCooldownRemaining('09121234567'), 0, 'no wait before first issue');

  const spIssued = await fresh.issue('09120001111', 'SP', 'sales_partner_apply');
  assert.match(spIssued.code, /^\d{6}$/, 'sp six digit code');
  const spRemaining = await fresh.getCooldownRemaining('09120001111', 'sales_partner_apply');
  assert.ok(spRemaining > 110 && spRemaining <= 120, `sp cooldown remaining (got ${spRemaining})`);
  assert.equal(
    await fresh.verify('09120001111', spIssued.code.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!), 'sales_partner_apply').then(() => 'ok'),
    'ok',
    'persian OTP digits verify',
  );

  const issued = await fresh.issue('09121234567');
  assert.match(issued.code, /^\d{6}$/, 'six digit code');

  const remaining = await fresh.getCooldownRemaining('09121234567');
  assert.ok(remaining > 55 && remaining <= 60, `memory fallback remaining (got ${remaining})`);
  assert.equal(await fresh.getCooldownRemaining('09129999999'), 0, 'cooldown is per phone');
  assert.equal(
    await fresh.getCooldownRemaining('09121234567', 'password_reset'),
    0,
    'cooldown is per purpose',
  );

  const blocked = await fresh.issue('09121234567').then(
    () => null,
    (err: unknown) => err,
  );
  assert.ok(blocked instanceof OtpCooldownError, 'resend inside window throws OtpCooldownError');
  assert.ok(
    (blocked as OtpCooldownError).remainingSeconds > 0,
    'memory cooldown error carries remaining seconds',
  );

  const onCooldown = redisService(23, false);
  const redisBlocked = await onCooldown.issue('09121234567').then(
    () => null,
    (err: unknown) => err,
  );
  assert.ok(redisBlocked instanceof OtpCooldownError, 'redis cooldown throws OtpCooldownError');
  assert.equal((redisBlocked as OtpCooldownError).remainingSeconds, 23, 'PTTL drives remaining');

  // PTTL raced to expiry: fall back to the full window rather than reporting 0.
  const raced = redisService(0, false);
  const racedErr = await raced.issue('09121234567').then(() => null, (err: unknown) => err);
  assert.equal((racedErr as OtpCooldownError).remainingSeconds, 60, 'expired PTTL falls back');

  const allowed = redisService(0, true);
  const ok = await allowed.issue('09121234567');
  assert.match(ok.code, /^\d{6}$/, 'issue succeeds when cooldown key is free');

  console.log('otp-cooldown.spec.ts: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
