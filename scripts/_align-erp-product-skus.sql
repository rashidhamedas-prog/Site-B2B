CREATE TABLE IF NOT EXISTS product_sku_aliases (
  sku varchar(191) PRIMARY KEY,
  "productId" uuid NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_product_sku_aliases_productId"
  ON product_sku_aliases ("productId");

WITH pairs(erp, site_sku) AS (
  VALUES
    ('7080', 'SKIRT-SUITS00001'),
    ('7102', 'KAFTANS00001'),
    ('7122', 'BLOUSES00017'),
    ('7126', 'COATS00012'),
    ('7132', 'WINTER-WEAR00006'),
    ('7136', 'COATS00003'),
    ('7137', 'COATS00005'),
    ('7141', 'COATS00006'),
    ('7142', 'WINTER-WEAR00009'),
    ('7143', 'WINTER-WEAR00005'),
    ('7147', 'BLOUSES00001'),
    ('7151', 'COATS00007'),
    ('7152', 'WINTER-WEAR00003'),
    ('7154', 'COATS00002'),
    ('7155', 'COATS00004'),
    ('7157', 'COATS00001'),
    ('7181', 'VESTS-SKIRTS00001'),
    ('K-00001', 'AUTUMN00010'),
    ('K-00002', 'AUTUMN00009'),
    ('K-00003', 'AUTUMN00008'),
    ('K-00004', 'AUTUMN00007'),
    ('K-00005', 'AUTUMN00006'),
    ('K-00006', 'AUTUMN00005'),
    ('K-00007', 'AUTUMN00011'),
    ('K-00008', 'AUTUMN00012'),
    ('K-00009', 'AUTUMN00013'),
    ('K-00010', 'AUTUMN00004'),
    ('K-00011', 'AUTUMN00003'),
    ('K-00012', 'AUTUMN00002'),
    ('K-00013', 'AUTUMN00001')
),
ready AS (
  SELECT p.id, p.sku AS old_sku, pr.erp
  FROM pairs pr
  JOIN products p ON p.sku = pr.site_sku AND p."deletedAt" IS NULL
  WHERE NOT EXISTS (
    SELECT 1 FROM products x
    WHERE x."deletedAt" IS NULL AND x.sku = pr.erp AND x.id <> p.id
  )
)
INSERT INTO product_sku_aliases (sku, "productId", "createdAt")
SELECT old_sku, id, NOW() FROM ready
ON CONFLICT (sku) DO UPDATE SET "productId" = EXCLUDED."productId";

WITH pairs(erp, site_sku) AS (
  VALUES
    ('7080', 'SKIRT-SUITS00001'),
    ('7102', 'KAFTANS00001'),
    ('7122', 'BLOUSES00017'),
    ('7126', 'COATS00012'),
    ('7132', 'WINTER-WEAR00006'),
    ('7136', 'COATS00003'),
    ('7137', 'COATS00005'),
    ('7141', 'COATS00006'),
    ('7142', 'WINTER-WEAR00009'),
    ('7143', 'WINTER-WEAR00005'),
    ('7147', 'BLOUSES00001'),
    ('7151', 'COATS00007'),
    ('7152', 'WINTER-WEAR00003'),
    ('7154', 'COATS00002'),
    ('7155', 'COATS00004'),
    ('7157', 'COATS00001'),
    ('7181', 'VESTS-SKIRTS00001'),
    ('K-00001', 'AUTUMN00010'),
    ('K-00002', 'AUTUMN00009'),
    ('K-00003', 'AUTUMN00008'),
    ('K-00004', 'AUTUMN00007'),
    ('K-00005', 'AUTUMN00006'),
    ('K-00006', 'AUTUMN00005'),
    ('K-00007', 'AUTUMN00011'),
    ('K-00008', 'AUTUMN00012'),
    ('K-00009', 'AUTUMN00013'),
    ('K-00010', 'AUTUMN00004'),
    ('K-00011', 'AUTUMN00003'),
    ('K-00012', 'AUTUMN00002'),
    ('K-00013', 'AUTUMN00001')
)
UPDATE products p
SET sku = pr.erp, "updatedAt" = NOW()
FROM pairs pr
WHERE p.sku = pr.site_sku
  AND p."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM products x
    WHERE x."deletedAt" IS NULL AND x.sku = pr.erp AND x.id <> p.id
  );

