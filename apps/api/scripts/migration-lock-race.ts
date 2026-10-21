/**
 * Reproduces the duplicate `migrations` rows and proves the advisory-lock runner prevents them.
 * Creates and drops two scratch databases on the target server.
 *
 *   MIGRATION_RACE_PG_URL=postgres://user:pass@localhost:5432/postgres \
 *     npx ts-node --transpile-only scripts/migration-lock-race.ts
 *
 * Point it at a disposable server only. Exit 1 on failure.
 */
import 'reflect-metadata';
import * as assert from 'assert';
import { Client } from 'pg';
import { DataSource, type DataSourceOptions, type MigrationInterface, type QueryRunner } from 'typeorm';
import { runMigrationsWithLock } from '../src/database/run-migrations';

class RaceSlow1700000000001 implements MigrationInterface {
  name = 'RaceSlow1700000000001';
  async up(q: QueryRunner): Promise<void> {
    await q.query('SELECT pg_sleep(1)');
  }
  async down(): Promise<void> {}
}

const url = process.env.MIGRATION_RACE_PG_URL;
const quiet = { log: () => undefined, error: () => undefined };

async function withDb<T>(name: string, fn: (opts: DataSourceOptions) => Promise<T>): Promise<T> {
  const admin = new Client({ connectionString: url });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${name}`);
  const u = new URL(url!);
  u.pathname = `/${name}`;
  const opts = { type: 'postgres', url: u.toString(), migrations: [RaceSlow1700000000001], logging: false } as DataSourceOptions;
  try {
    // Create the migrations table up front so both starters race only on the migration itself.
    const init = new DataSource({ ...opts, migrations: [] } as DataSourceOptions);
    await init.initialize();
    await init.runMigrations();
    await init.destroy();
    return await fn(opts);
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`).catch(() => undefined);
    await admin.end();
  }
}

async function rows(opts: DataSourceOptions): Promise<number> {
  const ds = new DataSource({ ...opts, migrations: [] } as DataSourceOptions);
  await ds.initialize();
  const [{ n }] = await ds.query(`SELECT count(*)::int AS n FROM migrations WHERE name = 'RaceSlow1700000000001'`);
  await ds.destroy();
  return n;
}

async function main(): Promise<void> {
  if (!url) {
    console.log('migration-lock-race SKIPPED (set MIGRATION_RACE_PG_URL to a disposable server)');
    return;
  }
  const unlocked = await withDb('race_unlocked', async (opts) => {
    const start = async () => {
      const ds = new DataSource(opts);
      await ds.initialize();
      await ds.runMigrations();
      await ds.destroy();
    };
    await Promise.all([start(), start(), start()]);
    return rows(opts);
  });
  console.log(`old behaviour (3 processes, TypeORM migrationsRun): ${unlocked} rows`);
  assert.ok(unlocked > 1, 'reproduces the duplicate history rows');

  const locked = await withDb('race_locked', async (opts) => {
    await Promise.all([1, 2, 3].map(() => runMigrationsWithLock(opts, quiet)));
    return rows(opts);
  });
  console.log(`advisory-lock runner (3 concurrent): ${locked} row`);
  assert.strictEqual(locked, 1, 'exactly one history row with the lock');
  console.log('migration-lock-race ok');
}

main().catch((err: unknown) => {
  console.error(err instanceof assert.AssertionError ? err.message : err);
  process.exit(1);
});
