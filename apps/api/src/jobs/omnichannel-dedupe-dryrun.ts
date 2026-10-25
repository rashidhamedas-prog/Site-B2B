/**
 * Read-only list of CREATE rows the idempotency migration would supersede.
 * Does not UPDATE, INSERT, or DELETE.
 *
 * Refuses to connect unless both are set:
 *   OMNICHANNEL_DEDUPE_DRY_RUN=1
 *   DATABASE_URL=postgres://...
 *
 * npx ts-node --transpile-only src/jobs/omnichannel-dedupe-dryrun.ts
 */
import { DataSource } from 'typeorm';
import { DRY_RUN_REPORT_SQL } from '../modules/omnichannel/delivery-dedupe-sql';

function redact(value: string): string {
  return value.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]');
}

async function main() {
  if (process.env.OMNICHANNEL_DEDUPE_DRY_RUN !== '1' || !process.env.DATABASE_URL) {
    console.log(JSON.stringify({
      dryRun: true,
      connected: false,
      reason: 'Set OMNICHANNEL_DEDUPE_DRY_RUN=1 and DATABASE_URL to read rows. No database was opened.',
      sql: DRY_RUN_REPORT_SQL.trim(),
    }, null, 2));
    return;
  }
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
    logging: false,
  });
  await dataSource.initialize();
  try {
    const rows = await dataSource.query(DRY_RUN_REPORT_SQL);
    const list = Array.isArray(rows) ? rows : [];
    console.log(JSON.stringify({
      dryRun: true,
      connected: true,
      wouldSupersede: list.length,
      rows: list,
    }, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(redact(message));
  process.exit(1);
});
