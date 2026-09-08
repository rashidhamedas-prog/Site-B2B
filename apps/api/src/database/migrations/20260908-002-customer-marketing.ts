import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerMarketing1757318400002 implements MigrationInterface {
  name = 'CustomerMarketing1757318400002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_consents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customerId" varchar NOT NULL,
        "channel" varchar(16) NOT NULL,
        "status" varchar(24) NOT NULL,
        "source" varchar(32) NOT NULL,
        "updatedByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_consents_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_consents_customer_channel"
      ON "marketing_consents" ("customerId", "channel")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_suppressions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "phoneNormalized" varchar NOT NULL,
        "reason" text,
        "createdByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_suppressions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_suppressions_phone"
      ON "marketing_suppressions" ("phoneNormalized")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_funnels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" varchar(16) NOT NULL,
        "code" varchar(64) NOT NULL,
        "title" varchar NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_funnels_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_funnels_channel_code"
      ON "marketing_funnels" ("channel", "code")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_funnel_steps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "funnelId" uuid NOT NULL,
        "sortOrder" integer NOT NULL,
        "code" varchar(64) NOT NULL,
        "title" varchar NOT NULL,
        "delaySeconds" integer NOT NULL DEFAULT 0,
        "actionType" varchar(16) NOT NULL DEFAULT 'SMS',
        "messageClass" varchar(24) NOT NULL DEFAULT 'NURTURE',
        "templateCode" varchar(80) NOT NULL,
        "conditions" jsonb NOT NULL DEFAULT '{}',
        "isActive" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_marketing_funnel_steps_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_funnel_steps_order"
      ON "marketing_funnel_steps" ("funnelId", "sortOrder")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_enrollments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customerId" varchar NOT NULL,
        "funnelId" varchar NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'ACTIVE',
        "currentStepCode" varchar(64),
        "nextRunAt" TIMESTAMPTZ,
        "nextActionType" varchar(16) NOT NULL DEFAULT 'NONE',
        "enrolledByUserId" uuid,
        "enrolledAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_enrollments_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_enrollments_customer_funnel"
      ON "marketing_enrollments" ("customerId", "funnelId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marketing_enrollments_next"
      ON "marketing_enrollments" ("status", "nextRunAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" varchar(16) NOT NULL,
        "code" varchar(80) NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "title" varchar NOT NULL,
        "medium" varchar(16) NOT NULL DEFAULT 'SMS',
        "messageClass" varchar(24) NOT NULL DEFAULT 'NURTURE',
        "body" text NOT NULL,
        "callScript" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_templates_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_templates_channel_code_ver"
      ON "marketing_templates" ("channel", "code", "version")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channel" varchar(16) NOT NULL,
        "title" varchar NOT NULL,
        "templateId" uuid,
        "messageClass" varchar(24) NOT NULL DEFAULT 'PROMO',
        "mode" varchar(16) NOT NULL DEFAULT 'OFF',
        "filter" jsonb NOT NULL DEFAULT '{}',
        "canaryAt" TIMESTAMPTZ,
        "canarySucceeded" boolean NOT NULL DEFAULT false,
        "createdByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_campaigns_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_sends" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customerId" uuid,
        "channel" varchar(16) NOT NULL,
        "phoneNormalized" varchar(20) NOT NULL DEFAULT '',
        "campaignId" uuid,
        "enrollmentId" uuid,
        "templateId" uuid,
        "templateCode" varchar(80),
        "messageClass" varchar(24) NOT NULL DEFAULT 'NURTURE',
        "mode" varchar(16) NOT NULL DEFAULT 'OFF',
        "status" varchar(16) NOT NULL DEFAULT 'QUEUED',
        "skipReason" varchar(32),
        "outboxEventId" uuid,
        "providerMessageId" varchar,
        "bodySnapshot" text NOT NULL,
        "idempotencyKey" varchar NOT NULL,
        "recipientActual" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_sends_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_marketing_sends_idempotency"
      ON "marketing_sends" ("idempotencyKey")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marketing_sends_phone_created"
      ON "marketing_sends" ("phoneNormalized", "createdAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_activities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customerId" varchar NOT NULL,
        "channel" varchar(16) NOT NULL,
        "type" varchar(16) NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "actorUserId" uuid,
        "occurredAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketing_activities_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marketing_activities_customer_time"
      ON "marketing_activities" ("customerId", "occurredAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_activities"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_sends"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_campaigns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_enrollments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_funnel_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_funnels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_suppressions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_consents"`);
  }
}
