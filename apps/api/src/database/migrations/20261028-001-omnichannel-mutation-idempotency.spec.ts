/**
 * npx ts-node --transpile-only src/database/migrations/20261028-001-omnichannel-mutation-idempotency.spec.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { QueryRunner } from 'typeorm';
import { OmnichannelMutationIdempotency1761609600001 } from './20261028-001-omnichannel-mutation-idempotency';
import {
  ACTIVE_CREATE_INDEX_NAME,
  ACTIVE_MUTATION_INDEX_NAME,
  ACTIVE_MUTATION_INDEX_PREDICATE,
} from '../../modules/omnichannel/delivery-dedupe-sql';

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
  const migration = new OmnichannelMutationIdempotency1761609600001();
  const up = createRunner();
  await migration.up(up.runner);
  const upSql = up.calls.join('\n');

  assert(upSql.includes('CREATE UNIQUE INDEX IF NOT EXISTS'), 'up builds the index idempotently');
  assert(upSql.includes(`"${ACTIVE_MUTATION_INDEX_NAME}"`), 'up uses the mutation index name');
  assert(upSql.includes(ACTIVE_MUTATION_INDEX_PREDICATE), 'up uses the shared predicate constant');
  assert(
    ACTIVE_MUTATION_INDEX_PREDICATE.includes(`"status" IN ('PENDING','PROCESSING','RETRY','HOLD')`)
      && !ACTIVE_MUTATION_INDEX_PREDICATE.includes('SUCCEEDED'),
    'SUCCEEDED stays out of the mutation unique',
  );
  assert(ACTIVE_MUTATION_INDEX_PREDICATE.includes(`"action" IN ('UPDATE','DELETE')`), 'only UPDATE/DELETE');
  assert(!/DELETE\s+FROM/i.test(upSql), 'up deletes no rows');
  assert(!/DROP\s+(INDEX|TABLE|COLUMN)/i.test(upSql), 'up is additive (no drops)');
  assert(!upSql.includes(ACTIVE_CREATE_INDEX_NAME), 'up never touches the CREATE index');
  assert(!/TRUNCATE/i.test(upSql), 'up never truncates');

  const undoAt = upSql.indexOf('INSERT INTO "omnichannel_delivery_dedupe_undo"');
  const supersedeAt = upSql.indexOf(`"lastError" = 'superseded_duplicate'`);
  const indexAt = upSql.indexOf('CREATE UNIQUE INDEX');
  const keyUndoAt = upSql.indexOf('INSERT INTO "omnichannel_delivery_mutation_key_undo"');
  const normalizeAt = upSql.indexOf(`SET "idempotencyKey" =`);
  assert(undoAt >= 0 && supersedeAt > undoAt, 'undo snapshot precedes supersede');
  assert(keyUndoAt > supersedeAt && normalizeAt > keyUndoAt, 'losers go first, then key snapshot, then normalize');
  assert(indexAt > normalizeAt, 'index is built last, after duplicates are gone');
  assert(upSql.includes(`status = 'DEAD'`), 'losers become DEAD');
  assert(upSql.includes(`d.action IN ('UPDATE', 'DELETE')`), 'loser query is limited to UPDATE/DELETE');
  assert(upSql.includes(`WHEN d.action = 'DELETE'`) || upSql.includes(`d.action = 'DELETE'`), 'DELETE keys are normalised');
  assert(upSql.includes(`WHEN status = 'PROCESSING' THEN 0`), 'an in-flight row is kept over an unsent one');

  const second = createRunner();
  await migration.up(second.runner);
  assert(second.calls.join('\n') === upSql, 'second up() issues identical idempotent SQL');

  const down = createRunner();
  await migration.down(down.runner);
  const downSql = down.calls.join('\n');
  assert(downSql.includes(`DROP INDEX IF EXISTS "${ACTIVE_MUTATION_INDEX_NAME}"`), 'down drops the mutation index');
  assert(!downSql.includes(ACTIVE_CREATE_INDEX_NAME), 'down leaves the CREATE index alone');
  assert(!/DROP\s+TABLE\s+IF\s+EXISTS\s+"omnichannel_delivery_dedupe_undo"/i.test(downSql), 'down keeps the shared undo table');
  assert(!/DROP\s+COLUMN/i.test(downSql), 'down keeps delivery columns (owned by 20261025-001)');
  assert(!/DELETE\s+FROM/i.test(downSql), 'down deletes no rows');
  assert(downSql.includes('"previousStatus"') && downSql.includes('"supersededAt" = NULL'), 'down restores superseded rows');
  assert(downSql.includes('"previousIdempotencyKey"'), 'down restores DELETE keys');
  assert(downSql.indexOf('"previousIdempotencyKey"') < downSql.indexOf('DROP TABLE IF EXISTS "omnichannel_delivery_mutation_key_undo"'), 'key undo is read before it is dropped');

  const entitySrc = readFileSync(
    join(__dirname, '../../modules/omnichannel/entities/publication-delivery.entity.ts'),
    'utf8',
  );
  assert(entitySrc.includes(`'${ACTIVE_MUTATION_INDEX_NAME}'`), 'entity declares the mutation @Index');
  assert(entitySrc.includes(ACTIVE_MUTATION_INDEX_PREDICATE), 'entity predicate equals the migration predicate');

  console.log('20261028-001-omnichannel-mutation-idempotency.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
