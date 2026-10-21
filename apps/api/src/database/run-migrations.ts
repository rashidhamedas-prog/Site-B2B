import { DataSource, type DataSourceOptions } from 'typeorm';

/** Cluster-wide key for the migration runner; any process running migrations must take it. */
export const MIGRATION_ADVISORY_LOCK_KEY = 726_102_1003;

type Log = Pick<Console, 'log' | 'error'>;

/**
 * Runs pending migrations while holding a session-level `pg_advisory_lock` on a dedicated
 * connection, so concurrent starters wait and then find nothing pending.
 */
export async function runMigrationsWithLock(options: DataSourceOptions, log: Log = console): Promise<string[]> {
  const ds = new DataSource({ ...options, migrationsRun: false, synchronize: false } as DataSourceOptions);
  await ds.initialize();
  const lock = ds.createQueryRunner();
  try {
    await lock.connect();
    await lock.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);
    try {
      const ran = await ds.runMigrations();
      const names = ran.map((m) => m.name);
      log.log(JSON.stringify({ event: 'migrations.done', count: names.length, names }));
      return names;
    } finally {
      await lock.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_KEY]).catch(() => undefined);
    }
  } finally {
    await lock.release().catch(() => undefined);
    await ds.destroy().catch(() => undefined);
  }
}
