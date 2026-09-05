import { MigrationInterface, QueryRunner } from 'typeorm';
import { matchCategorySeedBySlug } from '../../modules/category/category-seo-seed';

const CATEGORY_SLUGS = ['shomiz', 'women-coats', 'kaftan'] as const;

const BAMBER_SLUGS = ['kapshan-bamber-65', 'winter-wear00014'];
const BAMBER_SEO = {
  retailTitle: 'خرید کاپشن بامبری زنانه',
  retailDescription:
    'کاپشن بامبری زنانه با رویه مموری و قد حدود ۶۵ سانت؛ برای روزهای سرد، خرید تکی از فروشگاه ترنم در مشهد.',
  retailFocusKeyword: 'کاپشن بامبری زنانه',
};

/**
 * Apply this week's keyword owners to live CMS/category/product copy.
 * Does not replace hero images or DigiPay slides.
 */
export class KeywordWeekCopy1757055604005 implements MigrationInterface {
  name = 'KeywordWeekCopy1757055604005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "keyword_week_copy_backups" (
        "kind" varchar NOT NULL,
        "key" varchar NOT NULL,
        "payload" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("kind", "key")
      )
    `);

    for (const slug of CATEGORY_SLUGS) {
      const seed = matchCategorySeedBySlug(slug);
      if (!seed) continue;
      await queryRunner.query(
        `
          INSERT INTO "keyword_week_copy_backups" ("kind", "key", "payload")
          SELECT 'category', c.slug, to_jsonb(c)
          FROM "categories" c
          WHERE c.slug = $1 AND c."deletedAt" IS NULL
          ON CONFLICT ("kind", "key") DO NOTHING
        `,
        [slug],
      );
      await queryRunner.query(
        `
          UPDATE "categories"
          SET
            h1 = $1,
            "seoTitle" = $2,
            "seoDescription" = $3,
            "introText" = $4,
            "bottomContent" = $5,
            "wholesaleH1" = $6,
            "wholesaleSeoTitle" = $7,
            "wholesaleSeoDescription" = $8,
            "wholesaleIntroText" = $9,
            "wholesaleBottomContent" = $10,
            "updatedAt" = now()
          WHERE slug = $11 AND "deletedAt" IS NULL
        `,
        [
          seed.retail.h1,
          seed.retail.seoTitle,
          seed.retail.seoDescription,
          seed.retail.introText,
          seed.retail.bottomContent,
          seed.wholesale.h1,
          seed.wholesale.seoTitle,
          seed.wholesale.seoDescription,
          seed.wholesale.introText,
          seed.wholesale.bottomContent,
          slug,
        ],
      );
    }

    await queryRunner.query(
      `
        INSERT INTO "keyword_week_copy_backups" ("kind", "key", "payload")
        SELECT 'product-seo', p.slug, COALESCE(p."seoMeta", '{}'::jsonb)
        FROM "products" p
        WHERE p.slug = ANY($1::text[]) AND p."deletedAt" IS NULL
        ON CONFLICT ("kind", "key") DO NOTHING
      `,
      [BAMBER_SLUGS],
    );
    await queryRunner.query(
      `
        UPDATE "products"
        SET "seoMeta" = COALESCE("seoMeta", '{}'::jsonb) || $1::jsonb,
            "updatedAt" = now()
        WHERE slug = ANY($2::text[]) AND "deletedAt" IS NULL
      `,
      [JSON.stringify(BAMBER_SEO), BAMBER_SLUGS],
    );

    await this.patchBlockProps(queryRunner, 'RETAIL', 'home', 'categoryBanners', {
      headline: 'شومیز، کت، کاپشن و کفتان',
      body: 'شومیز برای بالاتنه روزمره، کت برای روی لباس، کاپشن برای سرما، کفتان وقتی یک تکه می‌خواهید.',
    });
    await this.patchBlockProps(queryRunner, 'RETAIL', 'chrome', 'chrome', {
      blurb: 'پوشاک ترنم در مشهد؛ خرید تکی از همان کارگاهی که برای بوتیک‌ها هم می‌دوزد.',
    });
    await this.patchBlockProps(queryRunner, 'RETAIL', 'about', 'text', {
      headline: 'درباره پوشاک ترنم',
      body: 'پوشاک ترنم در مشهد همان کارگاهی است که مانتو و شومیز را برای بوتیک‌ها هم می‌دوزد. این سایت فقط خرید تکی است.\n\nدفتر پخش: مشهد، میدان ۱۷ شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳. تماس: ۰۹۱۵۲۴۲۴۶۲۴',
    });
    await this.patchBlockProps(queryRunner, 'WHOLESALE', 'home', 'cta', {
      eyebrow: 'همکاری با تولیدی لباس',
      headline: 'بوتیک دارید؟ از کارگاه مشهد سفارش دهید',
      body: 'درخواست همکاری را بفرستید تا حساب بررسی شود. حداقل سفارش هر مدل از ۶ عدد است؛ قیمت عمده بعد از تأیید دیده می‌شود.',
      ctaLabel: 'درخواست همکاری',
      ctaHref: '/portal/register',
    });
    await this.patchBlockProps(queryRunner, 'WHOLESALE', 'chrome', 'chrome', {
      registerLabel: 'درخواست همکاری',
      registerHref: '/portal/register',
      brandTagline: 'تولیدی مانتو زنانه مشهد',
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "categories" c
      SET
        h1 = backup."payload"->>'h1',
        "seoTitle" = backup."payload"->>'seoTitle',
        "seoDescription" = backup."payload"->>'seoDescription',
        "introText" = backup."payload"->>'introText',
        "bottomContent" = backup."payload"->>'bottomContent',
        "wholesaleH1" = backup."payload"->>'wholesaleH1',
        "wholesaleSeoTitle" = backup."payload"->>'wholesaleSeoTitle',
        "wholesaleSeoDescription" = backup."payload"->>'wholesaleSeoDescription',
        "wholesaleIntroText" = backup."payload"->>'wholesaleIntroText',
        "wholesaleBottomContent" = backup."payload"->>'wholesaleBottomContent',
        "updatedAt" = now()
      FROM "keyword_week_copy_backups" backup
      WHERE backup.kind = 'category' AND backup.key = c.slug
    `);
    await queryRunner.query(`
      UPDATE "products" p
      SET "seoMeta" = backup."payload", "updatedAt" = now()
      FROM "keyword_week_copy_backups" backup
      WHERE backup.kind = 'product-seo' AND backup.key = p.slug
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "keyword_week_copy_backups"`);
  }

  private async patchBlockProps(
    queryRunner: QueryRunner,
    channel: 'RETAIL' | 'WHOLESALE',
    pageKey: string,
    type: string,
    props: Record<string, string>,
  ): Promise<void> {
    const backupKey = `${channel}:${pageKey}:${type}`;
    await queryRunner.query(
      `
        INSERT INTO "keyword_week_copy_backups" ("kind", "key", "payload")
        SELECT 'cms-block', $3, block.value
        FROM "site_contents" sc
        CROSS JOIN LATERAL jsonb_array_elements(sc."blocks") AS block(value)
        WHERE sc."channel" = $1
          AND sc."pageKey" = $2
          AND block.value->>'type' = $4
        LIMIT 1
        ON CONFLICT ("kind", "key") DO NOTHING
      `,
      [channel, pageKey, backupKey, type],
    );

    let sql = 'block.value';
    const params: unknown[] = [channel, pageKey, type];
    let i = 4;
    for (const [key, value] of Object.entries(props)) {
      sql = `jsonb_set(${sql}, '{props,${key}}', to_jsonb($${i}::text), true)`;
      params.push(value);
      i += 1;
    }

    await queryRunner.query(
      `
        UPDATE "site_contents" sc
        SET
          "blocks" = (
            SELECT jsonb_agg(
              CASE WHEN block.value->>'type' = $3 THEN ${sql} ELSE block.value END
              ORDER BY block.ordinality
            )
            FROM jsonb_array_elements(sc."blocks") WITH ORDINALITY AS block(value, ordinality)
          ),
          "updatedAt" = now()
        WHERE sc."channel" = $1
          AND sc."pageKey" = $2
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(sc."blocks") AS existing(value)
            WHERE existing.value->>'type' = $3
          )
      `,
      params,
    );
  }
}
