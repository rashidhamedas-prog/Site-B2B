/**
 * PR-3 Postgres-gated checks: mutation unique index, migration up/down on seeded data,
 * reserveCreateSend race and restart. Skipped (exit 0) unless a throwaway database is configured.
 *
 *   DATABASE_URL=postgres://user:pass@127.0.0.1:5432/omni_pr3_test \
 *     npx ts-node --transpile-only src/modules/omnichannel/services/delivery-idempotency.integration.spec.ts
 *
 * Optional single-connection mode (no concurrency cases): PR3_TEST_PGLITE_MODULE=<path to @electric-sql/pglite>.
 * Everything runs in a private schema that is dropped at the end. Never point this at production:
 * production-like database names and the Iran origin host are refused.
 */
import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { QueryRunner } from 'typeorm';
import { OmnichannelMutationIdempotency1761609600001 } from '../../../database/migrations/20261028-001-omnichannel-mutation-idempotency';
import {
  ACTIVE_CREATE_INDEX_NAME,
  ACTIVE_CREATE_INDEX_PREDICATE,
  ACTIVE_MUTATION_INDEX_NAME,
  ACTIVE_MUTATION_INDEX_PREDICATE,
} from '../delivery-dedupe-sql';
import { OmnichannelService } from './omnichannel.service';

