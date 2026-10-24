import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One-shot: delete product_variants whose size is outside the product size chart
 * (e.g. leftover «فری سایز» after FREE → CUSTOM 37–40 / MANUAL pack).
 * Order line snapshots keep size text; defaultRetailVariantId is ON DELETE SET NULL.
 */
export class PruneOrphanSizeVariants1761283200002 implements MigrationInterface {
  name = 'PruneOrphanSizeVariants1761283200002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tmp_orphan_size_variants`);
    await queryRunner.query(`
      CREATE TEMP TABLE tmp_orphan_size_variants AS
      SELECT pv.id
      FROM product_variants pv
      INNER JOIN products p ON p.id = pv."productId"
      WHERE p."deletedAt" IS NULL
        AND NULLIF(BTRIM(pv.size), '') IS NOT NULL
        AND (
          (
            UPPER(COALESCE(p."sizeType", 'FREE')) = 'CUSTOM'
            AND p."sizeLabels" IS NOT NULL
            AND jsonb_typeof(p."sizeLabels") = 'array'
            AND jsonb_array_length(p."sizeLabels") > 0
            AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(p."sizeLabels") AS lbl(label)
              WHERE BTRIM(lbl.label) = BTRIM(pv.size)
            )
          )
          OR (
            UPPER(COALESCE(p."sizeType", 'FREE')) = 'FREE'
            AND BTRIM(pv.size) <> 'فری سایز'
          )
          OR (
            UPPER(p."sizeType") = 'TWO'
            AND BTRIM(pv.size) NOT IN ('سایز ۱', 'سایز ۲')
          )
          OR (
            UPPER(p."sizeType") = 'THREE'
            AND BTRIM(pv.size) NOT IN ('سایز ۱', 'سایز ۲', 'سایز ۳')
          )
        )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'erp_variant_map'
        ) THEN
          DELETE FROM erp_variant_map m
          WHERE m."variantId" IN (SELECT id FROM tmp_orphan_size_variants);
        END IF;
      END $$
    `);

    await queryRunner.query(`
      DELETE FROM product_variants pv
      WHERE pv.id IN (SELECT id FROM tmp_orphan_size_variants)
    `);

    // Resync rolled-up stock after orphan deletes.
    await queryRunner.query(`
      UPDATE products p
      SET
        "wholesaleStock" = COALESCE(s.w, 0),
        "retailStock" = COALESCE(s.r, 0),
        stock = COALESCE(s.w, 0)
      FROM (
        SELECT
          v."productId" AS id,
          SUM(v."wholesaleStock")::int AS w,
          SUM(v."retailStock")::int AS r
        FROM product_variants v
        GROUP BY v."productId"
      ) s
      WHERE p.id = s.id
        AND p."deletedAt" IS NULL
    `);

    // Products that lost every variant still need zeroed stock.
    await queryRunner.query(`
      UPDATE products p
      SET "wholesaleStock" = 0, "retailStock" = 0, stock = 0
      WHERE p."deletedAt" IS NULL
        AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v."productId" = p.id)
        AND (COALESCE(p."wholesaleStock", 0) <> 0 OR COALESCE(p."retailStock", 0) <> 0 OR COALESCE(p.stock, 0) <> 0)
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible data cleanup; chart-aligned variants remain.
  }
}
