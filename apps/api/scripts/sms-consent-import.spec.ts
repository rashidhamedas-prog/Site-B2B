import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertBackupReady,
  assertConfirmGate,
  buildInsertConsentSql,
  buildRollbackDeleteSql,
  classifyConsentRows,
  executePlan,
  isSelectOnlySql,
  ownerImportSource,
  parseConsentCsv,
  parseConsentImportArgs,
  planConsentImport,
  planConsentRollback,
  summarizeClassified,
  type ConsentCsvRow,
  type ConsentLookupSets,
  type SqlExecutor,
} from './sms-consent-import';

const CUST_A = '11111111-1111-4111-8111-111111111111';
const CUST_B = '22222222-2222-4222-8222-222222222222';
const CUST_C = '33333333-3333-4333-8333-333333333333';
const CUST_D = '44444444-4444-4444-8444-444444444444';

function baseLookup(over: Partial<ConsentLookupSets> = {}): ConsentLookupSets {
  return {
    customersFound: new Set([CUST_A, CUST_B, CUST_C, CUST_D]),
    existingConsentCustomerIds: new Set<string>(),
    optedOutPhones: new Set<string>(),
    blacklistedPhones: new Set<string>(),
    ...over,
  };
}

function row(
  partial: Partial<ConsentCsvRow> & Pick<ConsentCsvRow, 'customerId' | 'phoneRaw'>,
): ConsentCsvRow {
  return {
    line: partial.line ?? 2,
    phoneRaw: partial.phoneRaw,
    customerId: partial.customerId,
    phone: partial.phone ?? (partial.phoneRaw.startsWith('09') ? partial.phoneRaw : null),
  };
}

