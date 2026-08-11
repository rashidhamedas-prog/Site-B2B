/**
 * Unit checks for ownership-aware RMA migration (no live DB).
 * Prefer: npx ts-node --transpile-only src/database/migrations/20260810-001-create-return-requests.spec.ts
 */
import { QueryRunner } from 'typeorm';
import { CreateReturnRequests1754812800001 } from './20260810-001-create-return-requests';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

type SqlCall = { sql: string; params?: unknown[] };

type MockState = {
  tables: Set<string>;
  ownership: Set<string>;
  returnRequestRows: number;
  indexes: Set<string>;
  constraints: Set<string>;
  columns: Set<string>;
};

function ownershipKey(migrationName: string, objectName: string): string {
  return `${migrationName}::${objectName}`;
}

function createMockQueryRunner(initial?: Partial<MockState>): {
  runner: QueryRunner;
  calls: SqlCall[];
  state: MockState;
} {
  const state: MockState = {
    tables: new Set(initial?.tables ?? []),
    ownership: new Set(initial?.ownership ?? []),
    returnRequestRows: initial?.returnRequestRows ?? 0,
    indexes: new Set(initial?.indexes ?? []),
    constraints: new Set(initial?.constraints ?? []),
    columns: new Set(initial?.columns ?? []),
  };
  const calls: SqlCall[] = [];

  const runner = {
    async query(sql: string, params?: unknown[]): Promise<unknown> {
      calls.push({ sql, params });
      const normalized = sql.replace(/\s+/g, ' ').trim();

      // information_schema.tables existence probe
      if (
        /FROM information_schema\.tables/i.test(normalized) &&
        /table_name\s*=\s*\$1/i.test(normalized) &&
        !/table_constraints/i.test(normalized)
      ) {
        const tableName = String(params?.[0] ?? '');
        return state.tables.has(tableName) ? [{ exists: 1 }] : [];
      }

      // CREATE TABLE return_requests
      if (/CREATE TABLE IF NOT EXISTS "return_requests"/i.test(normalized)) {
        state.tables.add('return_requests');
        for (const col of [
          'id',
          'orderId',
          'orderItemId',
          'customerId',
          'reason',
          'requestedSize',
          'requestType',
          'status',
          'refundType',
          'adminNote',
          'processedAt',
          'processedByUserId',
          'processingMarker',
          'walletCreditAmount',
          'createdAt',
          'updatedAt',
        ]) {
          state.columns.add(col);
        }
        return undefined;
      }

      // CREATE ownership table
      if (/CREATE TABLE IF NOT EXISTS "schema_migration_ownership"/i.test(normalized)) {
        state.tables.add('schema_migration_ownership');
        return undefined;
      }

      // INSERT ownership
      if (/INSERT INTO "schema_migration_ownership"/i.test(normalized)) {
        const migrationName = String(params?.[0] ?? '');
        const objectName = String(params?.[1] ?? '');
        state.ownership.add(ownershipKey(migrationName, objectName));
        state.tables.add('schema_migration_ownership');
        return undefined;
      }

      // SELECT ownership
      if (/FROM "schema_migration_ownership"/i.test(normalized) && /SELECT 1/i.test(normalized)) {
        const migrationName = String(params?.[0] ?? '');
        const objectName = String(params?.[1] ?? '');
        return state.ownership.has(ownershipKey(migrationName, objectName))
          ? [{ '?column?': 1 }]
          : [];
      }

      // DELETE ownership
      if (/DELETE FROM "schema_migration_ownership"/i.test(normalized)) {
        const migrationName = String(params?.[0] ?? '');
        const objectName = String(params?.[1] ?? '');
        state.ownership.delete(ownershipKey(migrationName, objectName));
        return undefined;
      }

      // ADD COLUMN expand
      const addCol = normalized.match(/ADD COLUMN IF NOT EXISTS "(\w+)"/i);
      if (addCol) {
        state.columns.add(addCol[1]);
        return undefined;
      }

      // CREATE INDEX
      const createIdx = normalized.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS "([^"]+)"/i);
      if (createIdx) {
        state.indexes.add(createIdx[1]);
        return undefined;
      }

      // DROP INDEX
      const dropIdx = normalized.match(/DROP INDEX IF EXISTS "([^"]+)"/i);
      if (dropIdx) {
        state.indexes.delete(dropIdx[1]);
        return undefined;
      }

      // DROP CONSTRAINT
      const dropFk = normalized.match(/DROP CONSTRAINT IF EXISTS "([^"]+)"/i);
      if (dropFk) {
        state.constraints.delete(dropFk[1]);
        return undefined;
      }

      // FK DO blocks — treat as adding named constraints when referenced tables exist
      if (/ADD CONSTRAINT "FK_return_requests_/i.test(normalized)) {
        const names = [
          'FK_return_requests_orderId',
          'FK_return_requests_orderItemId',
          'FK_return_requests_customerId',
        ];
        for (const name of names) {
          if (normalized.includes(name)) state.constraints.add(name);
        }
        return undefined;
      }

      // DROP TABLE return_requests
      if (/DROP TABLE IF EXISTS "return_requests"/i.test(normalized)) {
        state.tables.delete('return_requests');
        state.returnRequestRows = 0;
        state.columns.clear();
        return undefined;
      }

      // Destructive data ops must never appear
      if (/\b(DELETE|TRUNCATE)\b/i.test(normalized) && /return_requests/i.test(normalized)) {
        throw new Error(`Unexpected destructive SQL against return_requests: ${normalized}`);
      }

      // COUNT probe (optional caller)
      if (/SELECT COUNT/i.test(normalized) && /return_requests/i.test(normalized)) {
        return [{ count: String(state.returnRequestRows) }];
      }

      return undefined;
    },
  } as QueryRunner;

  return { runner, calls, state };
}

