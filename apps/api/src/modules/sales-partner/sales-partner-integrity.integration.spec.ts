/**
 * PostgreSQL + Redis checks for sales-partner ledger integrity.
 * Refuses to run against a database whose name looks like production.
 * Native server: DB_HOST DB_PORT DB_USER DB_PASS SP_TEST_DB REDIS_URL
 * When native initdb cannot start, SP_TEST_PGLITE_MODULE points at a PostgreSQL WASM build.
 */
import { Client } from 'pg';
import Redis from 'ioredis';
import { advanceLedgerCursor, reversalIdempotencyKey } from './sales-partner-ledger-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const dbName = process.env.SP_TEST_DB || 'taranom_sp_integrity_test';
if (/prod|live|taranom_db/i.test(dbName)) {
  throw new Error('refusing to use a production-like database name');
}

type Sql = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, string | null>>; rowCount?: number | null }>;
  end: () => Promise<void>;
};

async function main() {
  const db = process.env.SP_TEST_PGLITE_MODULE
    ? await openPglite(process.env.SP_TEST_PGLITE_MODULE)
    : await openServer();
  await db.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`).catch(() => undefined);
  await db.query(`
    CREATE TABLE IF NOT EXISTS sales_commission_ledger_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "salesPartnerId" uuid NOT NULL,
      "orderId" uuid,
      "orderItemId" uuid,
      "amountIrr" bigint NOT NULL,
      "entryType" varchar(32) NOT NULL,
      "availableAt" timestamptz,
      "idempotencyKey" varchar(80) UNIQUE NOT NULL,
      "reasonCode" varchar(64),
      bucket varchar(16),
      "payoutId" uuid,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.query(`TRUNCATE sales_commission_ledger_entries`);

  const partner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const orderId = '11111111-1111-4111-8111-111111111111';
  const itemId = '22222222-2222-4222-8222-222222222222';
  const rmaId = '33333333-3333-4333-8333-333333333333';
  const key = reversalIdempotencyKey(orderId, itemId, `RMA:${rmaId}`);
  assert(key.length <= 80, 'key fits');
  await db.query(
    `INSERT INTO sales_commission_ledger_entries
      ("salesPartnerId", "orderId", "orderItemId", "amountIrr", "entryType", "availableAt", "idempotencyKey", bucket)
     VALUES ($1, $2, $3, $4, 'COMMISSION_REVERSAL', now(), $5, 'held')`,
    [partner, orderId, itemId, -20000, key],
  );
  let duplicate = false;
  try {
    await db.query(
      `INSERT INTO sales_commission_ledger_entries
        ("salesPartnerId", "orderId", "orderItemId", "amountIrr", "entryType", "idempotencyKey", bucket)
       VALUES ($1, $2, $3, $4, 'COMMISSION_REVERSAL', $5, 'held')`,
      [partner, orderId, itemId, -20000, key],
    );
  } catch (err: unknown) {
    duplicate = (err as { code?: string }).code === '23505';
  }
  assert(duplicate, 'second reversal is a unique conflict');

  for (let i = 0; i < 501; i += 1) {
    await db.query(
      `INSERT INTO sales_commission_ledger_entries
        ("salesPartnerId", "amountIrr", "entryType", "availableAt", "idempotencyKey", bucket)
       VALUES ($1, 1, 'COMMISSION_EARNED', now() - interval '1 day', $2, 'available')`,
      [partner, `earned-${i}`],
    );
  }
  const sum = await db.query(
    `SELECT COALESCE(SUM("amountIrr"), 0)::text AS amount
     FROM sales_commission_ledger_entries
     WHERE "salesPartnerId" = $1 AND "entryType" = 'COMMISSION_EARNED'`,
    [partner],
  );
  assert(sum.rows[0].amount === '501', 'sum includes the row past 500');

  const page = Array.from({ length: 50 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
  }));
  const cursor = advanceLedgerCursor(page, 50);
  await db.query(`
    CREATE TABLE IF NOT EXISTS sales_partner_ledger_cursors (
      name varchar(40) PRIMARY KEY,
      "cursorAt" timestamptz,
      "cursorId" uuid,
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "lastError" varchar(240)
    )
  `);
  await db.query(
    `INSERT INTO sales_partner_ledger_cursors (name, "cursorAt", "cursorId")
     VALUES ('link-orders', $1, $2)
     ON CONFLICT (name) DO UPDATE SET "cursorAt" = EXCLUDED."cursorAt", "cursorId" = EXCLUDED."cursorId"`,
    [cursor.cursorAt, cursor.cursorId],
  );
  const stored = await db.query(`SELECT "cursorId" FROM sales_partner_ledger_cursors WHERE name = 'link-orders'`);
  assert(stored.rows[0].cursorId === page[49].id, 'cursor persisted');
  await db.end();

  const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  const grant = `otp:grant:sales_partner_password:test-user:${Date.now()}`;
  await redis.set(grant, '1', 'EX', 30);
  const first = await redis.get(grant);
  await redis.del(grant);
  const second = await redis.get(grant);
  assert(first === '1' && second === null, 'grant is readable once');
  const nx = await redis.set(`${grant}:nx`, '1', 'EX', 30, 'NX');
  const nx2 = await redis.set(`${grant}:nx`, '1', 'EX', 30, 'NX');
  assert(nx === 'OK' && nx2 === null, 'redis NX does not double-book');
  await redis.del(`${grant}:nx`);
  await redis.quit();
  console.log('sales-partner-integrity.integration.spec.ts: OK');
}

async function openPglite(modulePath: string): Promise<Sql> {
  const loaded = await import(modulePath) as {
    PGlite: new () => {
      waitReady: Promise<void>;
      query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, string | null>>; affectedRows?: number }>;
      close: () => Promise<void>;
    };
  };
  const db = new loaded.PGlite();
  await db.waitReady;
  return {
    query: async (text, params) => {
      const result = await db.query(text, params);
      return { rows: result.rows, rowCount: result.affectedRows ?? null };
    },
    end: () => db.close(),
  };
}

async function openServer(): Promise<Sql> {
  const connection = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'taranom',
    password: process.env.DB_PASS,
  };
  const singleDb = process.env.SP_TEST_SINGLE_DB === '1';
  if (!singleDb) {
    const admin = new Client({ ...connection, database: 'postgres' });
    await admin.connect();
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!exists.rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();
  }
  const db = new Client({ ...connection, database: singleDb ? 'postgres' : dbName });
  await db.connect();
  return db;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
