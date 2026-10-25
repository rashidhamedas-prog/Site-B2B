/**
 * npx ts-node --transpile-only src/database/migrations/20261025-001-omnichannel-delivery-idempotency.spec.ts
 */
import { QueryRunner } from 'typeorm';
import { OmnichannelDeliveryIdempotency1761364800001 } from './20261025-001-omnichannel-delivery-idempotency';
import { ACTIVE_CREATE_INDEX_PREDICATE } from '../../modules/omnichannel/delivery-dedupe-sql';

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

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const migration = new OmnichannelDeliveryIdempotency1761364800001();
  const up = createRunner();
  await migration.up(up.runner);
  const upSql = up.calls.join('\n');
  assert(upSql.includes('superseded_duplicate'), 'up supersedes duplicate rows');
  assert(upSql.includes(ACTIVE_CREATE_INDEX_PREDICATE), 'partial unique predicate matches the app');
  assert(upSql.includes('CREATE UNIQUE INDEX'), 'up builds the partial unique index');
  assert(upSql.includes('omnichannel_delivery_dedupe_undo'), 'up snapshots losers for down()');
  assert(!/DELETE\s+FROM\s+"omnichannel_publication_deliveries"/i.test(upSql), 'up does not delete delivery rows');
  assert(upSql.includes(`status = 'DEAD'`), 'losers become DEAD');

  const down = createRunner();
  await migration.down(down.runner);
  const downSql = down.calls.join('\n');
  assert(downSql.includes('previousStatus'), 'down restores delivery status');
  assert(downSql.includes('DROP INDEX'), 'down drops the unique index');
  assert(downSql.includes('DROP COLUMN IF EXISTS "idempotencyKey"'), 'down drops the new key');
  assert(downSql.includes('DROP TABLE IF EXISTS "omnichannel_delivery_dedupe_undo"'), 'down drops the undo table');

  console.log('20261025-001-omnichannel-delivery-idempotency.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