function sqlIncludes(calls: SqlCall[], fragment: string): boolean {
  return calls.some((c) => c.sql.includes(fragment));
}

function sqlMatches(calls: SqlCall[], re: RegExp): boolean {
  return calls.some((c) => re.test(c.sql));
}

async function testUpOnEmptyCreatesAndClaimsOwnership() {
  const migration = new CreateReturnRequests1754812800001();
  const { runner, calls, state } = createMockQueryRunner();

  await migration.up(runner);

  assert(state.tables.has('return_requests'), 'up empty: creates return_requests');
  assert(state.tables.has('schema_migration_ownership'), 'up empty: creates ownership table');
  assert(
    state.ownership.has(ownershipKey(migration.name, 'return_requests')),
    'up empty: records ownership'
  );
  assert(
    sqlIncludes(calls, 'CREATE TABLE IF NOT EXISTS "return_requests"'),
    'up empty: CREATE TABLE'
  );
  assert(
    sqlIncludes(calls, 'INSERT INTO "schema_migration_ownership"'),
    'up empty: ownership INSERT'
  );
  assert(sqlIncludes(calls, 'ADD COLUMN IF NOT EXISTS "processedAt"'), 'up empty: still expands');
}

async function testUpOnExistingWithRowsExpandsOnlyNoOwnership() {
  const migration = new CreateReturnRequests1754812800001();
  const priorRows = 7;
  const { runner, calls, state } = createMockQueryRunner({
    tables: new Set(['return_requests']),
    returnRequestRows: priorRows,
    columns: new Set(['id', 'orderId', 'orderItemId', 'customerId', 'reason', 'status']),
  });

  await migration.up(runner);

  assert(
    !sqlIncludes(calls, 'CREATE TABLE IF NOT EXISTS "return_requests"'),
    'adoption: no CREATE'
  );
  assert(
    !sqlIncludes(calls, 'INSERT INTO "schema_migration_ownership"'),
    'adoption: no ownership claim'
  );
  assert(state.ownership.size === 0, 'adoption: ownership set empty');
  assert(
    sqlIncludes(calls, 'ADD COLUMN IF NOT EXISTS "processedAt"'),
    'adoption: expand processedAt'
  );
  assert(
    sqlIncludes(calls, 'ADD COLUMN IF NOT EXISTS "walletCreditAmount"'),
    'adoption: expand wallet'
  );
  assert(state.returnRequestRows === priorRows, 'adoption: prior rows untouched after up');

  const count = (await runner.query(`SELECT COUNT(*) AS count FROM "return_requests"`)) as Array<{
    count: string;
  }>;
  assert(Number(count[0].count) === priorRows, 'adoption: COUNT proves rows preserved after up');
}

