/**
 * Regression for PG 42P08 "inconsistent types deduced for parameter $2".
 * npx ts-node --transpile-only src/modules/omnichannel/services/reserve-create-send-sql.spec.ts
 */
import {
  DEFER_CREATE_SQL,
  MARK_CREATE_HOLD_SQL,
  MARK_CREATE_SUCCEEDED_SQL,
  MARK_CREATE_UNCONFIRMED_SQL,
  REACTIVATE_CREATE_SQL,
  RESERVE_CREATE_COUNTS_SQL,
} from './reserve-create-send-sql';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function hasBareParam(sql: string, n: number): boolean {
  return new RegExp(`\\$${n}(?!::)`).test(sql);
}

{
  assert(RESERVE_CREATE_COUNTS_SQL.includes('$1::uuid'), 'counts $1::uuid');
  assert(RESERVE_CREATE_COUNTS_SQL.includes('$2::timestamptz'), 'counts $2::timestamptz');
  assert(RESERVE_CREATE_COUNTS_SQL.includes('$3::uuid'), 'counts $3::uuid');
  assert(RESERVE_CREATE_COUNTS_SQL.includes('$4::timestamptz'), 'counts $4::timestamptz');
  assert(RESERVE_CREATE_COUNTS_SQL.includes('$5::uuid'), 'counts $5::uuid');
  assert(RESERVE_CREATE_COUNTS_SQL.includes('$6::timestamptz'), 'counts $6::timestamptz');
  assert(!hasBareParam(RESERVE_CREATE_COUNTS_SQL, 2), 'counts must not leave bare $2 (42P08)');
}

for (const [name, sql] of [
  ['HOLD', MARK_CREATE_HOLD_SQL],
  ['unconfirmed', MARK_CREATE_UNCONFIRMED_SQL],
] as const) {
  assert(sql.includes('"deferredReason" = $2::text'), `${name} deferredReason $2::text`);
  assert(sql.includes('"lastError" = $2::text'), `${name} lastError $2::text`);
  assert(!hasBareParam(sql, 2), `${name} must not leave bare $2 (dual-bind 42P08)`);
}

{
  assert(MARK_CREATE_SUCCEEDED_SQL.includes('$1::uuid'), 'succeeded $1::uuid');
  assert(MARK_CREATE_SUCCEEDED_SQL.includes('$2::varchar'), 'succeeded $2::varchar');
  assert(MARK_CREATE_SUCCEEDED_SQL.includes('$3::text'), 'succeeded $3::text');
}

{
  assert(DEFER_CREATE_SQL.includes('$1::uuid'), 'defer $1::uuid');
  assert(DEFER_CREATE_SQL.includes('$2::text'), 'defer $2::text');
  assert(DEFER_CREATE_SQL.includes('$3::timestamptz'), 'defer $3::timestamptz');
}

{
  assert(REACTIVATE_CREATE_SQL.includes('$1::uuid'), 'reactivate $1::uuid');
  assert(REACTIVATE_CREATE_SQL.includes('$2::text'), 'reactivate $2::text');
  assert(REACTIVATE_CREATE_SQL.includes('$3::timestamptz'), 'reactivate $3::timestamptz');
  assert(REACTIVATE_CREATE_SQL.includes('$4::timestamptz'), 'reactivate $4::timestamptz');
  assert(!hasBareParam(REACTIVATE_CREATE_SQL, 2), 'reactivate must not leave bare $2');
}

console.log('reserve-create-send-sql.spec.ts: ok');
