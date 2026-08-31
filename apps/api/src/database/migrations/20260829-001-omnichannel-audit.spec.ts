/**
 * npx ts-node --transpile-only src/database/migrations/20260829-001-omnichannel-audit.spec.ts
 */
import { QueryRunner } from 'typeorm';
import { OmnichannelAudit1756470000001 } from './20260829-001-omnichannel-audit';

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
  const migration = new OmnichannelAudit1756470000001();
  const up = createRunner();
  await migration.up(up.runner);
  const sql = up.calls.join('\n');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS "omnichannel_audits"'), 'creates audits');
  assert(sql.includes('"actorId"'), 'actor');
  assert(sql.includes('"reason"'), 'reason');
  assert(!/"secret"\s/.test(sql) && !/"token"\s/.test(sql), 'no secret columns');
  const down = createRunner();
  await migration.down(down.runner);
  assert(down.calls.join('\n').includes('DROP TABLE IF EXISTS "omnichannel_audits"'), 'down drops');
  console.log('20260829-001-omnichannel-audit.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
