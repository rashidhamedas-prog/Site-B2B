import { MigrationInterface, QueryRunner } from 'typeorm';

const DIGIPAY_SLIDE = {
  brandEyebrow: 'پرداخت با دیجی‌پی',
  headline: 'خرید قسطی با دیجی‌پی در ترنم فعال شد',
  headlineAccent: 'ترنم',
  body: 'مدل دلخواهت را انتخاب کن و موقع پرداخت، دیجی‌پی را بزن — برای خریدی راحت‌تر و برنامه‌ریزی‌شده‌تر.',
  imageUrl: '/banners/digipay-installment-2026/retail-desktop.webp',
  mobileImageUrl: '/banners/digipay-installment-2026/retail-mobile.webp',
  imageAlt:
    'زن جوان با مانتو و کلاه کرمی در فروشگاه پوشاک، در حال نگاه به گوشی؛ کنار تصویر گوشی و کارت پرداخت سه‌بعدی بدون نوشته',
  presentation: 'overlay',
  overlayTone: 'light',
  ctaLabel: 'مشاهده محصولات',
  ctaHref: '/products',
};

/**
 * Prepend the DigiPay retail hero slide to published RETAIL home CMS.
 * Defaults.ts is only a fallback; live site_contents wins until this runs.
 */
export class DigipayRetailHero1756962000004 implements MigrationInterface {
  name = 'DigipayRetailHero1756962000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_content_digipay_hero_backups" (
        "channel" varchar NOT NULL,
        "pageKey" varchar NOT NULL,
        "heroProps" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("channel", "pageKey")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "site_content_digipay_hero_backups" ("channel", "pageKey", "heroProps")
      SELECT sc."channel", sc."pageKey", block.value->'props'
      FROM "site_contents" sc
      CROSS JOIN LATERAL jsonb_array_elements(sc."blocks") AS block(value)
      WHERE sc."pageKey" = 'home'
        AND sc."channel" = 'RETAIL'
        AND block.value->>'type' = 'hero'
      ON CONFLICT ("channel", "pageKey") DO NOTHING
    `);

    const rows: Array<{ blocks: unknown }> = await queryRunner.query(
      `SELECT "blocks" FROM "site_contents" WHERE "channel" = 'RETAIL' AND "pageKey" = 'home' LIMIT 1`,
    );
    const blocks = Array.isArray(rows[0]?.blocks) ? rows[0].blocks : null;
    if (!blocks) return;

    const next = (blocks as Array<Record<string, unknown>>).map((block) => {
      if (block.type !== 'hero' || !block.props || typeof block.props !== 'object') return block;
      const props = { ...(block.props as Record<string, unknown>) };
      const slides = Array.isArray(props.slides) ? [...props.slides] : [];
      const already = slides.some(
        (slide) =>
          slide &&
          typeof slide === 'object' &&
          (slide as { imageUrl?: string }).imageUrl === DIGIPAY_SLIDE.imageUrl,
      );
      if (!already) slides.unshift(DIGIPAY_SLIDE);
      props.slides = slides;
      if (typeof props.autoplayMs !== 'number') props.autoplayMs = 6500;
      return { ...block, props };
    });

    await queryRunner.query(
      `UPDATE "site_contents" SET "blocks" = $1::jsonb, "updatedAt" = now() WHERE "channel" = 'RETAIL' AND "pageKey" = 'home'`,
      [JSON.stringify(next)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "site_contents" sc
      SET "blocks" = (
            SELECT jsonb_agg(
              CASE WHEN block.value->>'type' = 'hero'
                THEN jsonb_set(block.value, '{props}', backup."heroProps", true)
                ELSE block.value END
              ORDER BY block.ordinality
            )
            FROM jsonb_array_elements(sc."blocks") WITH ORDINALITY AS block(value, ordinality)
          ),
          "updatedAt" = now()
      FROM "site_content_digipay_hero_backups" backup
      WHERE backup."channel" = sc."channel"
        AND backup."pageKey" = sc."pageKey"
        AND sc."channel" = 'RETAIL'
        AND sc."pageKey" = 'home'
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "site_content_digipay_hero_backups"`);
  }
}
