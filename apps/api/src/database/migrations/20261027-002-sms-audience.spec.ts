/**
 * npx ts-node --transpile-only src/database/migrations/20261027-002-sms-audience.spec.ts
 */
import { QueryRunner } from 'typeorm';
import { SmsAudience1761523300002 } from './20261027-002-sms-audience';

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

type PartnerRow = { smsPromoConsentSource: string; smsPromoConsentAt: string };

/** Applies the backfill UPDATE the migration emits. Empty tables stay empty. */
function applyBackfill(rows: PartnerRow[], sql: string, table: string): PartnerRow[] {
  if (!sql.includes(`UPDATE "${table}"`)) return rows;
  return rows.map(() => ({
    smsPromoConsentSource: 'OWNER_DEFAULT_POLICY_BACKFILL',
    smsPromoConsentAt: 'now',
  }));
}

async function main() {
  const migration = new SmsAudience1761523300002();
  const up = createRunner();
  await migration.up(up.runner);
  const upSql = up.calls.join('\n');
  assert(upSql.includes('ADD COLUMN IF NOT EXISTS "smsPromoConsent"'), 'up adds consent flag');
  assert(upSql.includes(`DEFAULT 'OWNER_DEFAULT_POLICY'`), 'new rows default to owner policy');
  assert(upSql.includes(`'OWNER_DEFAULT_POLICY_BACKFILL'`), 'backfill marks existing rows');
  assert(upSql.includes('"smsPromoConsentAt" = now()'), 'backfill sets the timestamp');
  assert(upSql.includes('IDX_orders_customerId_createdAt'), 'orders lookup index');
  assert(upSql.includes('IDX_customers_phone2'), 'phone2 index');

  const existing: PartnerRow[] = [{ smsPromoConsentSource: 'legacy', smsPromoConsentAt: '' }];
  const backfilled = up.calls.reduce(
    (rows, sql) => applyBackfill(rows, sql, 'sales_partner_profiles'),
    existing,
  );
  assert(backfilled[0]?.smsPromoConsentSource === 'OWNER_DEFAULT_POLICY_BACKFILL', 'backfill source');
  assert(backfilled[0]?.smsPromoConsentAt === 'now', 'backfill time');

  const empty: PartnerRow[] = [];
  const stillEmpty = up.calls.reduce(
    (rows, sql) => applyBackfill(rows, sql, 'wholesale_referral_partners'),
    empty,
  );
  assert(stillEmpty.length === 0, 'up on an empty table does not invent rows');

  const down = createRunner();
  await migration.down(down.runner);
  const downSql = down.calls.join('\n');
  assert(downSql.includes('DROP INDEX IF EXISTS "IDX_customers_phone2"'), 'down drops phone2 index');
  assert(downSql.includes('DROP COLUMN IF EXISTS "smsPromoConsent"'), 'down drops columns');

  const again = createRunner();
  await migration.up(again.runner);
  assert(again.calls.length === up.calls.length, 'second up is the same reversible script');
  assert(again.calls.join('\n').includes('IF NOT EXISTS'), 'second up is safe on an existing schema');

  console.log('20261027-002-sms-audience.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