type Row = Record<string, unknown>;
type Db = {
  query: (sql: string, params?: unknown[]) => Promise<Row[]>;
  exec: (sql: string) => Promise<void>;
  transaction: <T>(fn: (tx: { query: (sql: string, params?: unknown[]) => Promise<Row[]> }) => Promise<T>) => Promise<T>;
  concurrent: boolean;
  close: () => Promise<void>;
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const url = process.env.DATABASE_URL || '';
const pgliteModule = process.env.PR3_TEST_PGLITE_MODULE || '';

if (!url && !pgliteModule) {
  console.log('delivery-idempotency.integration.spec.ts: skipped (no DATABASE_URL)');
  process.exit(0);
}

if (url) {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (/prod|live|taranom_db/i.test(dbName) || parsed.hostname === '185.213.167.61') {
    throw new Error('refusing to run integration spec against a production-like database');
  }
}

const SCHEMA = `pr3_idem_${randomUUID().replace(/-/g, '').slice(0, 10)}`;

const DDL = `
CREATE TABLE "omnichannel_outbox_events" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status varchar NOT NULL DEFAULT 'PENDING',
  "lastError" text,
  "completedAt" timestamptz,
  "lockedAt" timestamptz,
  "lockedBy" varchar,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "omnichannel_channel_destinations" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "connectionId" uuid
);
CREATE TABLE "omnichannel_publication_deliveries" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "publicationId" uuid NOT NULL,
  "destinationId" uuid NOT NULL,
  "eventId" uuid NOT NULL,
  action varchar NOT NULL,
  status varchar NOT NULL,
  "providerMessageId" varchar,
  attempts int NOT NULL DEFAULT 0,
  "nextAttemptAt" timestamptz,
  "sourceType" varchar NOT NULL DEFAULT 'PRODUCT',
  "sourceId" varchar NOT NULL DEFAULT 'p',
  "idempotencyKey" varchar NOT NULL,
  auto boolean NOT NULL DEFAULT false,
  "deferredReason" varchar,
  "supersededAt" timestamptz,
  "sentAt" timestamptz,
  "contentHash" varchar,
  "reapprovedAt" timestamptz,
  "lastError" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "${ACTIVE_CREATE_INDEX_NAME}"
  ON "omnichannel_publication_deliveries" ("idempotencyKey") WHERE ${ACTIVE_CREATE_INDEX_PREDICATE};
`;

async function openServer(): Promise<Db> {
  const admin = new Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA "${SCHEMA}"`);
  await admin.end();
  const pool = new Pool({ connectionString: url, max: 4, options: `-c search_path=${SCHEMA}` });
  await pool.query(DDL);
  return {
    concurrent: true,
    query: async (sql, params) => (await pool.query(sql, params as unknown[])).rows as Row[],
    exec: async (sql) => { await pool.query(sql); },
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn({ query: async (sql, params) => (await client.query(sql, params as unknown[])).rows as Row[] });
        await client.query('COMMIT');
        return out;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: async () => {
      await pool.query(`DROP SCHEMA "${SCHEMA}" CASCADE`);
      await pool.end();
    },
  };
}

async function openPglite(modulePath: string): Promise<Db> {
  const loaded = await import(modulePath) as {
    PGlite: new () => {
      waitReady: Promise<void>;
      query: (sql: string, params?: unknown[]) => Promise<{ rows: Row[] }>;
      exec: (sql: string) => Promise<unknown>;
      close: () => Promise<void>;
    };
  };
  const pg = new loaded.PGlite();
  await pg.waitReady;
  await pg.exec(`CREATE SCHEMA "${SCHEMA}"; SET search_path = "${SCHEMA}";`);
  await pg.exec(DDL);
  const q = async (sql: string, params?: unknown[]) => (await pg.query(sql, params)).rows;
  return {
    concurrent: false,
    query: q,
    exec: async (sql) => { await pg.exec(sql); },
    transaction: async (fn) => {
      await pg.exec('BEGIN');
      try {
        const out = await fn({ query: q });
        await pg.exec('COMMIT');
        return out;
      } catch (error) {
        await pg.exec('ROLLBACK').catch(() => undefined);
        throw error;
      }
    },
    close: async () => { await pg.exec(`DROP SCHEMA "${SCHEMA}" CASCADE`); await pg.close(); },
  };
}

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

async function outbox(db: Db, status = 'PENDING', lockedAt: Date | null = null): Promise<string> {
  const rows = await db.query(
    `INSERT INTO "omnichannel_outbox_events" (status, "lockedAt") VALUES ($1::text, $2::timestamptz) RETURNING id`,
    [status, lockedAt],
  );
  return String(rows[0].id);
}

async function delivery(db: Db, o: {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  status: string;
  key: string;
  destinationId: string;
  eventId: string;
  providerMessageId?: string | null;
  createdAt?: Date;
}): Promise<string> {
  const rows = await db.query(
    `INSERT INTO "omnichannel_publication_deliveries"
       ("publicationId", "destinationId", "eventId", action, status, "providerMessageId", "idempotencyKey", "createdAt")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text, $7::text, $8::timestamptz)
     RETURNING id`,
    [randomUUID(), o.destinationId, o.eventId, o.action, o.status, o.providerMessageId ?? null, o.key, o.createdAt || new Date()],
  );
  return String(rows[0].id);
}

async function one(db: Db, id: string): Promise<Row> {
  const rows = await db.query(`SELECT * FROM "omnichannel_publication_deliveries" WHERE id = $1::uuid`, [id]);
  return rows[0];
}

function insertIgnoring(predicate: string) {
  return `INSERT INTO "omnichannel_publication_deliveries"
    ("publicationId", "destinationId", "eventId", action, status, "idempotencyKey")
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4::text, 'PENDING', $5::text)
    ON CONFLICT ("idempotencyKey") WHERE ${predicate} DO NOTHING
    RETURNING id`;
}

function runnerFor(db: Db): QueryRunner {
  return { query: (sql: string, params?: unknown[]) => db.query(sql, params) } as unknown as QueryRunner;
}

async function migrationAndIndex(db: Db) {
  const dest = randomUUID();
  const msgU = 'msg-u';
  const msgD = 'msg-d';
  const msgP = 'msg-p';
  const keyU = `UPDATE:${dest}:${msgU}:h1`;
  const keyP = `UPDATE:${dest}:${msgP}:h1`;
  const createKey = `CREATE:PRODUCT:p-int:${dest}`;

  const oUOld = await outbox(db);
  const oUNew = await outbox(db);
  const oUDone = await outbox(db, 'DONE');
  const uOld = await delivery(db, { action: 'UPDATE', status: 'PENDING', key: keyU, destinationId: dest, eventId: oUOld, providerMessageId: msgU, createdAt: minutesAgo(180) });
  const uNew = await delivery(db, { action: 'UPDATE', status: 'PENDING', key: keyU, destinationId: dest, eventId: oUNew, providerMessageId: msgU, createdAt: minutesAgo(60) });
  const uDone = await delivery(db, { action: 'UPDATE', status: 'SUCCEEDED', key: keyU, destinationId: dest, eventId: oUDone, providerMessageId: msgU, createdAt: minutesAgo(300) });

  const oD1 = await outbox(db);
  const oD2 = await outbox(db);
  const d1 = await delivery(db, { action: 'DELETE', status: 'PENDING', key: `DELETE:${dest}:${msgD}:hashA`, destinationId: dest, eventId: oD1, providerMessageId: msgD, createdAt: minutesAgo(120) });
  const d2 = await delivery(db, { action: 'DELETE', status: 'HOLD', key: `DELETE:${dest}:${msgD}:hashB`, destinationId: dest, eventId: oD2, providerMessageId: msgD, createdAt: minutesAgo(60) });

  const oPOld = await outbox(db, 'PROCESSING');
  const oPNew = await outbox(db);
  const pOld = await delivery(db, { action: 'UPDATE', status: 'PROCESSING', key: keyP, destinationId: dest, eventId: oPOld, providerMessageId: msgP, createdAt: minutesAgo(30) });
  const pNew = await delivery(db, { action: 'UPDATE', status: 'PENDING', key: keyP, destinationId: dest, eventId: oPNew, providerMessageId: msgP, createdAt: minutesAgo(10) });

  const oCreate = await outbox(db);
  const create = await delivery(db, { action: 'CREATE', status: 'PENDING', key: createKey, destinationId: dest, eventId: oCreate });

  const before = Number((await db.query(`SELECT COUNT(*)::int AS n FROM "omnichannel_publication_deliveries"`))[0].n);
  const migration = new OmnichannelMutationIdempotency1761609600001();
  await migration.up(runnerFor(db));

  const after = Number((await db.query(`SELECT COUNT(*)::int AS n FROM "omnichannel_publication_deliveries"`))[0].n);
  assert(before === after, 'up() deletes no delivery rows');
  const indexes = await db.query(`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`);
  assert(indexes.some((r) => r.indexname === ACTIVE_MUTATION_INDEX_NAME), 'mutation index exists after up()');
  assert(indexes.some((r) => r.indexname === ACTIVE_CREATE_INDEX_NAME), 'CREATE index untouched');

  const uOldRow = await one(db, uOld);
  assert(uOldRow.status === 'DEAD' && uOldRow.lastError === 'superseded_duplicate' && uOldRow.supersededAt != null, 'older active UPDATE is superseded');
  assert((await one(db, uNew)).status === 'PENDING', 'newest active UPDATE survives');
  assert((await one(db, uDone)).status === 'SUCCEEDED', 'SUCCEEDED UPDATE is left alone');
  assert((await one(db, d1)).status === 'DEAD', 'older DELETE (different hash) is superseded');
  const d2Row = await one(db, d2);
  assert(d2Row.status === 'HOLD' && d2Row.idempotencyKey === `DELETE:${dest}:${msgD}:`, 'surviving DELETE key is normalised without hash');
  assert((await one(db, pOld)).status === 'PROCESSING', 'in-flight UPDATE is kept');
  assert((await one(db, pNew)).status === 'DEAD', 'unsent sibling of an in-flight UPDATE is superseded');
  assert((await one(db, create)).status === 'PENDING', 'CREATE row untouched');
  const eStatus = async (id: string) => String((await db.query(`SELECT status FROM "omnichannel_outbox_events" WHERE id = $1::uuid`, [id]))[0].status);
  assert(await eStatus(oUOld) === 'DEAD' && await eStatus(oD1) === 'DEAD' && await eStatus(oPNew) === 'DEAD', 'loser outbox rows are DEAD');
  assert(await eStatus(oUNew) === 'PENDING' && await eStatus(oUDone) === 'DONE' && await eStatus(oD2) === 'PENDING', 'keeper/DONE outbox rows are untouched');

  // Index behaviour (case 8).
  const pub = randomUUID();
  const ev = await outbox(db);
  const ignored = await db.query(insertIgnoring(ACTIVE_MUTATION_INDEX_PREDICATE), [pub, dest, ev, 'UPDATE', keyU]);
  assert(ignored.length === 0, 'second active UPDATE for the same key is deduped (DO NOTHING)');
  let violation = '';
  try {
    await db.query(
      `INSERT INTO "omnichannel_publication_deliveries" ("publicationId","destinationId","eventId",action,status,"idempotencyKey")
       VALUES ($1::uuid,$2::uuid,$3::uuid,'UPDATE','PENDING',$4::text)`,
      [pub, dest, ev, keyU],
    );
  } catch (error) {
    violation = String((error as { code?: string }).code || '');
  }
  assert(violation === '23505', 'plain duplicate insert violates the mutation unique');
  const delKey = `DELETE:${dest}:${msgD}:`;
  assert((await db.query(insertIgnoring(ACTIVE_MUTATION_INDEX_PREDICATE), [pub, dest, ev, 'DELETE', delKey])).length === 0, 'second active DELETE for the same message is deduped');
  const fresh = await db.query(insertIgnoring(ACTIVE_MUTATION_INDEX_PREDICATE), [pub, dest, await outbox(db), 'UPDATE', `UPDATE:${dest}:${msgU}:h2`]);
  assert(fresh.length === 1, 'UPDATE with changed content is a different key and is accepted');
  await db.query(`UPDATE "omnichannel_publication_deliveries" SET status = 'SUCCEEDED' WHERE id = $1::uuid`, [uNew]);
  const afterSuccess = await db.query(insertIgnoring(ACTIVE_MUTATION_INDEX_PREDICATE), [pub, dest, await outbox(db), 'UPDATE', keyU]);
  assert(afterSuccess.length === 1, 'SUCCEEDED is outside the unique, so a repeat edit stays possible');
  assert((await db.query(insertIgnoring(ACTIVE_CREATE_INDEX_PREDICATE), [pub, dest, await outbox(db), 'CREATE', createKey])).length === 0, 'CREATE slot still enforced by its own index');

  // Idempotent second run.
  await migration.up(runnerFor(db));
  assert(Number((await db.query(`SELECT COUNT(*)::int AS n FROM "omnichannel_publication_deliveries"`))[0].n) === after + 2, 'second up() is a no-op for rows');
  assert((await one(db, String(afterSuccess[0].id))).status === 'PENDING', 'second up() keeps the lone active row');

  await migration.down(runnerFor(db));
  const idxAfterDown = await db.query(`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`);
  assert(!idxAfterDown.some((r) => r.indexname === ACTIVE_MUTATION_INDEX_NAME), 'down() drops the mutation index');
  assert(idxAfterDown.some((r) => r.indexname === ACTIVE_CREATE_INDEX_NAME), 'down() keeps the CREATE index');
  const restoredOld = await one(db, uOld);
  assert(restoredOld.status === 'PENDING' && restoredOld.supersededAt == null && restoredOld.lastError == null, 'down() restores a superseded UPDATE');
  assert((await one(db, d1)).status === 'PENDING', 'down() restores a superseded DELETE');
  assert((await one(db, pNew)).status === 'PENDING', 'down() restores the sibling of the in-flight row');
  assert((await one(db, d2)).idempotencyKey === `DELETE:${dest}:${msgD}:hashB`, 'down() restores the original DELETE key');
  assert(await eStatus(oUOld) === 'PENDING' && await eStatus(oD1) === 'PENDING', 'down() restores outbox rows');
}

async function concurrentInserts(db: Db) {
  // down() restored the duplicates; up() again must dedupe them and rebuild the index.
  await new OmnichannelMutationIdempotency1761609600001().up(runnerFor(db));
  const active = await db.query(`SELECT COUNT(*)::int AS n FROM (
      SELECT "idempotencyKey" FROM "omnichannel_publication_deliveries"
      WHERE ${ACTIVE_MUTATION_INDEX_PREDICATE} GROUP BY 1 HAVING COUNT(*) > 1) t`);
  assert(Number(active[0].n) === 0, 'up() after down() leaves no active mutation duplicates');
  for (let i = 0; i < 15; i += 1) {
    const dest = randomUUID();
    const delKey = `DELETE:${dest}:m${i}:`;
    const upKey = `UPDATE:${dest}:m${i}:hh`;
    const createKey = `CREATE:PRODUCT:r${i}:${dest}`;
    const jobs = [
      ['DELETE', delKey, ACTIVE_MUTATION_INDEX_PREDICATE],
      ['DELETE', delKey, ACTIVE_MUTATION_INDEX_PREDICATE],
      ['UPDATE', upKey, ACTIVE_MUTATION_INDEX_PREDICATE],
      ['UPDATE', upKey, ACTIVE_MUTATION_INDEX_PREDICATE],
      ['CREATE', createKey, ACTIVE_CREATE_INDEX_PREDICATE],
      ['CREATE', createKey, ACTIVE_CREATE_INDEX_PREDICATE],
    ] as const;
    const events = await Promise.all(jobs.map(() => outbox(db)));
    const results = await Promise.all(jobs.map(([action, key, predicate], idx) =>
      db.query(insertIgnoring(predicate), [randomUUID(), dest, events[idx], action, key])));
    const inserted = (action: string) => results.filter((_rows, idx) => jobs[idx][0] === action).reduce((n, rows) => n + rows.length, 0);
    assert(inserted('DELETE') === 1, `round ${i}: exactly one active DELETE`);
    assert(inserted('UPDATE') === 1, `round ${i}: exactly one active UPDATE`);
    assert(inserted('CREATE') === 1, `round ${i}: exactly one active CREATE`);
  }
}

function reserveService(db: Db) {
  const svc = Object.create(OmnichannelService.prototype) as Record<string, unknown>;
  svc.deliveries = {
    findOne: async (opts: { where: { eventId: string } }) => (await db.query(
      `SELECT * FROM "omnichannel_publication_deliveries" WHERE "eventId" = $1::uuid`, [opts.where.eventId],
    ))[0] || null,
    manager: { transaction: (fn: (tx: unknown) => Promise<unknown>) => db.transaction(fn as never) },
    query: (sql: string, params?: unknown[]) => db.query(sql, params),
  };
  svc.destinations = { findOne: async () => null };
  svc.connections = { findOne: async () => null };
  svc.loadStoredSettings = async () => ({});
  return svc as unknown as {
    reserveCreateSend: (i: { eventId: string; destinationId: string; connectionId: string; provider: string; channel: string }) => Promise<{ kind: string }>;
  };
}

async function reserveRace(db: Db) {
  const svc = reserveService(db);
  for (let i = 0; i < 10; i += 1) {
    const dest = randomUUID();
    const conn = randomUUID();
    const ev = await outbox(db);
    const id = await delivery(db, { action: 'CREATE', status: 'PENDING', key: `CREATE:PRODUCT:race${i}:${dest}`, destinationId: dest, eventId: ev });
    const input = { eventId: ev, destinationId: dest, connectionId: conn, provider: 'BALE', channel: 'RETAIL' };
    const results = await Promise.all([svc.reserveCreateSend(input), svc.reserveCreateSend(input)]);
    const kinds = results.map((r) => r.kind).sort().join(',');
    assert(kinds === 'send,stop', `round ${i}: exactly one send (got ${kinds})`);
    assert((await one(db, id)).status === 'PROCESSING', `round ${i}: winner left PROCESSING`);
  }
}

async function restart(db: Db) {
  const svc = reserveService(db);
  const dest = randomUUID();
  const ev = await outbox(db, 'PROCESSING', minutesAgo(10));
  const id = await delivery(db, { action: 'CREATE', status: 'PROCESSING', key: `CREATE:PRODUCT:restart:${dest}`, destinationId: dest, eventId: ev });
  const input = { eventId: ev, destinationId: dest, connectionId: randomUUID(), provider: 'BALE', channel: 'RETAIL' };
  const first = await svc.reserveCreateSend(input);
  assert(first.kind === 'stop', 'PROCESSING delivery after reclaim never sends again');
  const held = await one(db, id);
  assert(held.status === 'HOLD' && held.deferredReason === 'uncertain_after_timeout', 'reclaimed PROCESSING goes to HOLD uncertain_after_timeout');
  assert((await svc.reserveCreateSend(input)).kind === 'stop', 'HOLD is not auto-resent');
  assert((await one(db, id)).status === 'HOLD', 'no adapter-bound claim happened');
}

async function main() {
  const db = pgliteModule ? await openPglite(pgliteModule) : await openServer();
  try {
    await migrationAndIndex(db);
    await restart(db);
    // Single statements: runs on pglite too (queued), truly parallel on a server pool.
    await concurrentInserts(db);
    if (db.concurrent) {
      await reserveRace(db);
    } else {
      console.log('delivery-idempotency.integration.spec.ts: single-connection mode, reserveCreateSend race skipped');
    }
    console.log('delivery-idempotency.integration.spec.ts: ok');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
