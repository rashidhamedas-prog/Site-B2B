import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unpaid ONLINE orders were created as PENDING_REVIEW before payment capture.
 * Move those leftovers out of the ops review queue.
 */
export class UnpaidOnlineAwaitingPayment1757692800007 implements MigrationInterface {
  name = 'UnpaidOnlineAwaitingPayment1757692800007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "orders" AS o
      SET status = 'AWAITING_PAYMENT'
      WHERE o.status = 'PENDING_REVIEW'
        AND UPPER(o."paymentMethod") = 'ONLINE'
        AND o.total::bigint > 0
        AND o."deletedAt" IS NULL
        AND o."voidedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "payments" p
          WHERE p."orderId" IS NOT NULL
            AND p."orderId" = o.id::text
            AND p.status = 'PAID'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "orders"
      SET status = 'PENDING_REVIEW'
      WHERE status = 'AWAITING_PAYMENT'
    `);
  }
}
