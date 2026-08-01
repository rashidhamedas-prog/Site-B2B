-- Retail home: category banners after hero + full product catalog
-- Plus attach luxury WebP banners to each category by skuPrefix

UPDATE categories SET "bannerUrl" = '/banners/category-luxury-2026/blouses.webp' WHERE "skuPrefix" = 'blouses';
UPDATE categories SET "bannerUrl" = '/banners/category-luxury-2026/coats.webp' WHERE "skuPrefix" = 'coats';
UPDATE categories SET "bannerUrl" = '/banners/category-luxury-2026/kaftans.webp' WHERE "skuPrefix" = 'kaftans';
UPDATE categories SET "bannerUrl" = '/banners/category-luxury-2026/pants.webp' WHERE "skuPrefix" = 'pants';
UPDATE categories SET "bannerUrl" = '/banners/category-luxury-2026/skirts.webp' WHERE "skuPrefix" = 'skirts';
UPDATE categories SET "bannerUrl" = '/banners/category-luxury-2026/pantsuits.webp' WHERE "skuPrefix" = 'pantsuits';
UPDATE categories SET "bannerUrl" = '/banners/category-luxury-2026/skirt-suits.webp' WHERE "skuPrefix" = 'skirt-suits';
UPDATE categories SET "bannerUrl" = '/banners/category-luxury-2026/vests-skirts.webp' WHERE "skuPrefix" = 'vests-skirts';
UPDATE categories SET "bannerUrl" = '/banners/category-luxury-2026/vests-pants.webp' WHERE "skuPrefix" = 'vests-pants';
UPDATE categories SET "bannerUrl" = '/banners/category-luxury-2026/winter-wear.webp' WHERE "skuPrefix" = 'winter-wear';

UPDATE site_contents
SET
  blocks = '[
    {"id":"b_1785339857033_r","type":"hero","props":{"slides":[{"body":"شومیز لینن گلرخ با فرم آزاد، آستین سه‌ربع و رنگی که به‌سادگی با استایل روزمره هماهنگ می‌شود.","ctaHref":"/products","ctaLabel":"مشاهده جدیدترین‌ها","headline":"آبیِ آرام برای هر روز شما","imageAlt":"","imageUrl":"/banners/hero-product-2026-v2/retail-01.webp","brandEyebrow":"شومیز لینن گلرخ","presentation":"overlay","headlineAccent":"هر روز شما","mobileImageUrl":"/banners/hero-product-2026-v2/retail-01-mobile.webp"},{"body":"رنگ تمشکی و نقش‌های ظریف قلب روی لینن؛ انتخابی متفاوت برای روزهایی که رنگ بیشتری می‌خواهید.","ctaHref":"/products","ctaLabel":"دیدن محصولات","headline":"بهگل، جزئیات کوچک و دوست‌داشتنی","imageAlt":"","imageUrl":"/banners/hero-product-2026-v2/retail-02-behgol.webp","brandEyebrow":"شومیز لینن بهگل — طرح قلب","presentation":"overlay","headlineAccent":"دوست‌داشتنی","mobileImageUrl":"/banners/hero-product-2026-v2/retail-02-behgol-mobile.webp"},{"body":"کت سبز آلیس با کتان کجراه، جیب‌های کاربردی و فرمی که برای استایل روزمره ساخته شده است.","ctaHref":"/products","ctaLabel":"مشاهده کالکشن","headline":"آلیس، استایل محکم و ماندگار","imageAlt":"","imageUrl":"/banners/hero-product-2026-v2/retail-03-alice.webp","brandEyebrow":"کت کتان کجراه مدل آلیس","presentation":"overlay","headlineAccent":"محکم و ماندگار","mobileImageUrl":"/banners/hero-product-2026-v2/retail-03-alice-mobile.webp"}],"autoplayMs":6500}},
    {"id":"b_cat_luxury_2026","type":"categoryBanners","props":{"headline":"دسته‌بندی‌ها","body":"هر دسته یک کالکشن کامل است — با یک لمس وارد شوید","columns":5,"maxItems":99,"categoryIds":""}},
    {"id":"b_products_all_2026","type":"products","props":{"body":"","limit":200,"sort":"newest","headline":"همه محصولات"}}
  ]'::jsonb,
  "isPublished" = true,
  "updatedAt" = NOW()
WHERE channel = 'RETAIL' AND "pageKey" = 'home';
