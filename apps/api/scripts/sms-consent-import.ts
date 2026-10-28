/**
 * Import SMS promo consents from a documented CSV (phone + customerId).
 *
 * NEVER invent consent from the whole customers table.
 * Default mode is --dry-run (SELECT counts only). --apply requires backup proof
 * and --confirm=<insertableCount>. Writes are INSERT … ON CONFLICT DO NOTHING only;
 * rollback deletes only rows with source=OWNER_IMPORT_<batch>.
 *
 * Do not run against production without an explicit Hamed GO + legal basis check.
 *
 *   npx ts-node --transpile-only scripts/sms-consent-import.ts --csv=./consents.csv
 *   npx ts-node --transpile-only scripts/sms-consent-import.ts --csv=./consents.csv --dry-run
 *   npx ts-node --transpile-only scripts/sms-consent-import.ts \
 *     --apply --csv=./consents.csv --batch=20261028A --confirm=12 \
 *     --backup=/var/backups/marketing_consents.dump \
 *     --backup-checksum=<sha256>
 *   npx ts-node --transpile-only scripts/sms-consent-import.ts \
 *     --rollback --batch=20261028A --confirm=12
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { normalizeIranMobileStrict } from '../src/modules/sms-panel/domain/phone';

export const CONSENT_CHANNEL = 'SMS' as const;
export const CONSENT_STATUS = 'GRANTED' as const;
export const OWNER_IMPORT_PREFIX = 'OWNER_IMPORT_';
export const MAX_BATCH_LEN = 32 - OWNER_IMPORT_PREFIX.length;

export type ConsentImportMode = 'dry-run' | 'apply' | 'rollback';

export type ConsentImportCliOptions = {
  mode: ConsentImportMode;
  csvPath: string | null;
  batch: string;
  confirm: number | null;
  backupPath: string | null;
  backupChecksum: string | null;
};

export type ConsentCsvRow = {
  line: number;
  phoneRaw: string;
  customerId: string;
  phone: string | null;
};

export type ConsentLookupSets = {
  /** customerId → true when the customer row exists */
  customersFound: ReadonlySet<string>;
  /** customerIds that already have channel=SMS consent (any status) */
  existingConsentCustomerIds: ReadonlySet<string>;
  /** normalized phones on unsubscribe / suppression */
  optedOutPhones: ReadonlySet<string>;
  /** normalized phones on an active blacklist */
  blacklistedPhones: ReadonlySet<string>;
};

export type ClassifiedConsentRow = ConsentCsvRow & {
  reason:
    | 'invalid_phone'
    | 'invalid_customer_id'
    | 'customer_not_found'
    | 'existing_consent'
    | 'opt_out'
    | 'blacklist'
    | 'insertable';
};

export type ConsentImportCounts = {
  inputRows: number;
  customersFound: number;
  existingConsents: number;
  optOutOrBlacklistRejected: number;
  insertable: number;
  invalidPhone: number;
  invalidCustomerId: number;
  customerNotFound: number;
};

export type PlannedWrite =
  | {
      kind: 'insert_consent';
      customerId: string;
      channel: typeof CONSENT_CHANNEL;
      status: typeof CONSENT_STATUS;
      source: string;
    }
  | { kind: 'delete_batch'; source: string };

export type ConsentImportPlan = {
  mode: ConsentImportMode;
  source: string;
  counts: ConsentImportCounts;
  classified: ClassifiedConsentRow[];
  writes: PlannedWrite[];
};

