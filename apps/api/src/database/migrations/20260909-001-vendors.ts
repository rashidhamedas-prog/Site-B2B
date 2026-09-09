import { MigrationInterface, QueryRunner } from 'typeorm';

export class Vendors1757385600001 implements MigrationInterface {
  name = 'Vendors1757385600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vendors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(120) NOT NULL,
        "phone" varchar(15) NOT NULL,
        "userId" uuid NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'INVITED',
        "acceptSlaHours" integer NOT NULL,
        "settlementHoldDays" integer NOT NULL,
        "notes" text,
        "invitedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vendors_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vendors_userId" UNIQUE ("userId"),
        CONSTRAINT "UQ_vendors_phone" UNIQUE ("phone"),
        CONSTRAINT "FK_vendors_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vendors_phone" ON "vendors" ("phone")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vendors_status" ON "vendors" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vendors"`);
  }
}
