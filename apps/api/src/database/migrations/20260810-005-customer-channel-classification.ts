import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Separate customer channel classification from product DDL (20260810-002).
 *
 * Only applies definitive registration provenance fixes.
 * Conflicting / ambiguous rows are reported and left unchanged.
 * Snapshot table enables reversible down().
 */
export class CustomerChannelClassification1754827200001 implements MigrationInterface {
  name = 'CustomerChannelClassification1754827200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_channel_classification_snapshot" (
        "id" uuid PRIMARY KEY,
        "businessType" varchar,
        "type" varchar,
        "reason" varchar NOT NULL,
        "snapshottedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const b2bRetailConflict = await queryRunner.query(`
      SELECT COUNT(*)::int AS c FROM customers
      WHERE UPPER(COALESCE(type, '')) = 'B2B'
        AND UPPER(COALESCE("businessType", '')) = 'RETAIL'
    `);
    const retailNullBt = await queryRunner.query(`
      SELECT COUNT(*)::int AS c FROM customers
      WHERE UPPER(COALESCE(type, '')) IN ('RETAIL', 'B2C')
        AND ( "businessType" IS NULL OR TRIM("businessType") = '' )
    `);
    const ambiguous = await queryRunner.query(`
      SELECT COUNT(*)::int AS c FROM customers
      WHERE UPPER(COALESCE(type, '')) = 'B2B'
        AND ( "businessType" IS NULL OR TRIM("businessType") = '' )
    `);

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        migration: this.name,
        before: {
          b2bWithRetailBusinessType: Number(b2bRetailConflict?.[0]?.c ?? 0),
          retailOrB2cWithNullBusinessType: Number(retailNullBt?.[0]?.c ?? 0),
          ambiguousB2bNullBusinessType_leftUnchanged: Number(ambiguous?.[0]?.c ?? 0),
        },
      })
    );

    // Definitive: type=B2B + businessType=RETAIL is a known conflicting default → WHOLESALE.
    await queryRunner.query(`
      INSERT INTO "customer_channel_classification_snapshot" ("id", "businessType", "type", "reason")
      SELECT id, "businessType", type, 'B2B_RETAIL_CONFLICT'
      FROM customers
      WHERE UPPER(COALESCE(type, '')) = 'B2B'
        AND UPPER(COALESCE("businessType", '')) = 'RETAIL'
      ON CONFLICT ("id") DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE customers
      SET "businessType" = 'WHOLESALE'
      WHERE UPPER(COALESCE(type, '')) = 'B2B'
        AND UPPER(COALESCE("businessType", '')) = 'RETAIL'
    `);

    // Definitive: type already RETAIL/B2C with null businessType → RETAIL/B2C.
    await queryRunner.query(`
      INSERT INTO "customer_channel_classification_snapshot" ("id", "businessType", "type", "reason")
      SELECT id, "businessType", type, 'RETAIL_NULL_BUSINESSTYPE'
      FROM customers
      WHERE UPPER(COALESCE(type, '')) IN ('RETAIL', 'B2C')
        AND ( "businessType" IS NULL OR TRIM("businessType") = '' )
      ON CONFLICT ("id") DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE customers
      SET "businessType" = 'RETAIL', type = 'B2C'
      WHERE UPPER(COALESCE(type, '')) IN ('RETAIL', 'B2C')
        AND ( "businessType" IS NULL OR TRIM("businessType") = '' )
    `);

    const afterConflict = await queryRunner.query(`
      SELECT COUNT(*)::int AS c FROM customers
      WHERE UPPER(COALESCE(type, '')) = 'B2B'
        AND UPPER(COALESCE("businessType", '')) = 'RETAIL'
    `);
    const afterNull = await queryRunner.query(`
      SELECT COUNT(*)::int AS c FROM customers
      WHERE UPPER(COALESCE(type, '')) IN ('RETAIL', 'B2C')
        AND ( "businessType" IS NULL OR TRIM("businessType") = '' )
    `);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        migration: this.name,
        after: {
          b2bWithRetailBusinessType: Number(afterConflict?.[0]?.c ?? 0),
          retailOrB2cWithNullBusinessType: Number(afterNull?.[0]?.c ?? 0),
          ambiguousB2bNullBusinessType_leftUnchanged: Number(ambiguous?.[0]?.c ?? 0),
        },
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE customers c
      SET "businessType" = s."businessType",
          type = s."type"
      FROM "customer_channel_classification_snapshot" s
      WHERE c.id = s.id
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_channel_classification_snapshot"`);
  }
}
