import { MigrationInterface, QueryRunner } from 'typeorm';

export class SmsPanel1761475200002 implements MigrationInterface {
  name = 'SmsPanel1761475200002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_template" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" varchar(80) NOT NULL,
        "name" varchar(160) NOT NULL,
        "messageClass" varchar(24) NOT NULL,
        "body" text NOT NULL,
        "variables" jsonb NOT NULL DEFAULT '[]',
        "providerTemplateId" varchar(64),
        "version" integer NOT NULL DEFAULT 1,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdBy" uuid,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_template_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sms_template_key" ON "sms_template" ("key")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_contact_list" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(160) NOT NULL,
        "description" text,
        "type" varchar(16) NOT NULL,
        "filter" jsonb,
        "createdBy" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_contact_list_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_contact_list_member" (
        "listId" uuid NOT NULL,
        "phoneNormalized" varchar(16) NOT NULL,
        "customerId" varchar,
        "vars" jsonb NOT NULL DEFAULT '{}',
        "addedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_contact_list_member" PRIMARY KEY ("listId", "phoneNormalized")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_campaign" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(200) NOT NULL,
        "messageClass" varchar(24) NOT NULL,
        "templateId" uuid,
        "bodySnapshot" text NOT NULL,
        "listId" uuid,
        "segmentFilter" jsonb,
        "audienceSnapshotHash" varchar(128),
        "recipientCount" integer NOT NULL DEFAULT 0,
        "estimatedParts" integer NOT NULL DEFAULT 0,
        "estimatedCost" integer NOT NULL DEFAULT 0,
        "scheduledAt" TIMESTAMP,
        "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
        "createdBy" uuid,
        "confirmedBy" uuid,
        "approvedBy" uuid,
        "confirmedAt" TIMESTAMP,
        "approvedAt" TIMESTAMP,
        "rejectReason" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_campaign_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_confirmation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaignId" uuid NOT NULL,
        "tokenHash" varchar(128) NOT NULL,
        "payloadHash" varchar(128) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "usedAt" TIMESTAMP,
        "actorId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_confirmation_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sms_confirmation_campaign" ON "sms_confirmation" ("campaignId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_message" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaignId" uuid,
        "templateKey" varchar(80),
        "messageClass" varchar(24) NOT NULL,
        "phoneNormalized" varchar(16) NOT NULL,
        "customerId" varchar,
        "body" text NOT NULL,
        "parts" integer NOT NULL DEFAULT 1,
        "status" varchar(32) NOT NULL DEFAULT 'QUEUED',
        "skipReason" varchar(64),
        "attempts" integer NOT NULL DEFAULT 0,
        "nextAttemptAt" TIMESTAMP,
        "idempotencyKey" varchar(160) NOT NULL,
        "provider" varchar(32),
        "providerMessageId" varchar(80),
        "packId" varchar(80),
        "cost" integer,
        "deliveryState" varchar(32),
        "deliveredAt" TIMESTAMP,
        "lastError" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_message_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sms_message_idempotency" ON "sms_message" ("idempotencyKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sms_message_status_next" ON "sms_message" ("status", "nextAttemptAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sms_message_phone_created" ON "sms_message" ("phoneNormalized", "createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_unsubscribe" (
        "phoneNormalized" varchar(16) NOT NULL,
        "scope" varchar(16) NOT NULL DEFAULT 'PROMO',
        "source" varchar(24) NOT NULL,
        "at" TIMESTAMP NOT NULL DEFAULT now(),
        "resubscribedAt" TIMESTAMP,
        CONSTRAINT "PK_sms_unsubscribe_phone" PRIMARY KEY ("phoneNormalized")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_blacklist" (
        "phoneNormalized" varchar(16) NOT NULL,
        "scope" varchar(16) NOT NULL DEFAULT 'ALL',
        "reason" text NOT NULL,
        "createdBy" uuid,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_blacklist_phone" PRIMARY KEY ("phoneNormalized")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_inbound" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "providerId" varchar(120) NOT NULL,
        "from" varchar(16) NOT NULL,
        "body" text NOT NULL,
        "receivedAt" TIMESTAMP NOT NULL,
        "handledAs" varchar(32),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_inbound_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sms_inbound_provider" ON "sms_inbound" ("providerId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_audit_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actorId" uuid,
        "action" varchar(64) NOT NULL,
        "targetType" varchar(40),
        "targetId" varchar(80),
        "meta" jsonb NOT NULL DEFAULT '{}',
        "ip" varchar(64),
        "userAgent" text,
        "at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_audit_log_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_sms_audit_log_at" ON "sms_audit_log" ("at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sms_credit_snapshot" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "amount" integer NOT NULL,
        "unit" varchar(8) NOT NULL DEFAULT 'SMS',
        "at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sms_credit_snapshot_id" PRIMARY KEY ("id")
      )
    `);

    // Seed base templates (strict panel keys)
    await queryRunner.query(`
      INSERT INTO "sms_template" ("key", "name", "messageClass", "body", "variables", "version", "isActive")
      VALUES
        ('otp.login', 'رمز یکبار مصرف ورود', 'OTP', 'پوشاک ترنم\nکد تایید شما: {code}', '["code"]', 1, true),
        ('order.registered', 'ثبت سفارش', 'TRANSACTIONAL', 'پوشاک ترنم\nسفارش {orderNumber} ثبت شد و در انتظار بررسی است.', '["orderNumber"]', 1, true),
        ('order.confirmed', 'تأیید سفارش', 'TRANSACTIONAL', 'پوشاک ترنم\nسفارش {orderNumber} تایید شد و آماده‌سازی آن آغاز شده است.', '["orderNumber"]', 1, true),
        ('order.shipped', 'ارسال سفارش', 'TRANSACTIONAL', 'پوشاک ترنم\nسفارش {orderNumber} ارسال شد.{trackingLine}', '["orderNumber","trackingLine"]', 1, true),
        ('order.paymentReceived', 'دریافت پرداخت', 'TRANSACTIONAL', 'پوشاک ترنم\nپرداخت {amountToman} تومان با موفقیت ثبت شد.\nکد پیگیری: {refId}', '["amountToman","refId"]', 1, true),
        ('partner.commission.credited', 'اعتبار کمیسیون همکار', 'TRANSACTIONAL', 'پوشاک ترنم\n{partnerName} عزیز، کمیسیون {amountToman} تومان برای سفارش {orderNumber} به موجودی شما اضافه شد. موجودی: {balanceToman} تومان ({period}).', '["partnerName","amountToman","orderNumber","balanceToman","period"]', 1, true),
        ('partner.commission.settled', 'تسویه کمیسیون همکار', 'TRANSACTIONAL', 'پوشاک ترنم\nتسویه کمیسیون به مبلغ {amountToman} تومان انجام شد. کد پیگیری: {refId} — تاریخ: {date}', '["amountToman","refId","date"]', 1, true),
        ('promo.generic', 'تبلیغ عمومی', 'PROMO', 'پوشاک ترنم\n{name} عزیز از {city}، پیشنهاد ویژه ما را ببینید: {link}', '["name","city","link"]', 1, true)
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_credit_snapshot"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_audit_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_inbound"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_blacklist"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_unsubscribe"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_message"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_confirmation"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_campaign"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_contact_list_member"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_contact_list"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sms_template"`);
  }
}
