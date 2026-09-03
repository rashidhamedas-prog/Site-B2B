import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive: invalidate JWTs issued before a password change. */
export class PasswordChangedAt1756923000006 implements MigrationInterface {
  name = 'PasswordChangedAt1756923000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordChangedAt"
    `);
  }
}
