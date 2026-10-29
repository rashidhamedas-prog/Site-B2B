/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/omnichannel-health.spec.ts
 */
import {
  assembleOmnichannelHealth,
  assembleProviderHealth,
  computeKillSwitchMismatch,
  killSwitchFromEnv,
  parseHeartbeatFile,
  parseProviderGateSnapshot,
  pickCapQuiet,
  redactHealthError,
  WORKER_HEARTBEAT_STALE_SEC,
} from './omnichannel-health';
import { providerGatePath } from './outbox-worker-provider-gate';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date('2026-10-27T12:00:00.000Z');

/* --- mismatch --- */
{
  const api = { connectorsEnabled: true, disabledProviders: ['BALE'] as Array<'BALE'> };
  const workerSame = { connectorsEnabled: true, disabledProviders: ['BALE'] as Array<'BALE'> };
  const workerDiff = { connectorsEnabled: true, disabledProviders: [] as Array<'TELEGRAM' | 'BALE' | 'RUBIKA'> };
  assert(computeKillSwitchMismatch(api, workerDiff) === true, 'api disabled BALE vs worker [] → mismatch');
  assert(computeKillSwitchMismatch(api, workerSame) === false, 'same lists → no mismatch');
  assert(computeKillSwitchMismatch(api, null) === false, 'missing worker → mismatch false (unknown)');
  assert(
    computeKillSwitchMismatch(
      { connectorsEnabled: true, disabledProviders: [] },
      { connectorsEnabled: false, disabledProviders: [] },
    ) === true,
    'connectors flag mismatch',
  );
}

/* --- heartbeat stale --- */
{
  const fresh = parseHeartbeatFile(String(now.getTime() - 60_000), now);
  assert(fresh.stale === false && fresh.heartbeatAgeSec === 60, 'fresh heartbeat');
  const stale = parseHeartbeatFile(String(now.getTime() - (WORKER_HEARTBEAT_STALE_SEC + 1) * 1000), now);
  assert(stale.stale === true && (stale.heartbeatAgeSec ?? 0) > WORKER_HEARTBEAT_STALE_SEC, 'stale >300s');
  const missing = parseHeartbeatFile(null, now);
  assert(missing.stale === true && missing.heartbeatAt === null, 'missing heartbeat is stale');
}

/* --- token redaction --- */
{
  const token = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';
  const redacted = redactHealthError(`bot failed /bot${token}/sendMessage token=${token}`);
  assert(redacted != null && !redacted.includes(token), 'token scrubbed from lastError');
  assert(redacted!.includes('[redacted]') || redacted!.includes('[redacted-token]'), 'redaction markers present');
  assert(redactHealthError(null) === null, 'null error stays null');
}

/* --- assemble: worker null vs mismatch --- */
{
  const baseProviders = [];
  const withNullWorker = assembleOmnichannelHealth({
    now,
    api: killSwitchFromEnv({ OMNICHANNEL_CONNECTORS_ENABLED: 'true', OMNICHANNEL_DISABLED_PROVIDERS: 'BALE' }),
    workerKillSwitch: null,
    heartbeatRaw: String(now.getTime()),
    drain: false,
    providers: baseProviders,
    env: { TELEGRAM_API_URL: 'https://telegram-egress.example.com', TELEGRAM_MEDIA_UPLOAD_MODE: 'upload' },
  });
  assert(withNullWorker.killSwitch.worker === null, 'worker null');
  assert(withNullWorker.killSwitch.mismatch === false, 'no mismatch when worker unknown');
  assert(withNullWorker.telegramEgress?.host === 'telegram-egress.example.com', 'hostname only');
  assert(withNullWorker.telegramEgress?.pingP95Ms === null, 'ping reserved');
  assert(withNullWorker.providers.every((p) => p.emergencyHold === false), 'emergencyHold false when no dests');

  const workerSnap = parseProviderGateSnapshot(JSON.stringify({
    at: now.toISOString(),
    connectorsEnabled: true,
    disabledProviders: [],
    workerId: 'worker:test:1',
  }));
  const mismatched = assembleOmnichannelHealth({
    now,
    api: { connectorsEnabled: true, disabledProviders: ['BALE'] },
    workerKillSwitch: workerSnap,
    heartbeatRaw: String(now.getTime() - 400_000),
    drain: true,
    providers: baseProviders,
  });
  assert(mismatched.killSwitch.mismatch === true, 'assembled mismatch true');
  assert(mismatched.worker.stale === true, 'assembled stale');
  assert(mismatched.worker.drain === true, 'drain flag');
  const bale = mismatched.providers.find((p) => p.provider === 'BALE');
  assert(bale?.killSwitchApi === true, 'BALE kill on api');
  assert(bale?.killSwitchWorker === false, 'BALE not kill on worker');
}