async function testUpIdempotentSecondRun() {
  const migration = new CreateReturnRequests1754812800001();
  const { runner, calls, state } = createMockQueryRunner();

  await migration.up(runner);
  const firstOwnership = new Set(state.ownership);
  const createCallsFirst = calls.filter((c) =>
    c.sql.includes('CREATE TABLE IF NOT EXISTS "return_requests"')
  ).length;

  await migration.up(runner);

  const createCallsSecond = calls.filter((c) =>
    c.sql.includes('CREATE TABLE IF NOT EXISTS "return_requests"')
  ).length;
  assert(createCallsFirst === 1, 'idempotent: CREATE once on first up');
  assert(createCallsSecond === 1, 'idempotent: no second CREATE when table exists');
  assert(
    [...firstOwnership].every((k) => state.ownership.has(k)),
    'idempotent: ownership retained from first create'
  );
  assert(
    sqlIncludes(calls, 'ADD COLUMN IF NOT EXISTS "processingMarker"'),
    'idempotent: expand still runs'
  );
}

async function testDownAfterEmptyCreateDropsTableAndOwnership() {
  const migration = new CreateReturnRequests1754812800001();
  const { runner, calls, state } = createMockQueryRunner();

  await migration.up(runner);
  assert(state.tables.has('return_requests'), 'down owned setup: table present');
  await migration.down(runner);

  assert(!state.tables.has('return_requests'), 'down owned: DROP TABLE');
  assert(sqlIncludes(calls, 'DROP TABLE IF EXISTS "return_requests"'), 'down owned: DROP SQL');
  assert(
    !state.ownership.has(ownershipKey(migration.name, 'return_requests')),
    'down owned: ownership removed'
  );
  assert(
    sqlMatches(calls, /DROP CONSTRAINT IF EXISTS "FK_return_requests_orderId"/),
    'down: drops FK'
  );
  assert(
    sqlMatches(calls, /DROP INDEX IF EXISTS "UQ_return_requests_processingMarker"/),
    'down: drops index'
  );
}

async function testDownAfterAdoptionNoDropTable() {
  const migration = new CreateReturnRequests1754812800001();
  const priorRows = 5;
  const { runner, calls, state } = createMockQueryRunner({
    tables: new Set(['return_requests']),
    returnRequestRows: priorRows,
    columns: new Set(['id', 'orderId', 'processedAt']),
  });

  await migration.up(runner);
  await migration.down(runner);

  assert(state.tables.has('return_requests'), 'down adoption: table remains');
  assert(
    !sqlIncludes(calls, 'DROP TABLE IF EXISTS "return_requests"'),
    'down adoption: no DROP TABLE'
  );
  assert(state.returnRequestRows === priorRows, 'down adoption: rows not wiped');

  const count = (await runner.query(`SELECT COUNT(*) AS count FROM "return_requests"`)) as Array<{
    count: string;
  }>;
  assert(Number(count[0].count) === priorRows, 'down adoption: COUNT proves rows preserved');
  assert(sqlMatches(calls, /DROP CONSTRAINT IF EXISTS/), 'down adoption: still drops named FKs');
  assert(sqlMatches(calls, /DROP INDEX IF EXISTS/), 'down adoption: still drops named indexes');
}

async function main() {
  await testUpOnEmptyCreatesAndClaimsOwnership();
  await testUpOnExistingWithRowsExpandsOnlyNoOwnership();
  await testUpIdempotentSecondRun();
  await testDownAfterEmptyCreateDropsTableAndOwnership();
  await testDownAfterAdoptionNoDropTable();
  console.log('20260810-001-create-return-requests.spec.ts: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
