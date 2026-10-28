/**
 * npx ts-node --transpile-only src/database/migrations/20261028-002-omnichannel-audit-rbac.spec.ts
 */
import { QueryRunner } from 'typeorm';
import { OmnichannelAuditRbac1761624000001 } from './20261028-002-omnichannel-audit-rbac';

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
  const migration = new OmnichannelAuditRbac1761624000001();
  const up = createRunner();
  await migration.up(up.runner);
  const sql = up.calls.join('\n');
  assert(sql.includes('ADD COLUMN IF NOT EXISTS "goRef"'), 'adds goRef');
  assert(sql.includes('ADD COLUMN IF NOT EXISTS "source"'), 'adds source');
  assert(sql.includes('"omnichannelRole"'), 'adds users.omnichannelRole');
  assert(sql.includes('omnichannel_audits_append_only'), 'append-only function');
  assert(sql.includes('BEFORE UPDATE OR DELETE'), 'blocks update/delete');
  assert(sql.includes('IDX_omnichannel_audits_createdAt'), 'createdAt index');
  assert(!/"secret"\s/.test(sql) && !/"token"\s/.test(sql), 'no secret columns');

  const down = createRunner();
  await migration.down(down.runner);
  const downSql = down.calls.join('\n');
  assert(downSql.includes('DROP TRIGGER IF EXISTS trg_omnichannel_audits_append_only'), 'drops trigger');
  assert(downSql.includes('DROP COLUMN IF EXISTS "goRef"'), 'drops goRef');
  assert(downSql.includes('DROP COLUMN IF EXISTS "omnichannelRole"'), 'drops role column');

  console.log('20261028-002-omnichannel-audit-rbac.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