async function main() {
  // --- CLI defaults to dry-run ---
  const defaults = parseConsentImportArgs(['--csv=./sample.csv']);
  assert.equal(defaults.mode, 'dry-run');
  assert.equal(defaults.confirm, null);
  assert.equal(defaults.csvPath, './sample.csv');

  assert.throws(() => parseConsentImportArgs([]), /--csv/);
  assert.throws(() => parseConsentImportArgs(['--apply', '--csv=x.csv']), /--batch/);
  assert.throws(
    () => parseConsentImportArgs(['--apply', '--rollback', '--csv=x.csv', '--batch=b1']),
    /cannot be combined/,
  );
  assert.throws(() => parseConsentImportArgs(['--typo']), /Unknown/);

  const applyArgs = parseConsentImportArgs([
    '--apply',
    '--csv=./c.csv',
    '--batch=20261028A',
    '--confirm=3',
    '--backup=/var/backups/marketing_consents.dump',
    '--backup-checksum=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ]);
  assert.equal(applyArgs.mode, 'apply');
  assert.equal(applyArgs.confirm, 3);
  assert.equal(applyArgs.batch, '20261028A');
  assert.equal(ownerImportSource('20261028A'), 'OWNER_IMPORT_20261028A');
  assert.throws(() => ownerImportSource(''), /required/);
  assert.throws(() => ownerImportSource('x'.repeat(40)), /at most/);

  // --- CSV parse: documented phone + customerId only ---
  const parsed = parseConsentCsv(
    'phone,customerId\n09121234567,' +
      CUST_A +
      '\n+98 912 345 6789,' +
      CUST_B +
      '\n',
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].phone, '09121234567');
  assert.equal(parsed[1].phone, '09123456789');
  assert.throws(() => parseConsentCsv('name,email\na,b\n'), /phone and customerId/);
  assert.throws(() => parseConsentCsv(''), /empty/);

  // --- classify: opt-out / blacklist never insertable ---
  const classified = classifyConsentRows(
    [
      row({ customerId: CUST_A, phoneRaw: '09120000001', phone: '09120000001' }),
      row({ customerId: CUST_B, phoneRaw: '09120000002', phone: '09120000002' }),
      row({ customerId: CUST_C, phoneRaw: '09120000003', phone: '09120000003' }),
      row({ customerId: CUST_D, phoneRaw: '09120000004', phone: '09120000004' }),
      row({ customerId: 'not-a-uuid', phoneRaw: '09120000005', phone: '09120000005' }),
    ],
    baseLookup({
      optedOutPhones: new Set(['09120000002']),
      blacklistedPhones: new Set(['09120000003']),
      existingConsentCustomerIds: new Set([CUST_D]),
    }),
  );
  assert.equal(classified.find((r) => r.customerId === CUST_A)?.reason, 'insertable');
  assert.equal(classified.find((r) => r.customerId === CUST_B)?.reason, 'opt_out');
  assert.equal(classified.find((r) => r.customerId === CUST_C)?.reason, 'blacklist');
  assert.equal(classified.find((r) => r.customerId === CUST_D)?.reason, 'existing_consent');
  assert.equal(classified.find((r) => r.customerId === 'not-a-uuid')?.reason, 'invalid_customer_id');

  const counts = summarizeClassified(classified);
  assert.equal(counts.inputRows, 5);
  assert.equal(counts.insertable, 1);
  assert.equal(counts.optOutOrBlacklistRejected, 2);
  assert.equal(counts.existingConsents, 1);

  // --- dry-run plans zero writes ---
  const dryPlan = planConsentImport({
    mode: 'dry-run',
    batch: 'BATCH1',
    classified,
    confirm: null,
  });
  assert.equal(dryPlan.mode, 'dry-run');
  assert.deepEqual(dryPlan.writes, []);
  assert.equal(dryPlan.counts.insertable, 1);

  const seenSql: string[] = [];
  const recordingDb: SqlExecutor = {
    async query(sql: string) {
      seenSql.push(sql);
      return [];
    },
  };
  const dryAffected = await executePlan(recordingDb, dryPlan);
  assert.equal(dryAffected, 0);
  assert.equal(seenSql.length, 0, 'dry-run executePlan issues no SQL writes');

  // --- wrong --confirm rejects apply ---
  assert.throws(
    () =>
      planConsentImport({
        mode: 'apply',
        batch: 'BATCH1',
        classified,
        confirm: 99,
        backupPath: '/tmp/fake.dump',
        backupChecksum: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        backupHooks: {
          fileExists: () => true,
          fileSize: () => 128,
          fileSha256: () => 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      }),
    /does not match planned count/,
  );
  assert.throws(() => assertConfirmGate('apply', 3, null), /requires --confirm/);
  assert.throws(() => assertConfirmGate('apply', 3, 2), /does not match/);
  assertConfirmGate('dry-run', 3, null);

  // --- apply without backup rejected ---
  assert.throws(
    () =>
      assertBackupReady({
        mode: 'apply',
        backupPath: null,
        backupChecksum: null,
      }),
    /requires --backup/,
  );
  assert.throws(
    () =>
      assertBackupReady({
        mode: 'apply',
        backupPath: '/nope.dump',
        backupChecksum: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        fileExists: () => false,
      }),
    /not found/,
  );
  assert.throws(
    () =>
      assertBackupReady({
        mode: 'apply',
        backupPath: '/bad.dump',
        backupChecksum: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        fileExists: () => true,
        fileSize: () => 10,
        fileSha256: () => 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      }),
    /checksum mismatch/,
  );

  // --- apply with matching confirm + backup schedules INSERT only ---
  const applyPlan = planConsentImport({
    mode: 'apply',
    batch: 'BATCH1',
    classified,
    confirm: 1,
    backupPath: '/var/backups/marketing_consents.dump',
    backupChecksum: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    backupHooks: {
      fileExists: () => true,
      fileSize: () => 2048,
      fileSha256: () => 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    },
  });
  assert.equal(applyPlan.writes.length, 1);
  assert.equal(applyPlan.writes[0].kind, 'insert_consent');
  if (applyPlan.writes[0].kind === 'insert_consent') {
    assert.equal(applyPlan.writes[0].customerId, CUST_A);
    assert.equal(applyPlan.writes[0].channel, 'SMS');
    assert.equal(applyPlan.writes[0].status, 'GRANTED');
    assert.equal(applyPlan.writes[0].source, 'OWNER_IMPORT_BATCH1');
  }

  const insert = buildInsertConsentSql();
  assert.match(insert.sql, /INSERT\s+INTO\s+marketing_consents/i);
  assert.match(insert.sql, /ON CONFLICT\s*\(\s*"customerId"\s*,\s*"channel"\s*\)\s*DO NOTHING/i);
  assert.equal(/\bUPDATE\b/i.test(insert.sql), false);
  assert.equal(/\bDELETE\b/i.test(insert.sql), false);

  const rollback = planConsentRollback({ batch: 'BATCH1', rollbackRowCount: 1, confirm: 1 });
  assert.equal(rollback.writes.length, 1);
  assert.equal(rollback.writes[0].kind, 'delete_batch');
  assert.throws(
    () => planConsentRollback({ batch: 'BATCH1', rollbackRowCount: 1, confirm: 9 }),
    /does not match/,
  );
  const del = buildRollbackDeleteSql('OWNER_IMPORT_BATCH1');
  assert.match(del.sql, /^DELETE FROM marketing_consents WHERE source = \$1$/);
  assert.throws(() => buildRollbackDeleteSql('ADMIN_TOGGLE'), /OWNER_IMPORT_/);

  assert.equal(isSelectOnlySql('SELECT id FROM customers WHERE id = ANY($1)'), true);
  assert.equal(isSelectOnlySql('INSERT INTO marketing_consents VALUES (1)'), false);
  assert.equal(isSelectOnlySql('SELECT 1; DELETE FROM marketing_consents'), false);

  const source = readFileSync(join(__dirname, 'sms-consent-import.ts'), 'utf8');
  assert.match(source, /--dry-run/);
  assert.match(source, /ON CONFLICT[\s\S]*DO NOTHING/);
  assert.match(source, /OWNER_IMPORT_/);
  assert.equal(source.includes('FROM customers'), true);
  assert.equal(source.includes('UPDATE marketing_consents'), false);
  assert.equal(source.includes('DELETE FROM customers'), false);
  assert.equal(/\bTRUNCATE\s+TABLE\b/i.test(source), false);
  // Insert SQL is values-only; never INSERT…SELECT from customers.
  assert.equal(/\bSELECT\b/i.test(insert.sql), false);
  assert.match(source, /WHERE id = ANY\(\$1::uuid\[\]\)/);

  const blockedOnly = classifyConsentRows(
    [
      row({ customerId: CUST_B, phoneRaw: '09120000002', phone: '09120000002' }),
      row({ customerId: CUST_C, phoneRaw: '09120000003', phone: '09120000003' }),
    ],
    baseLookup({
      optedOutPhones: new Set(['09120000002']),
      blacklistedPhones: new Set(['09120000003']),
    }),
  );
  const blockedPlan = planConsentImport({
    mode: 'apply',
    batch: 'SAFE',
    classified: blockedOnly,
    confirm: 0,
    backupPath: '/x.dump',
    backupChecksum: '1111111111111111111111111111111111111111111111111111111111111111',
    backupHooks: {
      fileExists: () => true,
      fileSize: () => 1,
      fileSha256: () => '1111111111111111111111111111111111111111111111111111111111111111',
    },
  });
  assert.deepEqual(blockedPlan.writes, []);
  assert.equal(blockedPlan.counts.optOutOrBlacklistRejected, 2);
  assert.equal(blockedPlan.counts.insertable, 0);

  console.log('sms-consent-import.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