/* --- emergencyHold from destination publishSettings --- */
{
  const held = assembleOmnichannelHealth({
    now,
    api: { connectorsEnabled: true, disabledProviders: [] },
    workerKillSwitch: null,
    heartbeatRaw: String(now.getTime()),
    drain: false,
    providers: [{
      provider: 'BALE',
      connections: [],
      destinations: [{
        enabled: true,
        publishSettings: { emergencyHold: true, seeded: true, autoPublishMode: 'LIVE' },
        settings: null,
        connectionStatus: 'ACTIVE',
        connectionPublishSettings: {},
        channel: 'RETAIL',
      }],
      lastSuccessAt: null,
      lastError: null,
      countsToday: { retry: 0, dead: 0, hold: 0, stalled: 0 },
      sentToday: 0,
    }],
  });
  const bale = held.providers.find((p) => p.provider === 'BALE');
  assert(bale?.emergencyHold === true, 'emergencyHold true when destination flagged');
}

/* --- provider-gate path sibling --- */
{
  assert(
    providerGatePath({ OMNICHANNEL_WORKER_HEARTBEAT: '/tmp/omnichannel-worker.heartbeat' })
      === '/tmp/omnichannel-worker.provider-gate.json',
    'default sibling path',
  );
  assert(
    providerGatePath({ OMNICHANNEL_WORKER_PROVIDER_GATE: '/custom/gate.json' }) === '/custom/gate.json',
    'explicit gate path',
  );
}

/* --- per-destination cap: never max-as-sum --- */
{
  const ambiguous = pickCapQuiet(
    {
      provider: 'BALE',
      connections: [],
      destinations: [
        {
          id: 'd1',
          enabled: true,
          publishSettings: { seeded: true, autoDailyCap: 10 },
          settings: null,
          connectionStatus: 'ACTIVE',
          connectionPublishSettings: {},
          channel: 'WHOLESALE',
        },
        {
          id: 'd2',
          enabled: true,
          publishSettings: { seeded: true, autoDailyCap: 40 },
          settings: null,
          connectionStatus: 'ACTIVE',
          connectionPublishSettings: {},
          channel: 'WHOLESALE',
        },
      ],
      lastSuccessAt: null,
      lastError: null,
      countsToday: { retry: 0, dead: 0, hold: 0, stalled: 0 },
      sentToday: 3,
    },
    {},
  );
  assert(ambiguous.capAmbiguous === true, 'distinct caps → ambiguous');
  assert(ambiguous.cap == null, 'no single max() cap');
  assert((ambiguous.destinationCaps?.length || 0) === 2, 'lists both caps');

  const single = pickCapQuiet(
    {
      provider: 'TELEGRAM',
      connections: [],
      destinations: [
        {
          id: 'd1',
          enabled: true,
          publishSettings: { seeded: true, autoDailyCap: 12 },
          settings: null,
          connectionStatus: 'ACTIVE',
          connectionPublishSettings: {},
          channel: 'RETAIL',
        },
      ],
      lastSuccessAt: null,
      lastError: null,
      lastErrorAt: '2026-10-20T00:00:00.000Z',
      countsToday: { retry: 0, dead: 0, hold: 0, stalled: 0 },
      sentToday: 2,
    },
    {},
  );
  assert(single.cap?.dailyCap === 12 && single.cap.sentToday === 2, 'single dest cap');

  const assembled = assembleProviderHealth(
    {
      provider: 'TELEGRAM',
      connections: [],
      destinations: [
        {
          id: 'd1',
          enabled: true,
          publishSettings: { seeded: true, autoDailyCap: 5 },
          settings: null,
          connectionStatus: 'ACTIVE',
          connectionPublishSettings: {},
          channel: 'RETAIL',
        },
        {
          id: 'd2',
          enabled: true,
          publishSettings: { seeded: true, autoDailyCap: 50 },
          settings: null,
          connectionStatus: 'ACTIVE',
          connectionPublishSettings: {},
          channel: 'RETAIL',
        },
      ],
      lastSuccessAt: '2026-10-28T12:00:00.000Z',
      lastError: 'old',
      lastErrorAt: '2026-10-20T12:00:00.000Z',
      countsToday: { retry: 0, dead: 0, hold: 0, stalled: 0 },
      sentToday: 1,
    },
    { connectorsEnabled: true, disabledProviders: [] },
    { connectorsEnabled: true, disabledProviders: [] },
    {},
  );
  assert(assembled.capAmbiguous === true && !assembled.cap, 'assembled ambiguous');
  assert(assembled.lastErrorAt === '2026-10-20T12:00:00.000Z', 'lastErrorAt passed');
}

console.log('omnichannel-health.spec.ts: ok');
