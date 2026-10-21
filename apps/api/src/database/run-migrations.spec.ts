/**
 * npx ts-node --transpile-only src/database/run-migrations.spec.ts
 */
import 'reflect-metadata';
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { databaseConfig, migrationRunnerEnabled } from '../config/database.config';

// Only the API process of a production/staging deployment runs migrations.
assert.strictEqual(migrationRunnerEnabled({ NODE_ENV: 'production' }), true, 'api in production');
assert.strictEqual(migrationRunnerEnabled({ APP_ENV: 'staging' }), true, 'api in staging');
assert.strictEqual(migrationRunnerEnabled({ NODE_ENV: 'production', OMNICHANNEL_WORKER: 'true' }), false, 'worker');
assert.strictEqual(migrationRunnerEnabled({ NODE_ENV: 'production', TYPEORM_MIGRATIONS_RUN: 'false' }), false, 'explicit off');
assert.strictEqual(migrationRunnerEnabled({ NODE_ENV: 'production', TYPEORM_MIGRATIONS_RUN: 'FALSE ' }), false);
assert.strictEqual(migrationRunnerEnabled({ NODE_ENV: 'development' }), false, 'dev uses synchronize/CLI');
assert.strictEqual(migrationRunnerEnabled({}), false);

// TypeORM's own boot-time runner is off everywhere (api, worker, worker-b share this config).
const cfg = databaseConfig({ get: (_k: string, d?: unknown) => d } as never) as { migrationsRun?: boolean };
assert.strictEqual(cfg.migrationsRun, false, 'TypeORM migrationsRun disabled for every process');

// The API runs the locked runner before Nest boots; the worker entrypoint never does.
const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8');
assert.ok(main.indexOf('runMigrationsWithLock(') < main.indexOf('NestFactory.create'), 'migrations before API boot');
const worker = readFileSync(join(__dirname, '..', 'worker.main.ts'), 'utf8');
assert.ok(!/runMigrations/.test(worker), 'worker never runs migrations');
const runner = readFileSync(join(__dirname, 'run-migrations.ts'), 'utf8');
assert.ok(/pg_advisory_lock/.test(runner) && /pg_advisory_unlock/.test(runner));

const compose = readFileSync(join(__dirname, '..', '..', '..', '..', 'docker-compose.yml'), 'utf8').replace(/\r/g, '');
for (const svc of ['worker', 'worker-b']) {
  const block = compose.split(new RegExp(`\\n  ${svc}:\\n`))[1]?.split(/\n  \S/)[0] ?? '';
  assert.ok(/TYPEORM_MIGRATIONS_RUN: 'false'/.test(block), `${svc} has TYPEORM_MIGRATIONS_RUN=false`);
}

console.log('run-migrations.spec ok');
