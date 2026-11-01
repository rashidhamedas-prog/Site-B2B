/**
 * Integration spec against a real Postgres (not part of unit-specs.txt).
 * Run: SMS_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/<disposable_db> npx ts-node --transpile-only <this file>
 * marketing_consents / marketing_suppressions / sms_unsubscribe / sms_blacklist come from the real migrations,
 * so column types (varchar "customerId") match production.
 */
import * as assert from 'node:assert/strict';
import { ServiceUnavailableException } from '@nestjs/common';
import { Client } from 'pg';
import { CustomerMarketing1757318400002 } from '../../../database/migrations/20260908-002-customer-marketing';
import { SmsPanel1761475200002 } from '../../../database/migrations/20261026-002-sms-panel';
import { loadSourceHits, loadSuppressionPhones, type AudienceDb } from './audience-sources';
import { AudienceService } from './audience.service';

const PROD_DB_DENYLIST = /^(taranom_db|postgres|template0|template1)$/;

async function main() {
  const url = process.env.SMS_PG_TEST_URL;
  if (!url) {
    console.error('SMS_PG_TEST_URL is required (disposable Postgres database)');
    process.exit(1);
  }
  const dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!dbName || PROD_DB_DENYLIST.test(dbName)) {
    console.error(`refusing to run against database "${dbName}"`);
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  const schema = `sms_pg_spec_${process.pid}`;
  const db: AudienceDb = {
    query: async (sql, params) => (await client.query(sql, params as unknown[])).rows,
  };
  const runner = { query: (sql: string, params?: unknown[]) => client.query(sql, params) } as never;

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query(`
      CREATE TABLE customers (
        id uuid PRIMARY KEY,
        phone varchar NOT NULL,
        phone2 varchar,
        "businessName" varchar,
        "ownerName" varchar,
        type varchar,
        segment varchar,
        province varchar,
        city varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz
      )`);
    await client.query(`
      CREATE TABLE orders (
        id uuid PRIMARY KEY,
        "customerId" uuid NOT NULL,
        status varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz
      )`);
    await new CustomerMarketing1757318400002().up(runner);
    await new SmsPanel1761475200002().up(runner);

    const col = await client.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'marketing_consents' AND column_name = 'customerId'`,
      [schema],
    );
    assert.equal(col.rows[0]?.data_type, 'character varying');

    const ids = {
      consent: '11111111-1111-4111-8111-111111111111',
      noConsent: '22222222-2222-4222-8222-222222222222',
      unsub: '33333333-3333-4333-8333-333333333333',
      black: '44444444-4444-4444-8444-444444444444',
      retail: '55555555-5555-4555-8555-555555555555',
    };
    const phones = {
      consent: '09120000001',
      noConsent: '09120000002',
      unsub: '09120000003',
      black: '09120000004',
      retail: '09120000005',
    };
    await client.query(
      `INSERT INTO customers (id, phone, "businessName", "ownerName", type, city) VALUES
       ($1, $6, 'Shop A', 'Ali', 'WHOLESALE', 'تهران'),
       ($2, $7, 'Shop B', 'Bita', 'WHOLESALE', 'تهران'),
       ($3, $8, 'Shop C', 'Cyrus', 'WHOLESALE', 'شیراز'),
       ($4, $9, 'Shop D', 'Dara', 'WHOLESALE', 'شیراز'),
       ($5, $10, NULL, 'Elham', 'RETAIL', 'تبریز')`,
      [ids.consent, ids.noConsent, ids.unsub, ids.black, ids.retail,
        phones.consent, phones.noConsent, phones.unsub, phones.black, phones.retail],
    );
    await client.query(
      `INSERT INTO marketing_consents ("customerId", channel, status, source) VALUES
       ($1, 'SMS', 'GRANTED', 'checkout'),
       ($2, 'SMS', 'GRANTED', 'checkout'),
       ($3, 'SMS', 'GRANTED', 'checkout'),
       ($4, 'SMS', 'GRANTED', 'retail-signup')`,
      [ids.consent, ids.unsub, ids.black, ids.retail],
    );
    await client.query(
      `INSERT INTO orders (id, "customerId", status) VALUES
       ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', $1, 'DELIVERED')`,
      [ids.consent],
    );
    await client.query(`INSERT INTO sms_unsubscribe ("phoneNormalized", scope, source) VALUES ($1, 'PROMO', 'INBOUND_11')`, [phones.unsub]);
    await client.query(`INSERT INTO sms_blacklist ("phoneNormalized", scope, reason) VALUES ($1, 'ALL', 'spec')`, [phones.black]);

    // Regression premise: varchar "customerId" cannot be compared to uuid[].
    await assert.rejects(
      client.query(`SELECT 1 FROM marketing_consents WHERE "customerId" = ANY($1::uuid[])`, [[ids.consent]]),
      /character varying = uuid/,
    );

    const wholesale = await loadSourceHits(db, 'WHOLESALE', { wide: true, limit: 1000 });
    const byPhone = new Map(wholesale.hits.map((hit) => [hit.phoneRaw, hit]));
    assert.equal(wholesale.hits.length, 4);
    assert.equal(byPhone.get(phones.consent)?.promoConsent, true);
    assert.equal(byPhone.get(phones.consent)?.consentSource, 'checkout');
    assert.equal(byPhone.get(phones.consent)?.orderCount, 1);
    assert.equal(byPhone.get(phones.noConsent)?.promoConsent, false);

    const retail = await loadSourceHits(db, 'RETAIL', { wide: true, limit: 1000 });
    assert.equal(retail.hits.length, 1);
    assert.equal(retail.hits[0].promoConsent, true);
    assert.equal(retail.hits[0].consentSource, 'retail-signup');

    const flags = await loadSuppressionPhones(db, Object.values(phones));
    assert.deepEqual(flags.optedOut, [phones.unsub]);
    assert.deepEqual(flags.blacklisted, [phones.black]);

    const service = new AudienceService({ query: db.query } as never);
    const collected = await service.collect(['WHOLESALE', 'RETAIL']);
    assert.deepEqual(collected.partialSources, []);
    const contact = new Map(collected.contacts.map((row) => [row.phone, row]));
    assert.equal(contact.get(phones.consent)?.promoConsent, true);
    assert.equal(contact.get(phones.retail)?.promoConsent, true);
    assert.equal(contact.get(phones.unsub)?.optedOut, true);
    assert.equal(contact.get(phones.unsub)?.promoConsent, false);
    assert.equal(contact.get(phones.black)?.blacklisted, true);
    assert.equal(contact.get(phones.black)?.promoConsent, false);

    // Suppression lookup failure blocks preview/send instead of treating everyone as allowed.
    await client.query(`DROP TABLE sms_blacklist`);
    await assert.rejects(service.collect(['WHOLESALE', 'RETAIL']), (err: unknown) => {
      assert.ok(err instanceof ServiceUnavailableException);
      assert.equal((err.getResponse() as { code?: string }).code, 'SMS_SUPPRESSION_UNAVAILABLE');
      return true;
    });

    console.log('audience-sources.pg.spec OK');
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
