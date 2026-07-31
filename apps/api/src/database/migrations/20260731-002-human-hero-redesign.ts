import { MigrationInterface, QueryRunner } from 'typeorm';

type HumanHeroSlide = {
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

const slidesByChannel: Record<'WHOLESALE' | 'RETAIL', HumanHeroSlide[]> = {
  WHOLESALE: [
    {
      brandEyebrow: 'پوشاک ترنم — عمده',
      headline: 'کیفیت قابل لمس برای ویترین شما',
      headlineAccent: 'ویترین شما',
      body: 'مانتو و شومیز زنانه، مستقیم از تولیدی مشهد؛ دوخت کنترل‌شده، قیمت عمده شفاف و ارسال به سراسر ایران.',
      imageUrl: '/banners/hero-human-2026/wholesale-03.webp',
      mobileImageUrl: '/banners/hero-human-2026/wholesale-03-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'مشاهده محصولات عمده',
      ctaHref: '/products',
    },
    {
      brandEyebrow: 'همکاری پایدار با بوتیک‌ها',
      headline: 'مدل‌های فروش‌پذیر برای ویترین شما',
      headlineAccent: 'ویترین شما',
      body: 'انتخاب‌های فصل با حداقل سفارش مشخص، موجودی قابل پیگیری و پشتیبانی مستقیم تیم فروش ترنم.',
      imageUrl: '/banners/hero-human-2026/wholesale-02.webp',
      mobileImageUrl: '/banners/hero-human-2026/wholesale-02-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'دیدن کالکشن عمده',
      ctaHref: '/products',
    },
    {
      brandEyebrow: 'مدل‌های کاربردی فصل',
      headline: 'انتخاب‌های پوشیدنی برای مشتریان شما',
      headlineAccent: 'مشتریان شما',
      body: 'مدل‌های کاربردی و قابل ست‌کردن برای فروش روزمره؛ با پشتیبانی مستقیم تیم عمده‌فروشی ترنم.',
      imageUrl: '/banners/hero-human-2026/wholesale-01.webp',
      mobileImageUrl: '/banners/hero-human-2026/wholesale-01-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'درخواست همکاری عمده',
      ctaHref: '/portal/register',
    },
  ],
  RETAIL: [
    {
      brandEyebrow: 'کالکشن تازه ترنم',
      headline: 'سبک، آرام و مناسب هر روز',
      headlineAccent: 'هر روز',
      body: 'مدل‌های خوش‌فرم زنانه با دوخت تولیدی ترنم؛ انتخابی راحت برای استایل روزمره شما.',
      imageUrl: '/banners/hero-human-2026/retail-01.webp',
      mobileImageUrl: '/banners/hero-human-2026/retail-01-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'مشاهده جدیدترین‌ها',
      ctaHref: '/products',
    },
    {
      brandEyebrow: 'سادگیِ همیشه پوشیدنی',
      headline: 'جزئیاتی که استایل را کامل می‌کند',
      headlineAccent: 'استایل را کامل می‌کند',
      body: 'شومیزهای روشن و کاربردی با پارچه خوش‌کیفیت و برش دقیق؛ برای روزهای کاری و قرارهای دوستانه.',
      imageUrl: '/banners/hero-human-2026/retail-02.webp',
      mobileImageUrl: '/banners/hero-human-2026/retail-02-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'دیدن محصولات',
      ctaHref: '/products',
    },
    {
      brandEyebrow: 'انتخاب شیک و ماندگار',
      headline: 'کت خوش‌دوخت برای لحظه‌های شما',
      headlineAccent: 'لحظه‌های شما',
      body: 'فرم متعادل، دوخت تمیز و رنگی که به‌سادگی با کمد شما هماهنگ می‌شود.',
      imageUrl: '/banners/hero-human-2026/retail-03.webp',
      mobileImageUrl: '/banners/hero-human-2026/retail-03-mobile.webp',
      imageAlt: '',
      presentation: 'overlay',
      ctaLabel: 'مشاهده کالکشن',
      ctaHref: '/products',
    },
  ],
};

export class HumanHeroRedesign1785456000002 implements MigrationInterface {
  name = 'HumanHeroRedesign1785456000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_content_human_hero_backups" (
        "channel" varchar NOT NULL,
        "pageKey" varchar NOT NULL,
        "heroProps" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("channel", "pageKey")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "site_content_human_hero_backups" ("channel", "pageKey", "heroProps")
      SELECT sc."channel", sc."pageKey", block.value->'props'
      FROM "site_contents" sc
      CROSS JOIN LATERAL jsonb_array_elements(sc."blocks") AS block(value)
      WHERE sc."pageKey" = 'home'
        AND sc."channel" IN ('WHOLESALE', 'RETAIL')
        AND block.value->>'type' = 'hero'
      ON CONFLICT ("channel", "pageKey") DO NOTHING
    `);

    for (const channel of ['WHOLESALE', 'RETAIL'] as const) {
      await this.replaceHero(queryRunner, channel, slidesByChannel[channel]);
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
      FROM "site_content_human_hero_backups" backup
      WHERE backup."channel" = sc."channel"
        AND backup."pageKey" = sc."pageKey"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "site_content_human_hero_backups"`);
  }

  private async replaceHero(
    queryRunner: QueryRunner,
    channel: 'WHOLESALE' | 'RETAIL',
    slides: HumanHeroSlide[]
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
      [JSON.stringify({ autoplayMs: 6500, slides }), channel]
    );
  }
}
