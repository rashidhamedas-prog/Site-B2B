import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Support ticketing for retail + wholesale (expand-only, idempotent).
 */
export class SupportTickets1759384800002 implements MigrationInterface {
  name = 'SupportTickets1759384800002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "support_tickets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "publicNumber" varchar(32) NOT NULL,
        "customerId" uuid NOT NULL,
        "channel" varchar(16) NOT NULL,
        "subject" varchar(200) NOT NULL,
        "category" varchar(32) NOT NULL DEFAULT 'OTHER',
        "priority" varchar(16) NOT NULL DEFAULT 'NORMAL',
        "status" varchar(32) NOT NULL DEFAULT 'OPEN',
        "orderId" uuid,
        "assigneeUserId" uuid,
        "lastCustomerMessageAt" TIMESTAMPTZ,
        "lastStaffMessageAt" TIMESTAMPTZ,
        "closedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ticketId" uuid NOT NULL,
        "authorType" varchar(16) NOT NULL,
        "authorUserId" uuid,
        "body" text NOT NULL,
        "isInternal" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_support_tickets_publicNumber"
      ON "support_tickets" ("publicNumber")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_support_tickets_customer_channel"
      ON "support_tickets" ("customerId", "channel", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_support_tickets_status_channel"
      ON "support_tickets" ("status", "channel", "updatedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_support_tickets_assignee"
      ON "support_tickets" ("assigneeUserId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_support_ticket_messages_ticket_created"
      ON "support_ticket_messages" ("ticketId", "createdAt")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "support_ticket_messages"
          ADD CONSTRAINT "FK_support_ticket_messages_ticket"
          FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "support_ticket_messages" DROP CONSTRAINT IF EXISTS "FK_support_ticket_messages_ticket"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "support_ticket_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "support_tickets"`);
  }
}
