/**
 * npx ts-node --transpile-only src/database/migrations/20261024-001-destination-publish-settings.spec.ts
 */
import { QueryRunner } from 'typeorm';
import { DestinationPublishSettings1761264000001 } from './20261024-001-destination-publish-settings';

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
  const migration = new DestinationPublishSettings1761264000001();
  const up = createRunner();
  await migration.up(up.runner);
  const sql = up.calls.join('\n');
  assert(sql.includes('omnichannel_channel_destinations'), 'touches destinations');
  assert(sql.includes('publishSettings'), 'adds destination publishSettings');
  assert(sql.includes('"destinationId"'), 'adds template destinationId');
  assert(sql.includes('UQ_omnichannel_templates_destination_event_version'), 'partial unique per destination');
  assert(sql.includes('AND "destinationId" IS NULL'), 'connection unique excludes destination-bound rows');
  assert(sql.includes('HAVING COUNT(*) = 1'), 'single-dest attach backfill');
  assert(sql.includes('HAVING COUNT(*) > 1'), 'multi-dest clone backfill');
  assert(!sql.includes('secretRef'), 'backfill never copies secretRef');
  assert(!/"secret"\s/.test(sql), 'no secret column');
  const down = createRunner();
  await migration.down(down.runner);
  assert(down.calls.join('\n').includes('DROP COLUMN IF EXISTS "publishSettings"'), 'down drops publishSettings');
  assert(down.calls.join('\n').includes('DROP COLUMN IF EXISTS "destinationId"'), 'down drops destinationId');
  console.log('20261024-001-destination-publish-settings.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
