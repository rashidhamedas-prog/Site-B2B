/**
 * npx ts-node --transpile-only src/database/migrations/20261029-001-omnichannel-media-health.spec.ts
 */
import { QueryRunner } from 'typeorm';
import { OmnichannelMediaHealth1761740000001 } from './20261029-001-omnichannel-media-health';

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
  const migration = new OmnichannelMediaHealth1761740000001();
  const up = createRunner();
  await migration.up(up.runner);
  const sql = up.calls.join('\n');
  assert(sql.includes('omnichannel_media_assets'), 'targets media assets');
  assert(sql.includes('"healthStatus"'), 'healthStatus');
  assert(sql.includes('"healthCheckedAt"'), 'healthCheckedAt');
  assert(sql.includes('"healthDetail"'), 'healthDetail');
  assert(sql.includes('ADD COLUMN IF NOT EXISTS'), 'additive IF NOT EXISTS');
  assert(!/token|secret|vault/i.test(sql), 'no secrets');
  assert(!/DROP TABLE/i.test(sql), 'up does not drop table');
  const down = createRunner();
  await migration.down(down.runner);
  const downSql = down.calls.join('\n');
  assert(downSql.includes('DROP COLUMN IF EXISTS "healthStatus"'), 'down drops healthStatus');
  assert(downSql.includes('IDX_omnichannel_media_healthStatus'), 'down drops index');
  console.log('20261029-001-omnichannel-media-health.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
