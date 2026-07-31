import { MigrationInterface, QueryRunner } from 'typeorm';

type CampaignSlide = {
  brandEyebrow: string;
  headline: string;
  headlineAccent: string;
  body: string;
  imageUrl: string;
  mobileImageUrl: string;
  imageAlt: string;
  presentation: 'artwork';
  ctaLabel: string;
  ctaHref: string;
};

const wholesaleSlides: CampaignSlide[] = [
  {
    brandEyebrow: 'پوشاک ترنم — عمده',
    headline: 'عمده‌فروشی پوشاک ترنم',
    headlineAccent: 'پوشاک ترنم',
    body: 'تولیدکننده مانتو، شومیز و پوشاک زنانه با قیمت عمده، کیفیت تضمینی و ارسال سریع.',
    imageUrl: '/banners/hero-campaign-2026/wholesale-01.webp',
    mobileImageUrl: '/banners/hero-campaign-2026/wholesale-01-mobile.webp',
    imageAlt: 'عمده‌فروشی پوشاک زنانه ترنم؛ مانتو و شومیز مستقیم از تولیدی',
    presentation: 'artwork',
    ctaLabel: 'مشاهده محصولات',
    ctaHref: '/products',
  },
  {
    brandEyebrow: 'همکاری با ترنم',
    headline: 'همکار خوب، تجارت بزرگ',
    headlineAccent: 'تجارت بزرگ',
    body: 'همراه مطمئن فروشگاه‌ها و بوتیک‌ها؛ تولید عمده، تنوع بالا، بسته‌بندی حرفه‌ای و ارسال به سراسر کشور.',
    imageUrl: '/banners/hero-campaign-2026/wholesale-02.webp',
    mobileImageUrl: '/banners/hero-campaign-2026/wholesale-02-mobile.webp',
    imageAlt: 'همکاری عمده پوشاک ترنم با فروشگاه‌ها و بوتیک‌های سراسر ایران',
    presentation: 'artwork',
    ctaLabel: 'مشاهده محصولات',
    ctaHref: '/products',
  },
  {
    brandEyebrow: 'کیفیت تولیدی ترنم',
    headline: 'کیفیت ترنم، اعتماد ماندگار',
    headlineAccent: 'اعتماد ماندگار',
    body: 'انتخابی مطمئن برای فروشگاه‌های حرفه‌ای؛ پارچه درجه‌یک، دوخت تضمینی، کنترل کیفیت و قیمت رقابتی.',
    imageUrl: '/banners/hero-campaign-2026/wholesale-03.webp',
    mobileImageUrl: '/banners/hero-campaign-2026/wholesale-03-mobile.webp',
    imageAlt: 'پارچه و کنترل کیفیت پوشاک عمده ترنم برای فروشگاه‌های حرفه‌ای',
    presentation: 'artwork',
    ctaLabel: 'همین حالا همکاری کنید',
    ctaHref: '/portal/register',
  },
];

const retailSlides: CampaignSlide[] = [
  {
    brandEyebrow: 'پوشاک زنانه ترنم',
    headline: 'استایل تو، امضای تو',
    headlineAccent: 'امضای تو',
    body: 'جدیدترین کالکشن مانتو، شومیز و پوشاک زنانه با کیفیت بالا، طراحی خاص و ارسال سریع.',
    imageUrl: '/banners/hero-campaign-2026/retail-01.webp',
    mobileImageUrl: '/banners/hero-campaign-2026/retail-01-mobile.webp',
    imageAlt: 'کالکشن پوشاک زنانه ترنم با کت صورتی و استایل روز',
    presentation: 'artwork',
    ctaLabel: 'مشاهده محصولات',
    ctaHref: '/products',
  },
  {
    brandEyebrow: 'کالکشن بهار و تابستان',
    headline: 'راحتی، زیبایی، برای هر روز تو',
    headlineAccent: 'هر روز تو',
    body: 'مدل‌های آزاد و خوش‌فرم با پارچه باکیفیت، طراحی مدرن، دوخت حرفه‌ای و سایزبندی متنوع.',
    imageUrl: '/banners/hero-campaign-2026/retail-02.webp',
    mobileImageUrl: '/banners/hero-campaign-2026/retail-02-mobile.webp',
    imageAlt: 'کالکشن راحت و روزمره زنانه ترنم برای بهار و تابستان',
    presentation: 'artwork',
    ctaLabel: 'مشاهده محصولات',
    ctaHref: '/products',
  },
  {
    brandEyebrow: 'کالکشن بهار',
    headline: 'زیبایی در هر جزئیات',
    headlineAccent: 'هر جزئیات',
    body: 'مانتو، شومیز، کت و شلوار و دامن زنانه؛ ظرافت در طراحی و کیفیت در دوخت.',
    imageUrl: '/banners/hero-campaign-2026/retail-03.webp',
    mobileImageUrl: '/banners/hero-campaign-2026/retail-03-mobile.webp',
    imageAlt: 'استایل بهاری زنانه ترنم با مانتو سبز و جزئیات ظریف',
    presentation: 'artwork',
    ctaLabel: 'مشاهده محصولات',
    ctaHref: '/products',
  },
];

export class HeroCampaignBanners1785456000001 implements MigrationInterface {
  name = 'HeroCampaignBanners1785456000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_content_hero_campaign_backups" (
        "channel" varchar NOT NULL,
        "pageKey" varchar NOT NULL,
        "heroProps" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("channel", "pageKey")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "site_content_hero_campaign_backups" ("channel", "pageKey", "heroProps")
      SELECT sc."channel", sc."pageKey", block.value->'props'
      FROM "site_contents" sc
      CROSS JOIN LATERAL jsonb_array_elements(sc."blocks") AS block(value)
      WHERE sc."pageKey" = 'home'
        AND sc."channel" IN ('WHOLESALE', 'RETAIL')
        AND block.value->>'type' = 'hero'
      ON CONFLICT ("channel", "pageKey") DO NOTHING
    `);

    await this.replaceHero(queryRunner, 'WHOLESALE', wholesaleSlides);
    await this.replaceHero(queryRunner, 'RETAIL', retailSlides);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "site_contents" sc
      SET "blocks" = (
            SELECT jsonb_agg(
              CASE
                WHEN block.value->>'type' = 'hero'
                  THEN jsonb_set(block.value, '{props}', backup."heroProps", true)
                ELSE block.value
              END
              ORDER BY block.ordinality
            )
            FROM jsonb_array_elements(sc."blocks") WITH ORDINALITY AS block(value, ordinality)
          ),
          "updatedAt" = now()
      FROM "site_content_hero_campaign_backups" backup
      WHERE backup."channel" = sc."channel"
        AND backup."pageKey" = sc."pageKey"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "site_content_hero_campaign_backups"`);
  }

  private async replaceHero(
    queryRunner: QueryRunner,
    channel: 'WHOLESALE' | 'RETAIL',
    slides: CampaignSlide[]
  ): Promise<void> {
    const props = JSON.stringify({ autoplayMs: 6000, slides });
    await queryRunner.query(
      `
        UPDATE "site_contents" sc
        SET "blocks" = (
              SELECT jsonb_agg(
                CASE
                  WHEN block.value->>'type' = 'hero'
                    THEN jsonb_set(block.value, '{props}', $1::jsonb, true)
                  ELSE block.value
                END
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
      [props, channel]
    );
  }
}