WITH names(erp, erp_name) AS (
  VALUES
    ('7080', 'کت و دامن کتان طنین'),
    ('7102', 'کفتان لینن آفاق'),
    ('7122', 'بلوز لینن سارا'),
    ('7126', 'کراپ کت کتان آرامیس'),
    ('7132', 'کت پشمی کتایون'),
    ('7136', 'مانتو کتان ماهان'),
    ('7137', 'کت کتان کیان'),
    ('7141', 'اورکت کتان لاله'),
    ('7142', 'کت فوتر آرکا'),
    ('7143', 'کت فوتر دالیا'),
    ('7147', 'شومیز کتان نازگل'),
    ('7151', 'کت کتان خزدار بهرخ'),
    ('7152', 'کت فوتر تیارا'),
    ('7154', 'بامبر کتان غزل'),
    ('7155', 'کت کتان آلیس'),
    ('7157', 'کت کتان درسا'),
    ('7181', 'وست و دامن لینن باران'),
    ('K-00001', 'بامبر زارا 663'),
    ('K-00002', 'وست زارا 662'),
    ('K-00003', 'چرم کلاه دار 654'),
    ('K-00004', 'چرم باکسی 653'),
    ('K-00005', 'وست چرم آستردار CoCo'),
    ('K-00006', 'بامبر چرم آستردار CoCo'),
    ('K-00007', 'لی خلبانی Sonel'),
    ('K-00008', 'شلوار فوتر لامر بگ'),
    ('K-00009', 'شلوار فوتر کش بگ'),
    ('K-00010', 'ست یقه پلوشرت با شلوار'),
    ('K-00011', 'ست نیویورک با شلوار'),
    ('K-00012', 'نیم زیپ با شلوار'),
    ('K-00013', 'کراپ و شلوار')
)
UPDATE products p
SET name = n.erp_name, "updatedAt" = NOW()
FROM names n
WHERE p.sku = n.erp AND p."deletedAt" IS NULL;

WITH pairs(erp, site_sku) AS (
  VALUES
    ('7080', 'SKIRT-SUITS00001'),
    ('7102', 'KAFTANS00001'),
    ('7122', 'BLOUSES00017'),
    ('7126', 'COATS00012'),
    ('7132', 'WINTER-WEAR00006'),
    ('7136', 'COATS00003'),
    ('7137', 'COATS00005'),
    ('7141', 'COATS00006'),
    ('7142', 'WINTER-WEAR00009'),
    ('7143', 'WINTER-WEAR00005'),
    ('7147', 'BLOUSES00001'),
    ('7151', 'COATS00007'),
    ('7152', 'WINTER-WEAR00003'),
    ('7154', 'COATS00002'),
    ('7155', 'COATS00004'),
    ('7157', 'COATS00001'),
    ('7181', 'VESTS-SKIRTS00001'),
    ('K-00001', 'AUTUMN00010'),
    ('K-00002', 'AUTUMN00009'),
    ('K-00003', 'AUTUMN00008'),
    ('K-00004', 'AUTUMN00007'),
    ('K-00005', 'AUTUMN00006'),
    ('K-00006', 'AUTUMN00005'),
    ('K-00007', 'AUTUMN00011'),
    ('K-00008', 'AUTUMN00012'),
    ('K-00009', 'AUTUMN00013'),
    ('K-00010', 'AUTUMN00004'),
    ('K-00011', 'AUTUMN00003'),
    ('K-00012', 'AUTUMN00002'),
    ('K-00013', 'AUTUMN00001')
)
INSERT INTO erp_product_map ("erpProductSku", "productId", "matchedBy", "createdAt", "updatedAt")
SELECT pr.erp, p.id, 'sku_align', NOW(), NOW()
FROM pairs pr
JOIN products p ON p.sku = pr.erp AND p."deletedAt" IS NULL
ON CONFLICT ("erpProductSku") DO UPDATE
  SET "productId" = EXCLUDED."productId",
      "matchedBy" = EXCLUDED."matchedBy",
      "updatedAt" = NOW();

DELETE FROM erp_inventory_idempotency;

SELECT p.sku AS erp_sku, a.sku AS alias_sku, p.name
FROM products p
LEFT JOIN product_sku_aliases a ON a."productId" = p.id
WHERE p.sku IN (
  '7080','7102','7122','7126','7132','7136','7137','7141','7142','7143','7147',
  '7151','7152','7154','7155','7157','7181',
  'K-00001','K-00002','K-00003','K-00004','K-00005','K-00006','K-00007',
  'K-00008','K-00009','K-00010','K-00011','K-00012','K-00013'
)
ORDER BY p.sku;
