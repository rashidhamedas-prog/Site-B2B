-- Append boutique FAQ/CTA to RETAIL home CMS without rewriting hero/banners.
-- Safe to re-run: skips when faq/cta already exist.
UPDATE site_contents
SET blocks = blocks || $json$[
  {
    "id": "b_retail_home_faq_boutique",
    "type": "faq",
    "props": {
      "headline": "سوالات پرتکرار",
      "body": "قبل از خرید، این چند مورد را یک‌بار بخوانید.",
      "items": [
        {
          "question": "سفارش تکی چقدر طول می‌کشد تا برسد؟",
          "answer": "معمولاً بعد از ثبت سفارش، بسته‌بندی از مشهد انجام می‌شود و بسته به شهر و روش ارسال چند روز کاری زمان می‌برد."
        },
        {
          "question": "اگر سایز مناسب نبود چه کار کنم؟",
          "answer": "از حساب کاربری درخواست تعویض سایز یا مرجوعی ثبت کنید."
        },
        {
          "question": "پرداخت چطور انجام می‌شود؟",
          "answer": "پرداخت آنلاین از طریق زرین‌پال در دسترس است."
        },
        {
          "question": "این همان تولیدی عمده است؟",
          "answer": "بله. همان کارگاه ترنم است؛ این سایت برای خرید تکی است و بوتیک‌داران از poshaktaranom.com سفارش می‌دهند."
        }
      ]
    }
  },
  {
    "id": "b_retail_home_cta_boutique",
    "type": "cta",
    "props": {
      "eyebrow": "",
      "headline": "بوتیک دارید؟",
      "body": "اگر برای فروشگاه سفارش می‌دهید، از سایت بوتیک‌داران ترنم قیمت و موجودی عمده را ببینید.",
      "ctaLabel": "ورود به سایت بوتیک‌داران",
      "ctaHref": "https://poshaktaranom.com",
      "ctaSecondaryLabel": "",
      "ctaSecondaryHref": "",
      "ctaTertiaryLabel": "",
      "ctaTertiaryHref": ""
    }
  }
]$json$::jsonb,
    "updatedAt" = NOW()
WHERE channel = 'RETAIL'
  AND "pageKey" = 'home'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(blocks) AS e
    WHERE e->>'type' IN ('faq', 'cta')
  );
