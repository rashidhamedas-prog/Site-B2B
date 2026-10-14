/**
 * npx ts-node --transpile-only src/database/migrations/20261014-001-connection-publish-settings.spec.ts
 */
import { QueryRunner } from 'typeorm';
import { ConnectionPublishSettings1760438400001 } from './20261014-001-connection-publish-settings';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function createRunner() {
  const calls: string[] = [];
  const runner = {
    async query(sql: string): Promise<unknown> {
      calls.push(sql);
      return undefined;
    },
  } as QueryRunner;
  return { runner, calls };
}

async function main() {
  const migration = new ConnectionPublishSettings1760438400001();
  const up = createRunner();
  await migration.up(up.runner);
  const sql = up.calls.join('\n');
  assert(sql.includes('publishSettings'), 'adds publishSettings column');
  assert(sql.includes('"connectionId"'), 'adds template connectionId');
  assert(sql.includes('UQ_omnichannel_templates_connection_event_version'), 'partial unique index per bot');
  assert(sql.includes('UQ_omnichannel_templates_fallback_provider_channel_event_version'), 'partial unique for fallback');
  assert(sql.includes('DROP INDEX IF EXISTS "UQ_omnichannel_templates_provider_channel_event_version"'), 'drops old global unique');
  assert(sql.includes("key = 'omnichannel'"), 'backfill from global settings');
  assert(!sql.includes('secretRef'), 'backfill never copies secretRef');
  assert(!/"secret"\s/.test(sql), 'no secret column');
  const down = createRunner();
  await migration.down(down.runner);
  assert(down.calls.join('\n').includes('DROP COLUMN IF EXISTS "publishSettings"'), 'down drops publishSettings');
  console.log('20261014-001-connection-publish-settings.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