export type SqlExecutor = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function positiveInteger(raw: string, flag: string): number {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer`);
  }
  return value;
}

export function ownerImportSource(batch: string): string {
  const trimmed = String(batch || '').trim();
  if (!trimmed) throw new Error('--batch is required and cannot be empty');
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new Error('--batch may only contain letters, digits, _ and -');
  }
  if (trimmed.length > MAX_BATCH_LEN) {
    throw new Error(`--batch must be at most ${MAX_BATCH_LEN} characters (source varchar(32))`);
  }
  return `${OWNER_IMPORT_PREFIX}${trimmed}`;
}

export function parseConsentImportArgs(argv: string[]): ConsentImportCliOptions {
  let mode: ConsentImportMode = 'dry-run';
  let csvPath: string | null = null;
  let batch = '';
  let confirm: number | null = null;
  let backupPath: string | null = null;
  let backupChecksum: string | null = null;
  let sawApply = false;
  let sawRollback = false;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      mode = 'dry-run';
    } else if (arg === '--apply') {
      mode = 'apply';
      sawApply = true;
    } else if (arg === '--rollback') {
      mode = 'rollback';
      sawRollback = true;
    } else if (arg.startsWith('--csv=')) {
      csvPath = arg.slice('--csv='.length).trim();
    } else if (arg.startsWith('--batch=')) {
      batch = arg.slice('--batch='.length).trim();
    } else if (arg.startsWith('--confirm=')) {
      confirm = positiveInteger(arg.slice('--confirm='.length), '--confirm');
    } else if (arg.startsWith('--backup=')) {
      backupPath = arg.slice('--backup='.length).trim();
    } else if (arg.startsWith('--backup-checksum=')) {
      backupChecksum = arg.slice('--backup-checksum='.length).trim().toLowerCase();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (sawApply && sawRollback) {
    throw new Error('--apply and --rollback cannot be combined');
  }
  if ((mode === 'apply' || mode === 'rollback') && !batch) {
    throw new Error(`${mode} requires --batch=<id>`);
  }
  if (mode !== 'rollback' && !csvPath) {
    throw new Error('--csv=<path> is required (except --rollback)');
  }

  return { mode, csvPath, batch, confirm, backupPath, backupChecksum };
}

/** Split a simple CSV line; supports quoted fields with commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function normalizeHeader(raw: string): string {
  return String(raw || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

/**
 * Parse a documented consent CSV. Required headers: phone, customerId
 * (aliases: mobile, customer_id). Does not invent rows from the DB.
 */
export function parseConsentCsv(text: string): ConsentCsvRow[] {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) throw new Error('CSV is empty');

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const phoneIdx = headers.findIndex((h) => h === 'phone' || h === 'mobile');
  const customerIdx = headers.findIndex(
    (h) => h === 'customerid' || h === 'customer' || h === 'id',
  );
  if (phoneIdx < 0 || customerIdx < 0) {
    throw new Error('CSV must include phone and customerId columns');
  }

  const rows: ConsentCsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    const phoneRaw = String(cols[phoneIdx] ?? '').trim();
    const customerId = String(cols[customerIdx] ?? '').trim();
    if (!phoneRaw && !customerId) continue;
    rows.push({
      line: i + 1,
      phoneRaw,
      customerId,
      phone: normalizeIranMobileStrict(phoneRaw),
    });
  }
  return rows;
}

export function classifyConsentRows(
  rows: ConsentCsvRow[],
  lookup: ConsentLookupSets,
): ClassifiedConsentRow[] {
  const seenInsertable = new Set<string>();
  const out: ClassifiedConsentRow[] = [];

  for (const row of rows) {
    if (!UUID_RE.test(row.customerId)) {
      out.push({ ...row, reason: 'invalid_customer_id' });
      continue;
    }
    if (!lookup.customersFound.has(row.customerId)) {
      out.push({ ...row, reason: 'customer_not_found' });
      continue;
    }
    if (!row.phone) {
      out.push({ ...row, reason: 'invalid_phone' });
      continue;
    }
    if (lookup.optedOutPhones.has(row.phone)) {
      out.push({ ...row, reason: 'opt_out' });
      continue;
    }
    if (lookup.blacklistedPhones.has(row.phone)) {
      out.push({ ...row, reason: 'blacklist' });
      continue;
    }
    if (lookup.existingConsentCustomerIds.has(row.customerId)) {
      out.push({ ...row, reason: 'existing_consent' });
      continue;
    }
    // One SMS consent per customerId in this batch.
    if (seenInsertable.has(row.customerId)) {
      out.push({ ...row, reason: 'existing_consent' });
      continue;
    }
    seenInsertable.add(row.customerId);
    out.push({ ...row, reason: 'insertable' });
  }
  return out;
}

export function summarizeClassified(classified: ClassifiedConsentRow[]): ConsentImportCounts {
  const customersFound = new Set<string>();
  let existingConsents = 0;
  let optOutOrBlacklistRejected = 0;
  let insertable = 0;
  let invalidPhone = 0;
  let invalidCustomerId = 0;
  let customerNotFound = 0;

  for (const row of classified) {
    switch (row.reason) {
      case 'invalid_phone':
        invalidPhone += 1;
        customersFound.add(row.customerId);
        break;
      case 'invalid_customer_id':
        invalidCustomerId += 1;
        break;
      case 'customer_not_found':
        customerNotFound += 1;
        break;
      case 'existing_consent':
        existingConsents += 1;
        customersFound.add(row.customerId);
        break;
      case 'opt_out':
      case 'blacklist':
        optOutOrBlacklistRejected += 1;
        customersFound.add(row.customerId);
        break;
      case 'insertable':
        insertable += 1;
        customersFound.add(row.customerId);
        break;
      default:
        break;
    }
  }

  return {
    inputRows: classified.length,
    customersFound: customersFound.size,
    existingConsents,
    optOutOrBlacklistRejected,
    insertable,
    invalidPhone,
    invalidCustomerId,
    customerNotFound,
  };
}

/**
 * Confirm gate for --apply / --rollback.
 * Wrong --confirm rejects; dry-run never requires it.
 */
export function assertConfirmGate(
  mode: ConsentImportMode,
  expectedCount: number,
  confirm: number | null,
): void {
  if (mode === 'dry-run') return;
  if (confirm == null) {
    throw new Error(`${mode} requires --confirm=<count> matching the planned row count`);
  }
  if (confirm !== expectedCount) {
    throw new Error(
      `--confirm=${confirm} does not match planned count ${expectedCount}; refusing ${mode}`,
    );
  }
}

/**
 * Apply requires a non-empty pg_dump of marketing_consents plus a matching sha256.
 * The script never runs pg_dump itself; the operator must supply both.
 */
export function assertBackupReady(opts: {
  mode: ConsentImportMode;
  backupPath: string | null;
  backupChecksum: string | null;
  fileExists?: (path: string) => boolean;
  fileSize?: (path: string) => number;
  fileSha256?: (path: string) => string;
}): void {
  if (opts.mode !== 'apply') return;
  if (!opts.backupPath) {
    throw new Error('--apply requires --backup=<path to pg_dump -t marketing_consents>');
  }
  if (!opts.backupChecksum || !/^[a-f0-9]{64}$/i.test(opts.backupChecksum)) {
    throw new Error('--apply requires --backup-checksum=<sha256 hex of the dump file>');
  }
  const exists = opts.fileExists ?? ((p) => existsSync(p));
  const sizeOf = opts.fileSize ?? ((p) => statSync(p).size);
  const hashOf =
    opts.fileSha256 ??
    ((p) => createHash('sha256').update(readFileSync(p)).digest('hex'));

  if (!exists(opts.backupPath)) {
    throw new Error(`backup file not found: ${opts.backupPath}`);
  }
  if (sizeOf(opts.backupPath) <= 0) {
    throw new Error(`backup file is empty: ${opts.backupPath}`);
  }
  const actual = hashOf(opts.backupPath).toLowerCase();
  if (actual !== opts.backupChecksum.toLowerCase()) {
    throw new Error('backup checksum mismatch; refusing --apply');
  }
}

export type BackupHooks = {
  fileExists?: (path: string) => boolean;
  fileSize?: (path: string) => number;
  fileSha256?: (path: string) => string;
};

/** Dry-run never schedules writes. Apply only inserts; rollback uses planConsentRollback. */
export function planConsentImport(input: {
  mode: Exclude<ConsentImportMode, 'rollback'>;
  batch: string;
  classified: ClassifiedConsentRow[];
  confirm: number | null;
  backupPath?: string | null;
  backupChecksum?: string | null;
  backupHooks?: BackupHooks;
}): ConsentImportPlan {
  const source = ownerImportSource(input.batch || (input.mode === 'dry-run' ? 'DRYRUN' : ''));
  const counts = summarizeClassified(input.classified);

  if (input.mode === 'dry-run') {
    return { mode: 'dry-run', source, counts, classified: input.classified, writes: [] };
  }

  assertBackupReady({
    mode: 'apply',
    backupPath: input.backupPath ?? null,
    backupChecksum: input.backupChecksum ?? null,
    ...input.backupHooks,
  });
  assertConfirmGate('apply', counts.insertable, input.confirm);
  const writes: PlannedWrite[] = input.classified
    .filter((r) => r.reason === 'insertable' && r.phone)
    .map((r) => ({
      kind: 'insert_consent' as const,
      customerId: r.customerId,
      channel: CONSENT_CHANNEL,
      status: CONSENT_STATUS,
      source,
    }));
  return { mode: 'apply', source, counts, classified: input.classified, writes };
}

export function planConsentRollback(input: {
  batch: string;
  rollbackRowCount: number;
  confirm: number | null;
}): ConsentImportPlan {
  const source = ownerImportSource(input.batch);
  assertConfirmGate('rollback', input.rollbackRowCount, input.confirm);
  const counts: ConsentImportCounts = {
    inputRows: input.rollbackRowCount,
    customersFound: 0,
    existingConsents: 0,
    optOutOrBlacklistRejected: 0,
    insertable: 0,
    invalidPhone: 0,
    invalidCustomerId: 0,
    customerNotFound: 0,
  };
  return {
    mode: 'rollback',
    source,
    counts,
    classified: [],
    writes: [{ kind: 'delete_batch', source }],
  };
}

export function isSelectOnlySql(sql: string): boolean {
  const trimmed = sql.replace(/^\s+/, '');
  return /^\s*SELECT\b/i.test(trimmed) && !/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i.test(sql);
}

export function buildInsertConsentSql(): { sql: string; paramCount: number } {
  // ON CONFLICT DO NOTHING — never UPDATE existing consent rows.
  const sql = `
    INSERT INTO marketing_consents ("id", "customerId", "channel", "status", "source", "updatedByUserId", "createdAt", "updatedAt")
    VALUES (uuid_generate_v4(), $1, $2, $3, $4, NULL, now(), now())
    ON CONFLICT ("customerId", "channel") DO NOTHING
  `.trim();
  return { sql, paramCount: 4 };
}

export function buildRollbackDeleteSql(source: string): { sql: string; params: string[] } {
  if (!source.startsWith(OWNER_IMPORT_PREFIX)) {
    throw new Error('rollback source must start with OWNER_IMPORT_');
  }
  return {
    sql: `DELETE FROM marketing_consents WHERE source = $1`,
    params: [source],
  };
}

export async function loadLookupSets(
  db: SqlExecutor,
  rows: ConsentCsvRow[],
): Promise<ConsentLookupSets> {
  const customerIds = [...new Set(rows.map((r) => r.customerId).filter((id) => UUID_RE.test(id)))];
  const phones = [
    ...new Set(rows.map((r) => r.phone).filter((p): p is string => !!p)),
  ];

  const customersFound = new Set<string>();
  const existingConsentCustomerIds = new Set<string>();
  const optedOutPhones = new Set<string>();
  const blacklistedPhones = new Set<string>();

  if (customerIds.length) {
    const found = await db.query<{ id: string }>(
      `SELECT id FROM customers WHERE id = ANY($1::uuid[])`,
      [customerIds],
    );
    for (const row of found) customersFound.add(String(row.id));

    const consents = await db.query<{ customerId: string }>(
      `SELECT "customerId" AS "customerId"
       FROM marketing_consents
       WHERE channel = $1 AND "customerId" = ANY($2::uuid[])`,
      [CONSENT_CHANNEL, customerIds],
    );
    for (const row of consents) existingConsentCustomerIds.add(String(row.customerId));
  }

  if (phones.length) {
    const unsubs = await db.query<{ phoneNormalized: string }>(
      `SELECT "phoneNormalized" AS "phoneNormalized"
       FROM sms_unsubscribe
       WHERE "phoneNormalized" = ANY($1::text[])
         AND ("resubscribedAt" IS NULL)`,
      [phones],
    );
    for (const row of unsubs) optedOutPhones.add(String(row.phoneNormalized));

    const suppressions = await db.query<{ phoneNormalized: string }>(
      `SELECT "phoneNormalized" AS "phoneNormalized"
       FROM marketing_suppressions
       WHERE "phoneNormalized" = ANY($1::text[])`,
      [phones],
    );
    for (const row of suppressions) optedOutPhones.add(String(row.phoneNormalized));

    const blacklist = await db.query<{ phoneNormalized: string }>(
      `SELECT "phoneNormalized" AS "phoneNormalized"
       FROM sms_blacklist
       WHERE "phoneNormalized" = ANY($1::text[])
         AND ("expiresAt" IS NULL OR "expiresAt" > now())
         AND (UPPER(scope) = 'ALL' OR UPPER(scope) = 'PROMO')`,
      [phones],
    );
    for (const row of blacklist) blacklistedPhones.add(String(row.phoneNormalized));
  }

  return { customersFound, existingConsentCustomerIds, optedOutPhones, blacklistedPhones };
}

export async function executePlan(db: SqlExecutor, plan: ConsentImportPlan): Promise<number> {
  if (plan.mode === 'dry-run') {
    if (plan.writes.length) {
      throw new Error('dry-run plan unexpectedly contains writes');
    }
    return 0;
  }

  let affected = 0;
  for (const write of plan.writes) {
    if (write.kind === 'insert_consent') {
      const { sql } = buildInsertConsentSql();
      const result = await db.query(sql, [
        write.customerId,
        write.channel,
        write.status,
        write.source,
      ]);
      // node-pg / typeorm raw may not return rowCount on INSERT DO NOTHING; treat as best-effort
      affected += Array.isArray(result) ? 0 : 0;
      void result;
      affected += 1; // attempted insert (conflict may no-op)
      continue;
    }
    if (write.kind === 'delete_batch') {
      const built = buildRollbackDeleteSql(write.source);
      await db.query(built.sql, built.params);
      affected += 1;
    }
  }
  return affected;
}

function printCounts(counts: ConsentImportCounts, mode: ConsentImportMode, source: string) {
  console.log(
    JSON.stringify({
      type: 'sms-consent-import',
      mode,
      source,
      inputRows: counts.inputRows,
      customersFound: counts.customersFound,
      existingConsents: counts.existingConsents,
      optOutOrBlacklistRejected: counts.optOutOrBlacklistRejected,
      insertable: counts.insertable,
      invalidPhone: counts.invalidPhone,
      invalidCustomerId: counts.invalidCustomerId,
      customerNotFound: counts.customerNotFound,
      writesScheduled: mode === 'dry-run' ? 0 : undefined,
    }),
  );
}

async function createStandaloneDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USER || 'taranom',
    password: process.env.DB_PASS || 'taranom_pass',
    database: process.env.DB_NAME || 'taranom_db',
    entities: [],
    migrationsRun: false,
    synchronize: false,
    logging: false,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await dataSource.initialize();
  return dataSource;
}

async function main(): Promise<void> {
  const options = parseConsentImportArgs(process.argv.slice(2));
  const dbAdapter = (ds: DataSource): SqlExecutor => ({
    query: (sql, params) => ds.query(sql, params),
  });

  if (options.mode === 'rollback') {
    const source = ownerImportSource(options.batch);
    const dataSource = await createStandaloneDataSource();
    try {
      const db = dbAdapter(dataSource);
      const existing = await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM marketing_consents WHERE source = $1`,
        [source],
      );
      const rollbackRowCount = Number(existing[0]?.n || 0);
      const plan = planConsentRollback({
        batch: options.batch,
        rollbackRowCount,
        confirm: options.confirm,
      });
      printCounts(
        {
          ...plan.counts,
          inputRows: rollbackRowCount,
          insertable: 0,
        },
        'rollback',
        source,
      );
      await executePlan(db, plan);
      console.log(JSON.stringify({ type: 'sms-consent-import-done', mode: 'rollback', source }));
    } finally {
      if (dataSource.isInitialized) await dataSource.destroy();
    }
    return;
  }

  const csvPath = resolve(String(options.csvPath));
  const rows = parseConsentCsv(readFileSync(csvPath, 'utf8'));
  // Dry-run still needs SELECTs for counts; never opens a write transaction.
  const dataSource = await createStandaloneDataSource();
  try {
    const db = dbAdapter(dataSource);
    const lookup = await loadLookupSets(db, rows);
    const classified = classifyConsentRows(rows, lookup);

    if (options.mode === 'dry-run') {
      const plan = planConsentImport({
        mode: 'dry-run',
        batch: options.batch || 'DRYRUN',
        classified,
        confirm: null,
      });
      printCounts(plan.counts, 'dry-run', plan.source);
      await executePlan(db, plan);
      return;
    }

    const plan = planConsentImport({
      mode: 'apply',
      batch: options.batch,
      classified,
      confirm: options.confirm,
      backupPath: options.backupPath,
      backupChecksum: options.backupChecksum,
    });
    printCounts(plan.counts, 'apply', plan.source);
    await executePlan(db, plan);
    console.log(
      JSON.stringify({
        type: 'sms-consent-import-done',
        mode: 'apply',
        source: plan.source,
        attemptedInserts: plan.writes.length,
      }),
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ type: 'fatal', message }));
    process.exit(1);
  });
}
