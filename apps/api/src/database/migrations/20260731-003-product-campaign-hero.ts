import { MigrationInterface, QueryRunner } from 'typeorm';

type HeroSlide = {
  brandEyebrow: string;
  headline: string;
  headlineAccent: string;
  body: string;
  imageUrl: string;
  mobileImageUrl: string;
  imageAlt: string;
  presentation: 'overlay';
  ctaLabel: string;
  ctaHref: string;
};

const slides: Record<'WHOLESALE' | 'RETAIL', HeroSlide[]> = {
  WHOLESALE: [
    {
      brandEyebrow: 'کالکشن واقعی ترنم — عمده',
      headline: 'مدل‌های واقعی برای ویترین شما',
      headlineAccent: 'ویترین شما',
      body: 'شومیز و کت‌های واقعی ترنم با رنگ‌بندی فروش‌پذیر، دوخت تولیدی و شرایط همکاری شفاف برای بوتیک‌ها.',
      imageUrl: '/banners/hero-product-2026-v2/wholesale-01.webp',
      mobileImageUrl: '/banners/hero-product-2026-v2/wholesale-01-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'مشاهده محصولات عمده',
      ctaHref: '/products',
    },
    {
      brandEyebrow: 'آماده برای ارسال به بوتیک',
      headline: 'سفارش منظم، بسته‌بندی حرفه‌ای',
      headlineAccent: 'بسته‌بندی حرفه‌ای',
      body: 'پک‌های عمده با موجودی قابل پیگیری، آماده‌سازی منظم و پشتیبانی مستقیم تیم فروش ترنم.',
      imageUrl: '/banners/hero-product-2026-v2/wholesale-02.webp',
      mobileImageUrl: '/banners/hero-product-2026-v2/wholesale-02-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'دیدن کالکشن عمده',
      ctaHref: '/products',
    },
    {
      brandEyebrow: 'کیفیت از نزدیک',
      headline: 'جزئیات دوختی که اعتماد می‌سازد',
      headlineAccent: 'اعتماد می‌سازد',
      body: 'پارچه لینن، جزئیات گلدوزی و دوخت کنترل‌شده؛ کیفیتی که پیش از رسیدن به ویترین بررسی می‌شود.',
      imageUrl: '/banners/hero-product-2026-v2/wholesale-03.webp',
      mobileImageUrl: '/banners/hero-product-2026-v2/wholesale-03-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'درخواست همکاری عمده',
      ctaHref: '/portal/register',
    },
  ],
  RETAIL: [
    {
      brandEyebrow: 'شومیز لینن گلرخ',
      headline: 'آبیِ آرام برای هر روز شما',
      headlineAccent: 'هر روز شما',
      body: 'شومیز لینن گلرخ با فرم آزاد، آستین سه‌ربع و رنگی که به‌سادگی با استایل روزمره هماهنگ می‌شود.',
      imageUrl: '/banners/hero-product-2026-v2/retail-01.webp',
      mobileImageUrl: '/banners/hero-product-2026-v2/retail-01-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'مشاهده جدیدترین‌ها',
      ctaHref: '/products',
    },
    {
      brandEyebrow: 'شومیز لینن بهگل — طرح قلب',
      headline: 'بهگل، جزئیات کوچک و دوست‌داشتنی',
      headlineAccent: 'دوست‌داشتنی',
      body: 'رنگ تمشکی و نقش‌های ظریف قلب روی لینن؛ انتخابی متفاوت برای روزهایی که رنگ بیشتری می‌خواهید.',
      imageUrl: '/banners/hero-product-2026-v2/retail-02-behgol.webp',
      mobileImageUrl: '/banners/hero-product-2026-v2/retail-02-behgol-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'دیدن محصولات',
      ctaHref: '/products',
    },
    {
      brandEyebrow: 'کت کتان کجراه مدل آلیس',
      headline: 'آلیس، استایل محکم و ماندگار',
      headlineAccent: 'محکم و ماندگار',
      body: 'کت سبز آلیس با کتان کجراه، جیب‌های کاربردی و فرمی که برای استایل روزمره ساخته شده است.',
      imageUrl: '/banners/hero-product-2026-v2/retail-03-alice.webp',
      mobileImageUrl: '/banners/hero-product-2026-v2/retail-03-alice-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'مشاهده کالکشن',
      ctaHref: '/products',
    },
  ],
};

export class ProductCampaignHero1785456000003 implements MigrationInterface {
  name = 'ProductCampaignHero1785456000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_content_product_hero_backups" (
        "channel" varchar NOT NULL,
        "pageKey" varchar NOT NULL,
        "heroProps" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("channel", "pageKey")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "site_content_product_hero_backups" ("channel", "pageKey", "heroProps")
      SELECT sc."channel", sc."pageKey", block.value->'props'
      FROM "site_contents" sc
      CROSS JOIN LATERAL jsonb_array_elements(sc."blocks") AS block(value)
      WHERE sc."pageKey" = 'home'
        AND sc."channel" IN ('WHOLESALE', 'RETAIL')
        AND block.value->>'type' = 'hero'
      ON CONFLICT ("channel", "pageKey") DO NOTHING
    `);
    for (const channel of ['WHOLESALE', 'RETAIL'] as const) {
      await this.replaceHero(queryRunner, channel, slides[channel]);
    }
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
      FROM "site_content_product_hero_backups" backup
      WHERE backup."channel" = sc."channel"
        AND backup."pageKey" = sc."pageKey"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "site_content_product_hero_backups"`);
  }

  private async replaceHero(
    queryRunner: QueryRunner,
    channel: 'WHOLESALE' | 'RETAIL',
    channelSlides: HeroSlide[]
  ): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "site_contents" sc
        SET "blocks" = (
              SELECT jsonb_agg(
                CASE WHEN block.value->>'type' = 'hero'
                  THEN jsonb_set(block.value, '{props}', $1::jsonb, true)
                  ELSE block.value END
                ORDER BY block.ordinality
              )
              FROM jsonb_array_elements(sc."blocks") WITH ORDINALITY AS block(value, ordinality)
            ),
            "updatedAt" = now()
        WHERE sc."channel" = $2
          AND sc."pageKey" = 'home'
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(sc."blocks") AS existing(value)
            WHERE existing.value->>'type' = 'hero'
          )
      `,
      [JSON.stringify({ autoplayMs: 6500, slides: channelSlides }), channel]
    );
  }
}
