````md
# دستور کامل ساخت ماژول حرفه‌ای وبلاگ و سئو برای دو سایت ترنم

تو یک مهندس ارشد Full-Stack، معمار نرم‌افزار، متخصص Technical SEO، Google Search، Schema.org، Core Web Vitals و امنیت وب هستی.

دو وب‌سایت اختصاصی زیر از پایه کدنویسی شده‌اند:

1. سایت فروش تک:
https://poshaktaranom.ir

2. سایت فروش عمده:
https://poshaktaranom.com

هدف این تسک، ساخت کامل‌ترین ماژول مدیریت وبلاگ و محتوای سئو شده برای هر دو سایت است؛ به‌طوری‌که مدیر سایت بتواند مقاله‌هایی که دریافت می‌کند را همراه با تمام اطلاعات سئو، تصاویر، اسکیما، لینک‌های داخلی، پرسش‌های متداول و تنظیمات ایندکس داخل پنل ثبت و منتشر کند.

ماژول باید با معماری فعلی پروژه هماهنگ باشد و باعث خراب شدن هیچ‌کدام از امکانات موجود نشود.

---

# قوانین شروع کار

قبل از هر تغییری:

1. کل پروژه را بررسی کن.
2. تکنولوژی‌های Frontend، Backend، Database، ORM، Authentication، Storage، Router و Deployment را شناسایی کن.
3. ساختار فعلی پنل مدیریت، محصولات، کاربران و تنظیمات سایت را بررسی کن.
4. مشخص کن آیا ماژول وبلاگ یا سیستم SEO ناقصی از قبل وجود دارد یا خیر.
5. از ایجاد سیستم تکراری جلوگیری کن.
6. از وضعیت فعلی پروژه یک Git Commit بگیر.

دستور Commit اولیه:

```bash
git add .
git commit -m "chore: backup before advanced blog seo module"
````

اگر پروژه تغییرات Commit نشده دارد، ابتدا آن‌ها را گزارش کن و سپس با حفظ کامل تغییرات Commit بگیر.

هیچ فایل یا قابلیت فعلی را بدون بررسی حذف نکن.

---

# معماری چندسایتی

یک ماژول واحد ولی Multi-Site ایجاد کن که بتواند محتوای دو سایت را مدیریت کند.

مقادیر سایت:

```ts
type SiteKey = "retail" | "wholesale";
```

تعریف سایت‌ها:

```ts
const SITES = {
  retail: {
    name: "فروشگاه تک ترنم",
    domain: "https://poshaktaranom.ir",
    audience: "مصرف‌کننده نهایی",
    defaultLanguage: "fa-IR",
  },
  wholesale: {
    name: "عمده‌فروشی ترنم",
    domain: "https://poshaktaranom.com",
    audience: "فروشگاه‌داران و خریداران عمده",
    defaultLanguage: "fa-IR",
  },
} as const;
```

هر مقاله باید فقط برای یکی از سایت‌ها یا در صورت تأیید مدیر برای هر دو سایت تعریف شود.

محتوای یکسان نباید بدون Canonical یا بازنویسی مستقل روی هر دو دامنه منتشر شود.

---

# نقش‌ها و دسترسی‌ها

Role-Based Access Control ایجاد کن.

نقش‌ها:

```ts
type BlogRole =
  | "SUPER_ADMIN"
  | "SEO_MANAGER"
  | "CONTENT_MANAGER"
  | "EDITOR"
  | "AUTHOR"
  | "REVIEWER"
  | "VIEWER";
```

سطوح دسترسی:

## SUPER_ADMIN

* دسترسی کامل
* حذف دائمی
* مدیریت تنظیمات سئو
* مدیریت Redirect
* مدیریت Sitemap
* مدیریت کاربران و نقش‌ها
* اتصال Search Console و GA4

## SEO_MANAGER

* ویرایش تمام تنظیمات SEO
* مدیریت Canonical
* مدیریت Schema
* مدیریت Redirect
* بررسی لینک داخلی
* مشاهده گزارش‌های سئو
* تأیید انتشار

## CONTENT_MANAGER

* ساخت و ویرایش مقاله
* مدیریت دسته‌بندی
* مدیریت تگ
* مدیریت رسانه
* انتشار و زمان‌بندی

## EDITOR

* ویرایش محتوا
* اصلاح نگارشی
* ثبت پیشنهاد
* عدم امکان حذف دائمی

## AUTHOR

* ساخت Draft
* ویرایش نوشته‌های خودش
* ارسال برای بازبینی
* عدم امکان انتشار مستقیم

## REVIEWER

* مشاهده و بازبینی
* تأیید یا رد محتوا
* ثبت کامنت داخلی

## VIEWER

* فقط مشاهده

تمام عملیات حساس باید در Audit Log ثبت شوند.

---

# وضعیت‌های مقاله

```ts
type ArticleStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "NEEDS_REVISION"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "UNPUBLISHED"
  | "ARCHIVED";
```

چرخه انتشار:

```text
DRAFT
→ IN_REVIEW
→ NEEDS_REVISION یا APPROVED
→ SCHEDULED یا PUBLISHED
→ UNPUBLISHED یا ARCHIVED
```

---

# مدل کامل مقاله

مدل مقاله باید تمام فیلدهای زیر را پشتیبانی کند.

```ts
interface BlogArticle {
  id: string;

  siteKey: "retail" | "wholesale";

  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentFormat: "HTML" | "MARKDOWN" | "EDITOR_JSON";

  status:
    | "DRAFT"
    | "IN_REVIEW"
    | "NEEDS_REVISION"
    | "APPROVED"
    | "SCHEDULED"
    | "PUBLISHED"
    | "UNPUBLISHED"
    | "ARCHIVED";

  language: "fa-IR";
  direction: "rtl";

  authorId: string;
  reviewerId?: string;
  categoryId: string;
  tagIds: string[];

  featuredImageId?: string;
  galleryImageIds: string[];

  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  searchIntent:
    | "INFORMATIONAL"
    | "COMMERCIAL"
    | "TRANSACTIONAL"
    | "NAVIGATIONAL";

  canonicalType: "SELF" | "CUSTOM" | "NONE";
  canonicalUrl?: string;

  robotsIndex: boolean;
  robotsFollow: boolean;
  robotsNoArchive: boolean;
  robotsNoSnippet: boolean;
  maxSnippet?: number;
  maxImagePreview: "none" | "standard" | "large";
  maxVideoPreview?: number;

  ogTitle?: string;
  ogDescription?: string;
  ogImageId?: string;
  ogType: "article";
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImageId?: string;
  twitterCard: "summary" | "summary_large_image";

  schemaType:
    | "Article"
    | "BlogPosting"
    | "NewsArticle"
    | "HowTo"
    | "FAQPage";

  breadcrumbEnabled: boolean;
  articleSchemaEnabled: boolean;
  faqSchemaEnabled: boolean;
  howToSchemaEnabled: boolean;
  organizationSchemaEnabled: boolean;
  personSchemaEnabled: boolean;

  faqItems: FAQItem[];
  howToData?: HowToData;

  readingTimeMinutes: number;
  wordCount: number;

  tableOfContentsEnabled: boolean;
  tableOfContentsDepth: 2 | 3 | 4;
  autoGenerateHeadingIds: boolean;

  internalLinkIds: string[];
  relatedArticleIds: string[];
  relatedProductIds: string[];
  relatedCategoryIds: string[];

  primaryCta?: CTAData;
  secondaryCta?: CTAData;

  publishAt?: string;
  publishedAt?: string;
  modifiedAt?: string;

  sitemapEnabled: boolean;
  sitemapPriority: number;
  sitemapChangeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";

  rssEnabled: boolean;

  isCornerstone: boolean;
  isEvergreen: boolean;
  requiresContentReview: boolean;
  nextReviewAt?: string;

  redirectOnSlugChange: boolean;

  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
```

---

# مدل پرسش‌های متداول

```ts
interface FAQItem {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isVisible: boolean;
  includeInSchema: boolean;
}
```

پرسش و پاسخ‌های Schema باید در خود صفحه برای کاربر قابل مشاهده باشند.

Schema مخفی ایجاد نکن.

---

# مدل HowTo

```ts
interface HowToData {
  name: string;
  description?: string;
  totalTime?: string;
  estimatedCost?: {
    currency: "IRR";
    value: number;
  };
  supplies: string[];
  tools: string[];
  steps: Array<{
    id: string;
    title: string;
    description: string;
    imageId?: string;
    urlAnchor?: string;
    sortOrder: number;
  }>;
}
```

---

# مدل CTA

```ts
interface CTAData {
  title: string;
  description?: string;
  buttonText: string;
  buttonUrl: string;
  openInNewTab: boolean;
  rel: Array<"nofollow" | "sponsored" | "ugc" | "noopener">;
  style: "PRIMARY" | "SECONDARY" | "INLINE" | "BOX";
}
```

---

# دسته‌بندی مقالات

جدول دسته‌بندی ایجاد کن:

```ts
interface BlogCategory {
  id: string;
  siteKey: "retail" | "wholesale";
  name: string;
  slug: string;
  description?: string;

  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;

  canonicalUrl?: string;
  robotsIndex: boolean;
  robotsFollow: boolean;

  featuredImageId?: string;

  parentId?: string;
  sortOrder: number;
  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}
```

دسته‌بندی‌های پیشنهادی سایت تک:

```text
راهنمای خرید مانتو
استایل زنانه
راهنمای سایزبندی
شناخت پارچه
نگهداری لباس
مد و ترند
مانتو لینن
مانتو کتان
استایل پاییزی
استایل تابستانی
```

دسته‌بندی‌های پیشنهادی سایت عمده:

```text
راهنمای خرید عمده
مدیریت بوتیک
انتخاب مدل پرفروش
راهنمای پارچه
فروش پوشاک
چیدمان ویترین
بازاریابی پوشاک
مدیریت موجودی
خرید از تولیدی
ترندهای بازار مانتو
```

---

# سیستم تگ

```ts
interface BlogTag {
  id: string;
  siteKey: "retail" | "wholesale";
  name: string;
  slug: string;
  description?: string;

  seoTitle?: string;
  metaDescription?: string;

  robotsIndex: boolean;
  robotsFollow: boolean;

  createdAt: string;
  updatedAt: string;
}
```

به‌صورت پیش‌فرض صفحات تگ کم‌محتوا Noindex باشند.

امکان Index کردن دستی تگ‌های ارزشمند فراهم شود.

---

# مدیریت نویسنده

```ts
interface BlogAuthorProfile {
  id: string;
  userId: string;

  displayName: string;
  slug: string;
  bio: string;
  avatarId?: string;

  jobTitle?: string;
  expertise: string[];
  experienceYears?: number;

  instagramUrl?: string;
  linkedinUrl?: string;
  websiteUrl?: string;

  authorPageEnabled: boolean;
  robotsIndex: boolean;

  createdAt: string;
  updatedAt: string;
}
```

صفحه نویسنده باید قابلیت نمایش:

* تصویر نویسنده
* نام
* سمت
* تخصص
* بیوگرافی
* مقالات
* پروفایل‌های اجتماعی
* Person Schema

را داشته باشد.

---

# مدیریت تصاویر و رسانه

یک Media Library حرفه‌ای ایجاد کن.

مدل رسانه:

```ts
interface MediaAsset {
  id: string;
  siteKey?: "retail" | "wholesale";

  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  extension: string;

  width: number;
  height: number;
  fileSize: number;

  storageProvider: "LOCAL" | "S3" | "CLOUDINARY" | "OTHER";
  storageKey: string;
  publicUrl: string;

  title?: string;
  altText: string;
  caption?: string;
  description?: string;

  creditName?: string;
  creditUrl?: string;
  license?: string;

  focalPointX?: number;
  focalPointY?: number;

  isDecorative: boolean;
  isAiGenerated?: boolean;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

امکانات رسانه:

* Drag & Drop
* آپلود گروهی
* انتخاب تصویر شاخص
* انتخاب تصویر Open Graph
* انتخاب تصویر Twitter
* Crop
* Resize
* تعیین Focal Point
* تولید WebP
* تولید AVIF
* نگهداری نسخه اصلی
* تولید Thumbnail
* نمایش حجم فایل
* هشدار تصویر سنگین
* پیشنهاد Alt Text
* ویرایش دستی Alt
* ثبت Caption
* ثبت Credit
* جلوگیری از نام فایل فارسی نامناسب
* تبدیل نام فایل به Slug انگلیسی
* تشخیص فایل تکراری با Hash
* جلوگیری از آپلود فایل اجرایی
* محدودیت حجم قابل تنظیم
* پاک‌سازی Metadata حساس در صورت نیاز
* ثبت Width و Height برای جلوگیری از CLS

ابعاد پیشنهادی:

```ts
const BLOG_IMAGE_SIZES = {
  thumbnail: { width: 320, height: 240 },
  card: { width: 640, height: 480 },
  content: { width: 960, height: null },
  featured: { width: 1200, height: 800 },
  openGraph: { width: 1200, height: 630 },
};
```

برای تصویر شاخص:

* Lazy Load غیرفعال باشد.
* `fetchpriority="high"` فقط در صورت LCP بودن فعال شود.
* `loading="eager"` فقط برای تصویر شاخص بالای صفحه.
* سایر تصاویر `loading="lazy"` باشند.
* از `srcset` و `sizes` استفاده شود.
* Width و Height واقعی درج شوند.

نمونه خروجی:

```html
<img
  src="/media/article-image-960.webp"
  srcset="
    /media/article-image-320.webp 320w,
    /media/article-image-640.webp 640w,
    /media/article-image-960.webp 960w,
    /media/article-image-1200.webp 1200w
  "
  sizes="(max-width: 768px) 100vw, 960px"
  width="1200"
  height="800"
  alt="راهنمای انتخاب مانتو پاییزه زنانه"
  loading="lazy"
  decoding="async"
/>
```

---

# ویرایشگر پیشرفته محتوا

یک Rich Text Editor حرفه‌ای با پشتیبانی RTL ایجاد کن.

ترجیحاً از Editor.js، TipTap یا ویرایشگر سازگار با معماری پروژه استفاده کن.

قابلیت‌ها:

* عنوان H2 تا H6
* Paragraph
* Bold
* Italic
* Underline
* Strike
* Highlight
* Text Color محدود
* Blockquote
* Ordered List
* Unordered List
* Checklist
* جدول
* تصویر
* گالری
* ویدئو
* فایل
* کد
* Separator
* Callout
* CTA
* FAQ Block
* Product Block
* Related Article Block
* Internal Link
* External Link
* Anchor ID
* HTML امن
* Undo/Redo
* Fullscreen
* Preview
* Word Count
* Character Count
* Reading Time
* Auto Save
* Version History
* Restore Version
* Copy/Paste از Markdown
* Import Markdown
* Export Markdown
* Import HTML پاک‌سازی‌شده

از درج مستقیم JavaScript، iframe ناشناس و HTML خطرناک جلوگیری شود.

تمام HTMLها Sanitize شوند.

---

# ورود مقاله از فایل یا متن

امکان Import مقاله با فرمت‌های زیر ایجاد کن:

* Markdown
* HTML
* JSON
* Text
* فایل `.md`
* فایل `.txt`
* فایل `.html`
* فایل `.json`

نمونه قالب استاندارد JSON برای ورود مقاله:

```json
{
  "siteKey": "retail",
  "title": "برای پاییز چه مانتویی بخریم؟",
  "slug": "how-to-choose-autumn-manto",
  "excerpt": "راهنمای کامل انتخاب مانتو مناسب فصل پاییز",
  "contentFormat": "MARKDOWN",
  "content": "# برای پاییز چه مانتویی بخریم؟\n\nمتن مقاله...",
  "categorySlug": "autumn-style",
  "tags": [
    "مانتو پاییزه",
    "مانتو کتان",
    "استایل پاییزی"
  ],
  "seo": {
    "seoTitle": "برای پاییز چه مانتویی بخریم؟ راهنمای کامل انتخاب مانتو",
    "metaDescription": "برای خرید مانتو پاییزه، جنس پارچه، اندازه، رنگ و مدل مناسب را بشناسید.",
    "focusKeyword": "خرید مانتو پاییزه",
    "secondaryKeywords": [
      "مانتو پاییزه زنانه",
      "مانتو کتان",
      "مانتو شومیزی"
    ],
    "searchIntent": "COMMERCIAL",
    "canonicalType": "SELF",
    "robotsIndex": true,
    "robotsFollow": true,
    "maxImagePreview": "large"
  },
  "featuredImage": {
    "mediaId": "MEDIA_ID",
    "altText": "استایل زنانه پاییزی با مانتو شومیزی",
    "caption": "نمونه استایل راحت و کاربردی برای فصل پاییز"
  },
  "openGraph": {
    "title": "راهنمای خرید مانتو پاییزه",
    "description": "نکات انتخاب مانتو مناسب فصل پاییز",
    "imageId": "MEDIA_ID"
  },
  "schema": {
    "type": "BlogPosting",
    "articleSchemaEnabled": true,
    "breadcrumbEnabled": true,
    "faqSchemaEnabled": true
  },
  "faqItems": [
    {
      "question": "برای شروع پاییز مانتوی ضخیم بخریم؟",
      "answer": "در شروع پاییز معمولاً مانتوی بین‌فصلی کاربردی‌تر است.",
      "sortOrder": 1,
      "isVisible": true,
      "includeInSchema": true
    }
  ],
  "internalLinks": [
    {
      "anchorText": "مشاهده مانتوهای پاییزه",
      "targetUrl": "/category/autumn-manto"
    }
  ],
  "relatedProductIds": [],
  "relatedArticleIds": [],
  "tableOfContentsEnabled": true,
  "sitemapEnabled": true,
  "sitemapPriority": 0.8,
  "sitemapChangeFrequency": "monthly",
  "rssEnabled": true
}
```

Import باید قبل از ذخیره اعتبارسنجی شود و خطاهای هر فیلد را دقیق نمایش دهد.

---

# پنل تنظیمات سئو مقاله

در صفحه ساخت و ویرایش مقاله، Tabهای زیر ایجاد کن:

```text
1. محتوای مقاله
2. اطلاعات پایه
3. سئو
4. شبکه‌های اجتماعی
5. اسکیما
6. تصاویر
7. لینک‌های داخلی
8. محصولات مرتبط
9. مقالات مرتبط
10. انتشار
11. تاریخچه تغییرات
12. پیش‌نمایش
```

---

# Tab اطلاعات پایه

فیلدها:

* انتخاب سایت
* عنوان مقاله
* Slug
* خلاصه
* نویسنده
* بازبین
* دسته‌بندی
* تگ‌ها
* زبان
* وضعیت
* تصویر شاخص
* زمان مطالعه
* تعداد کلمات
* مقاله ستونی
* مقاله همیشه‌سبز

Slug باید:

* یکتا باشد.
* Lowercase باشد.
* فاصله نداشته باشد.
* از خط تیره استفاده کند.
* از نویسه‌های ناامن پاک شود.
* امکان فارسی یا انگلیسی داشته باشد.
* هنگام تغییر بعد از انتشار، Redirect ایجاد کند.

---

# Tab سئو

فیلدها:

* Focus Keyword
* Secondary Keywords
* Search Intent
* SEO Title
* Meta Description
* Canonical Type
* Custom Canonical URL
* Index
* Follow
* Noarchive
* Nosnippet
* Max Snippet
* Max Image Preview
* Max Video Preview
* Sitemap Enabled
* Sitemap Priority
* Change Frequency
* Cornerstone Content
* Content Review Date

محدودیت نمایشی:

```ts
const SEO_LIMITS = {
  titleRecommendedMin: 45,
  titleRecommendedMax: 60,
  metaDescriptionRecommendedMin: 120,
  metaDescriptionRecommendedMax: 160,
};
```

محدودیت‌ها نباید مانع ذخیره شوند؛ فقط هشدار دهند.

پیش‌نمایش Snippet گوگل در دسکتاپ و موبایل ایجاد کن.

---

# سیستم امتیازدهی سئو

یک SEO Analysis Engine داخلی ایجاد کن.

این سیستم فقط پیشنهاد بدهد و جلوی انتشار را نگیرد، مگر در خطاهای بحرانی.

امتیاز از صفر تا صد:

```ts
interface SEOAnalysisResult {
  score: number;
  status: "POOR" | "NEEDS_IMPROVEMENT" | "GOOD" | "EXCELLENT";
  errors: SEOCheck[];
  warnings: SEOCheck[];
  passed: SEOCheck[];
}
```

موارد بررسی:

* وجود عنوان مقاله
* وجود SEO Title
* طول SEO Title
* وجود Meta Description
* طول Meta Description
* Focus Keyword
* وجود کلمه کلیدی در عنوان
* وجود کلمه کلیدی در H1
* وجود طبیعی کلمه کلیدی در مقدمه
* وجود کلمه کلیدی در حداقل یک H2
* وجود کلمه کلیدی در Slug
* استفاده بیش از حد از کلمه کلیدی
* تعداد کلمات
* وجود تصویر شاخص
* Alt تصویر شاخص
* وجود لینک داخلی
* وجود لینک خارجی معتبر
* وجود H2
* ترتیب صحیح Headingها
* پاراگراف‌های بیش از حد طولانی
* جملات بسیار طولانی
* وجود FAQ
* وجود CTA
* Canonical
* Robots
* Open Graph
* Article Schema
* Breadcrumb Schema
* وجود نویسنده
* تاریخ انتشار
* تاریخ ویرایش
* مقالات مرتبط
* محصولات مرتبط
* تصاویر بزرگ
* تصاویر بدون Alt
* لینک شکسته
* تکراری بودن عنوان
* تکراری بودن Meta Description
* تکراری بودن Slug
* مشابهت زیاد محتوا با مقالات دیگر

از Keyword Stuffing جلوگیری شود.

هیچ درصد ثابت و غیرعلمی برای چگالی کلمات کلیدی به مدیر تحمیل نکن.

---

# Tab شبکه‌های اجتماعی

فیلدها:

* Open Graph Title
* Open Graph Description
* Open Graph Image
* Twitter Title
* Twitter Description
* Twitter Image
* Twitter Card Type

پیش‌نمایش:

* Telegram
* WhatsApp
* Facebook
* X/Twitter
* LinkedIn

اگر فیلدهای OG خالی بودند، از SEO Title و Meta Description و Featured Image استفاده شود.

---

# Structured Data و Schema

JSON-LD استاندارد تولید کن.

Schemaهای مورد نیاز:

* Organization
* WebSite
* WebPage
* Article یا BlogPosting
* BreadcrumbList
* Person
* FAQPage
* HowTo در صورت وجود
* ImageObject
* SearchAction فقط در صورت وجود جست‌وجوی واقعی سایت

اطلاعات Schema باید از اطلاعات واقعی دیتابیس ساخته شود.

از ثبت Rating، Review، Price یا Availability جعلی جلوگیری کن.

نمونه Article Schema:

```ts
function buildArticleSchema(article: BlogArticle, site: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@type": article.schemaType || "BlogPosting",
    headline: article.title,
    description: article.metaDescription || article.excerpt,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${site.domain}/blog/${article.slug}`,
    },
    image: article.featuredImage
      ? [
          {
            "@type": "ImageObject",
            url: article.featuredImage.publicUrl,
            width: article.featuredImage.width,
            height: article.featuredImage.height,
          },
        ]
      : undefined,
    author: {
      "@type": "Person",
      name: article.author.displayName,
      url: `${site.domain}/authors/${article.author.slug}`,
    },
    publisher: {
      "@type": "Organization",
      name: "تولیدی ترنم",
      url: site.domain,
      logo: {
        "@type": "ImageObject",
        url: `${site.domain}/logo.png`,
      },
    },
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt || article.publishedAt,
    inLanguage: "fa-IR",
  };
}
```

Schemaها را در Server-Side Render یا HTML اولیه صفحه قرار بده.

Schema فقط با JavaScript سمت کلاینت بعد از Load اضافه نشود.

---

# Breadcrumb

نمونه:

```text
خانه
← وبلاگ
← دسته‌بندی
← عنوان مقاله
```

Breadcrumb باید:

* قابل مشاهده باشد.
* لینک داشته باشد.
* BreadcrumbList Schema داشته باشد.
* RTL باشد.

---

# Table of Contents

فهرست مطالب به‌صورت خودکار از H2 و H3 ساخته شود.

قابلیت‌ها:

* فعال و غیرفعال کردن
* انتخاب عمق H2 تا H4
* Sticky در دسکتاپ
* جمع‌شونده در موبایل
* Anchor Link
* اسکرول نرم
* Highlight بخش فعال
* تولید ID یکتا برای Heading
* جلوگیری از ID تکراری

---

# لینک‌سازی داخلی

یک Internal Link Manager ایجاد کن.

قابلیت‌ها:

* جست‌وجوی مقاله
* جست‌وجوی محصول
* جست‌وجوی دسته‌بندی
* درج لینک در متن
* پیشنهاد انکرتکست
* نمایش عنوان و URL مقصد
* تشخیص لینک شکسته
* تشخیص لینک Redirect شده
* تشخیص لینک به صفحه Noindex
* تشخیص لینک به صفحه حذف‌شده
* تشخیص Orphan Article
* شمارش لینک داخلی ورودی
* شمارش لینک داخلی خروجی
* جلوگیری از لینک‌های بیش از حد
* پیشنهاد مقالات مرتبط
* پیشنهاد محصولات مرتبط

هر پیشنهاد قبل از اعمال نیازمند تأیید مدیر باشد.

---

# لینک‌های خارجی

برای هر لینک خارجی امکان تعیین موارد زیر وجود داشته باشد:

```ts
interface ExternalLinkOptions {
  targetBlank: boolean;
  relNofollow: boolean;
  relSponsored: boolean;
  relUgc: boolean;
  relNoopener: boolean;
}
```

برای لینک تبلیغاتی یا پولی، `rel="sponsored"` قابل انتخاب و هشداردهی باشد.

برای لینک بازشونده در تب جدید، `noopener` اعمال شود.

---

# محصولات مرتبط

در هر مقاله امکان اتصال محصولات وجود داشته باشد.

قابلیت‌ها:

* انتخاب محصول از سایت مربوطه
* جست‌وجو بر اساس نام
* جست‌وجو بر اساس SKU
* انتخاب چند محصول
* ترتیب نمایش
* عنوان اختصاصی بخش
* نوع نمایش Grid یا Slider
* نمایش تصویر
* قیمت
* وضعیت موجودی
* لینک محصول
* دکمه مشاهده محصول

اطلاعات محصول به‌صورت Real-Time از دیتابیس خوانده شود.

قیمت یا موجودی داخل محتوای مقاله Hardcode نشود.

اگر محصول حذف یا ناموجود شد، بخش مربوطه نباید صفحه را خراب کند.

---

# مقالات مرتبط

روش انتخاب:

```ts
type RelatedArticleMode = "MANUAL" | "AUTOMATIC" | "HYBRID";
```

در حالت Automatic بر اساس:

* دسته‌بندی مشترک
* تگ مشترک
* کلمات کلیدی مشترک
* هدف جست‌وجو
* سایت یکسان
* تاریخ انتشار
* عدم نمایش مقاله فعلی

مقالات مرتبط انتخاب شوند.

---

# زمان‌بندی انتشار

قابلیت‌ها:

* انتشار فوری
* زمان‌بندی انتشار
* لغو انتشار
* انتشار مجدد
* تعیین منطقه زمانی
* پشتیبانی تاریخ شمسی
* ذخیره زمان اصلی به UTC
* نمایش زمان در منطقه زمانی مدیر

Timezone پیش‌فرض:

```text
Asia/Tehran
```

Job زمان‌بندی باید قابل اطمینان باشد و پس از Restart سرور از بین نرود.

از Queue یا Cron پایدار متناسب با معماری پروژه استفاده کن.

---

# Preview

سه نوع Preview ایجاد کن:

* Desktop
* Tablet
* Mobile

Preview باید شامل موارد زیر باشد:

* Header واقعی سایت
* Breadcrumb
* عنوان
* نویسنده
* تاریخ
* تصویر شاخص
* فهرست مطالب
* محتوا
* FAQ
* CTA
* محصولات مرتبط
* مقالات مرتبط

Preview مقاله Draft فقط برای کاربران مجاز با Token امن قابل مشاهده باشد.

Preview URL نباید Index شود.

---

# Version History

برای هر مقاله تاریخچه نسخه ایجاد کن.

```ts
interface ArticleRevision {
  id: string;
  articleId: string;
  versionNumber: number;
  snapshot: object;
  changeSummary?: string;
  createdBy: string;
  createdAt: string;
}
```

قابلیت‌ها:

* مشاهده نسخه‌های قبلی
* مقایسه دو نسخه
* Restore
* ثبت نام کاربر
* ثبت زمان
* ثبت خلاصه تغییر

تعداد نسخه‌ها از تنظیمات قابل محدود کردن باشد.

---

# Auto Save

* ذخیره خودکار هر 30 ثانیه
* ذخیره هنگام تغییر Tab
* ذخیره قبل از ترک صفحه
* نمایش آخرین زمان ذخیره
* جلوگیری از از بین رفتن محتوا
* تشخیص Conflict بین دو ویرایشگر
* استفاده از Optimistic Locking

فیلد Version یا UpdatedAt برای کنترل همزمانی استفاده شود.

---

# مدیریت Redirect

جدول Redirect ایجاد کن:

```ts
interface SeoRedirect {
  id: string;
  siteKey: "retail" | "wholesale";

  sourcePath: string;
  destinationUrl: string;

  statusCode: 301 | 302 | 307 | 308;

  reason:
    | "SLUG_CHANGED"
    | "ARTICLE_DELETED"
    | "CONTENT_MERGED"
    | "MANUAL";

  isActive: boolean;
  hitCount: number;
  lastHitAt?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

در صورت تغییر Slug مقاله منتشرشده:

1. URL قبلی ثبت شود.
2. Redirect 301 ساخته شود.
3. از ایجاد Redirect Loop جلوگیری شود.
4. از Redirect Chain جلوگیری شود.
5. Sitemap فقط URL جدید را نمایش دهد.
6. Canonical به URL جدید اشاره کند.

---

# حذف مقاله

Soft Delete پیش‌فرض باشد.

هنگام حذف مقاله منتشرشده، مدیر باید یکی از گزینه‌ها را انتخاب کند:

```text
1. انتقال 301 به مقاله دیگر
2. انتقال 301 به دسته‌بندی
3. نمایش 410 Gone
4. نگهداری صفحه بدون انتشار
```

حذف دائمی فقط توسط SUPER_ADMIN ممکن باشد.

---

# Sitemap

برای هر سایت Sitemap جداگانه ایجاد کن.

نمونه‌ها:

```text
https://poshaktaranom.ir/sitemap.xml
https://poshaktaranom.ir/sitemap-blog.xml
https://poshaktaranom.ir/sitemap-products.xml
https://poshaktaranom.ir/sitemap-categories.xml

https://poshaktaranom.com/sitemap.xml
https://poshaktaranom.com/sitemap-blog.xml
https://poshaktaranom.com/sitemap-products.xml
https://poshaktaranom.com/sitemap-categories.xml
```

قوانین:

* فقط صفحات Published
* فقط صفحات Index
* فقط Canonical URL
* عدم درج Redirect
* عدم درج 404
* درج Last Modified واقعی
* پشتیبانی Sitemap Index
* Cache مناسب
* Revalidation بعد از انتشار یا تغییر مقاله

---

# RSS Feed

برای هر سایت RSS جدا ایجاد کن:

```text
/feed.xml
/blog/feed.xml
/category/{slug}/feed.xml
```

RSS شامل:

* عنوان
* خلاصه
* لینک
* نویسنده
* تاریخ انتشار
* تصویر شاخص
* دسته‌بندی

باشد.

---

# Canonical

Canonical برای هر صفحه به‌صورت Server-Side تولید شود.

نمونه:

```html
<link
  rel="canonical"
  href="https://poshaktaranom.ir/blog/how-to-choose-autumn-manto"
/>
```

قوانین:

* URL مطلق باشد.
* HTTPS باشد.
* Query String غیرضروری نداشته باشد.
* Self Canonical پیش‌فرض باشد.
* Canonical سایت عمده و تک جدا باشد.
* Canonical به Redirect یا 404 اشاره نکند.
* Custom Canonical فقط با هشدار قابل ثبت باشد.

---

# Meta Tags

برای هر مقاله این Metaها تولید شوند:

```html
<title>SEO TITLE</title>
<meta name="description" content="META DESCRIPTION" />
<meta name="robots" content="index,follow,max-image-preview:large" />

<link rel="canonical" href="CANONICAL_URL" />

<meta property="og:type" content="article" />
<meta property="og:title" content="OG TITLE" />
<meta property="og:description" content="OG DESCRIPTION" />
<meta property="og:url" content="ARTICLE_URL" />
<meta property="og:image" content="OG_IMAGE_URL" />
<meta property="og:site_name" content="تولیدی ترنم" />
<meta property="og:locale" content="fa_IR" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="TWITTER TITLE" />
<meta name="twitter:description" content="TWITTER DESCRIPTION" />
<meta name="twitter:image" content="TWITTER_IMAGE_URL" />
```

---

# صفحات آرشیو وبلاگ

صفحات زیر ساخته شوند:

```text
/blog
/blog/page/{page}
/blog/{slug}
/blog/category/{slug}
/blog/tag/{slug}
/blog/author/{slug}
/blog/search
```

قابلیت‌های صفحه وبلاگ:

* جست‌وجو
* فیلتر دسته‌بندی
* فیلتر تگ
* مرتب‌سازی
* صفحه‌بندی
* مقاله ویژه
* جدیدترین مقالات
* محبوب‌ترین مقالات
* مقالات پیشنهادی
* Skeleton Loading
* Empty State
* Responsive
* RTL

از Infinite Scroll به‌عنوان تنها روش دسترسی استفاده نکن.

Pagination قابل Crawl ایجاد کن.

---

# صفحه جست‌وجوی وبلاگ

* جست‌وجوی عنوان
* جست‌وجوی خلاصه
* جست‌وجوی محتوا
* جست‌وجوی دسته‌بندی
* جست‌وجوی تگ
* Highlight نتیجه
* Pagination
* ثبت Search Analytics

صفحات نتایج جست‌وجوی داخلی به‌صورت پیش‌فرض:

```html
<meta name="robots" content="noindex,follow" />
```

---

# کامنت مقاله

سیستم کامنت اختیاری و قابل غیرفعال‌سازی باشد.

مدل:

```ts
interface BlogComment {
  id: string;
  articleId: string;

  name: string;
  email: string;
  content: string;

  status:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "SPAM";

  parentId?: string;

  ipHash?: string;
  userAgent?: string;

  createdAt: string;
  updatedAt: string;
}
```

امنیت:

* Rate Limit
* CAPTCHA در صورت نیاز
* Honeypot
* Anti-Spam
* HTML Sanitization
* عدم نمایش ایمیل
* تأیید مدیر قبل از انتشار
* امکان غیرفعال کردن کامنت هر مقاله

UGC Linkها با `rel="ugc nofollow"` باشند.

---

# آمار مقاله

مدل آمار:

```ts
interface ArticleAnalytics {
  articleId: string;

  pageViews: number;
  uniqueViews: number;

  avgEngagementTime?: number;
  scroll25?: number;
  scroll50?: number;
  scroll75?: number;
  scroll90?: number;

  ctaClicks?: number;
  productClicks?: number;
  internalLinkClicks?: number;

  updatedAt: string;
}
```

در صورت اتصال GA4 و Search Console، اطلاعات زیر نمایش داده شود:

* Click
* Impression
* CTR
* Average Position
* Page Views
* Engagement
* Conversion
* بازه زمانی
* مقایسه با دوره قبل

اطلاعات سایت تک و عمده جدا باشند.

---

# تنظیمات عمومی وبلاگ

جدول تنظیمات:

```ts
interface BlogSettings {
  siteKey: "retail" | "wholesale";

  blogTitle: string;
  blogDescription: string;

  articlesPerPage: number;

  commentsEnabled: boolean;
  rssEnabled: boolean;

  defaultAuthorId?: string;
  defaultCategoryId?: string;

  defaultOgImageId?: string;
  defaultTwitterImageId?: string;

  defaultSchemaType: "Article" | "BlogPosting";

  defaultRobotsIndex: boolean;
  defaultRobotsFollow: boolean;

  autoGenerateSlug: boolean;
  autoCreateRedirect: boolean;
  autoGenerateToc: boolean;
  autoGenerateReadingTime: boolean;

  showAuthor: boolean;
  showPublishDate: boolean;
  showModifiedDate: boolean;
  showReadingTime: boolean;
  showCategory: boolean;
  showTags: boolean;

  relatedArticlesEnabled: boolean;
  relatedProductsEnabled: boolean;

  articleReviewReminderDays?: number;

  createdAt: string;
  updatedAt: string;
}
```

---

# ساختار دیتابیس

بر اساس ORM و دیتابیس فعلی پروژه، Migration استاندارد ایجاد کن.

جداول مورد نیاز:

```text
blog_articles
blog_article_sites
blog_categories
blog_tags
blog_article_tags
blog_authors
blog_article_revisions
blog_faq_items
blog_howto_data
blog_howto_steps
blog_media_assets
blog_article_media
blog_related_articles
blog_related_products
blog_internal_links
blog_external_links
blog_comments
blog_settings
blog_seo_analysis
blog_analytics
seo_redirects
seo_audit_logs
blog_editor_comments
blog_scheduled_jobs
```

تمام جداول مناسب باید دارای موارد زیر باشند:

* Primary Key
* Foreign Key
* Unique Constraint
* Index
* CreatedAt
* UpdatedAt
* CreatedBy
* UpdatedBy
* DeletedAt
* Soft Delete
* Audit Log

Indexهای ضروری:

```text
siteKey
slug
status
publishedAt
categoryId
authorId
focusKeyword
createdAt
updatedAt
```

Unique Constraint:

```text
(siteKey, slug)
```

---

# APIهای لازم

REST یا GraphQL را مطابق معماری پروژه انتخاب کن.

APIها:

```text
GET    /api/admin/blog/articles
POST   /api/admin/blog/articles
GET    /api/admin/blog/articles/:id
PATCH  /api/admin/blog/articles/:id
DELETE /api/admin/blog/articles/:id

POST   /api/admin/blog/articles/:id/publish
POST   /api/admin/blog/articles/:id/unpublish
POST   /api/admin/blog/articles/:id/schedule
POST   /api/admin/blog/articles/:id/submit-review
POST   /api/admin/blog/articles/:id/approve
POST   /api/admin/blog/articles/:id/reject
POST   /api/admin/blog/articles/:id/duplicate
POST   /api/admin/blog/articles/:id/restore

GET    /api/admin/blog/articles/:id/revisions
POST   /api/admin/blog/articles/:id/revisions/:revisionId/restore

POST   /api/admin/blog/import
POST   /api/admin/blog/export

GET    /api/admin/blog/categories
POST   /api/admin/blog/categories
PATCH  /api/admin/blog/categories/:id
DELETE /api/admin/blog/categories/:id

GET    /api/admin/blog/tags
POST   /api/admin/blog/tags
PATCH  /api/admin/blog/tags/:id
DELETE /api/admin/blog/tags/:id

GET    /api/admin/blog/media
POST   /api/admin/blog/media
PATCH  /api/admin/blog/media/:id
DELETE /api/admin/blog/media/:id

POST   /api/admin/blog/seo/analyze
POST   /api/admin/blog/internal-links/suggest
POST   /api/admin/blog/check-links

GET    /api/admin/seo/redirects
POST   /api/admin/seo/redirects
PATCH  /api/admin/seo/redirects/:id
DELETE /api/admin/seo/redirects/:id

GET    /api/public/blog
GET    /api/public/blog/:slug
GET    /api/public/blog/categories/:slug
GET    /api/public/blog/tags/:slug
GET    /api/public/blog/authors/:slug
GET    /api/public/blog/search
```

تمام APIها باید دارای:

* Authentication
* Authorization
* Validation
* Sanitization
* Pagination
* Filtering
* Sorting
* Error Handling
* Rate Limit
* Audit Log
* Unit Test
* Integration Test

باشند.

---

# Validation

از Validation Library موجود پروژه استفاده کن.

نمونه Validation:

```ts
const articleSchema = z.object({
  siteKey: z.enum(["retail", "wholesale"]),

  title: z.string().trim().min(5).max(250),

  slug: z
    .string()
    .trim()
    .min(3)
    .max(250)
    .regex(/^[a-z0-9\u0600-\u06FF]+(?:-[a-z0-9\u0600-\u06FF]+)*$/),

  excerpt: z.string().trim().min(20).max(600),

  content: z.string().min(100),

  seoTitle: z.string().trim().min(5).max(250),

  metaDescription: z.string().trim().min(20).max(500),

  focusKeyword: z.string().trim().min(2).max(150),

  secondaryKeywords: z.array(z.string().trim()).max(30),

  robotsIndex: z.boolean(),
  robotsFollow: z.boolean(),

  sitemapPriority: z.number().min(0).max(1),

  publishAt: z.string().datetime().optional().nullable(),
});
```

در صورت استفاده نکردن پروژه از Zod، Validation معادل با ابزار فعلی نوشته شود.

---

# امنیت

الزامات:

* جلوگیری از SQL Injection
* جلوگیری از XSS
* جلوگیری از Stored XSS
* جلوگیری از CSRF
* جلوگیری از SSRF
* جلوگیری از Path Traversal
* جلوگیری از MIME Spoofing
* محدودیت Upload
* بررسی Extension
* بررسی MIME Type واقعی
* Sanitization HTML
* Rate Limiting
* Authentication
* Authorization
* Audit Log
* Soft Delete
* Encryption اطلاعات حساس
* عدم قرار دادن API Key در کد
* Environment Variables
* Content Security Policy
* Secure Headers
* SameSite Cookie
* HttpOnly Cookie
* Secure Cookie در Production
* جلوگیری از Open Redirect
* جلوگیری از Redirect Loop
* جلوگیری از Prototype Pollution
* Timeout درخواست خارجی
* جلوگیری از Mass Assignment

HTML مجاز را با Allowlist کنترل کن.

نمونه تگ‌های مجاز:

```ts
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "pre",
  "code",
  "hr",
  "div",
  "span"
];
```

---

# Performance و Core Web Vitals

* Server-Side Rendering یا Static Generation متناسب با پروژه
* Cache مقاله منتشرشده
* Revalidation بعد از انتشار
* Database Index
* Pagination
* جلوگیری از Query N+1
* Image Optimization
* Code Splitting
* Lazy Load بخش‌های پایین صفحه
* عدم Lazy Load تصویر LCP
* Preload محدود و منطقی
* Font Optimization
* Minification
* Compression
* Brotli یا Gzip
* کاهش JavaScript سمت کلاینت
* عدم Hydration غیرضروری
* Placeholder برای تصویر
* جلوگیری از CLS
* Skeleton سبک
* عدم استفاده از Slider سنگین

اهداف:

```text
LCP کمتر از 2.5 ثانیه
INP کمتر از 200 میلی‌ثانیه
CLS کمتر از 0.1
```

---

# Accessibility

* HTML Semantic
* Heading صحیح
* Keyboard Navigation
* Focus State
* ARIA Label
* Contrast مناسب
* Alt Text
* Skip to Content
* Form Label
* Error Message قابل فهم
* عدم وابستگی کامل به رنگ
* پشتیبانی Screen Reader

---

# ظاهر پنل مدیریت

پنل باید:

* فارسی
* RTL
* Responsive
* مناسب دسکتاپ، تبلت و موبایل
* دارای Dark Mode در صورت پشتیبانی پروژه
* دارای پیام خطای واضح
* دارای Toast
* دارای Loading
* دارای Empty State
* دارای Confirmation Dialog

باشد.

لیست مقالات شامل ستون‌های زیر:

```text
عنوان
سایت
دسته‌بندی
نویسنده
وضعیت
امتیاز سئو
تعداد کلمات
تاریخ انتشار
آخرین ویرایش
بازدید
عملیات
```

فیلترها:

```text
سایت
وضعیت
دسته‌بندی
نویسنده
تاریخ
امتیاز سئو
مقاله ستونی
مقاله همیشه‌سبز
```

عملیات گروهی:

```text
انتشار
لغو انتشار
ارسال برای بازبینی
تغییر دسته‌بندی
افزودن تگ
حذف تگ
Noindex
Index
آرشیو
حذف نرم
Export
```

---

# URL نهایی مقالات

برای سایت تک:

```text
https://poshaktaranom.ir/blog/{slug}
```

برای سایت عمده:

```text
https://poshaktaranom.com/blog/{slug}
```

در صورت متفاوت بودن Route فعلی پروژه، ساختار فعلی را بررسی کن و بدون شکستن URLهای موجود بهترین Route را انتخاب کن.

---

# فایل‌های Environment

در `.env.example` متغیرهای لازم را ثبت کن.

نمونه:

```env
RETAIL_SITE_URL=https://poshaktaranom.ir
WHOLESALE_SITE_URL=https://poshaktaranom.com

BLOG_DEFAULT_TIMEZONE=Asia/Tehran
BLOG_MAX_UPLOAD_MB=10
BLOG_AUTOSAVE_INTERVAL_SECONDS=30
BLOG_MAX_REVISIONS=50

MEDIA_STORAGE_PROVIDER=local

GOOGLE_SEARCH_CONSOLE_CLIENT_ID=
GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET=

GA4_RETAIL_PROPERTY_ID=
GA4_WHOLESALE_PROPERTY_ID=

NEXT_PUBLIC_RETAIL_SITE_URL=https://poshaktaranom.ir
NEXT_PUBLIC_WHOLESALE_SITE_URL=https://poshaktaranom.com
```

متغیرهایی که با تکنولوژی فعلی پروژه مرتبط نیستند اضافه نشوند.

---

# تست‌ها

تست‌های زیر نوشته و اجرا شوند:

## Unit Test

* ساخت Slug
* Validation مقاله
* تولید Canonical
* تولید Robots
* تولید Meta Tags
* تولید Article Schema
* تولید FAQ Schema
* تولید Breadcrumb Schema
* محاسبه زمان مطالعه
* محاسبه امتیاز SEO
* ایجاد Redirect
* جلوگیری از Redirect Loop
* Sanitization محتوا

## Integration Test

* ساخت مقاله
* ویرایش مقاله
* انتشار مقاله
* زمان‌بندی مقاله
* لغو انتشار
* Soft Delete
* Restore
* آپلود تصویر
* ساخت دسته‌بندی
* ساخت تگ
* Import JSON
* Import Markdown
* Sitemap
* RSS
* Permissions

## E2E Test

* ورود مدیر
* ساخت مقاله
* ثبت تنظیمات SEO
* آپلود تصویر
* افزودن FAQ
* افزودن محصول مرتبط
* Preview
* انتشار
* مشاهده مقاله در سایت
* بررسی Meta Tags
* بررسی Schema
* بررسی Canonical
* بررسی Sitemap

---

# تست خروجی SEO

بعد از انتشار یک مقاله آزمایشی، HTML اولیه صفحه را بررسی کن و مطمئن شو موارد زیر قبل از اجرای JavaScript وجود دارند:

```text
<title>
meta description
canonical
robots
Open Graph
Twitter Card
Article JSON-LD
Breadcrumb JSON-LD
H1
محتوای اصلی مقاله
```

---

# مقاله آزمایشی

یک مقاله آزمایشی فقط در محیط Development ایجاد کن.

```ts
const demoArticle = {
  siteKey: "retail",
  title: "راهنمای انتخاب مانتو پاییزه زنانه",
  slug: "autumn-manto-buying-guide",
  excerpt:
    "در این مقاله نکات مهم انتخاب مانتو مناسب فصل پاییز را بررسی می‌کنیم.",
  seoTitle:
    "راهنمای انتخاب مانتو پاییزه زنانه؛ پارچه، رنگ و سایز مناسب",
  metaDescription:
    "برای خرید مانتو پاییزه، جنس پارچه، رنگ، اندازه و مدل مناسب را بشناسید و انتخاب کاربردی‌تری داشته باشید.",
  focusKeyword: "خرید مانتو پاییزه",
  secondaryKeywords: [
    "مانتو پاییزه زنانه",
    "مانتو کتان",
    "مانتو شومیزی"
  ],
  robotsIndex: false,
  robotsFollow: true,
  status: "DRAFT"
};
```

هیچ Demo Data در Production ایجاد نکن.

---

# مستندات

این فایل‌ها را ایجاد کن:

```text
BLOG_MODULE_ARCHITECTURE.md
BLOG_DATABASE_SCHEMA.md
BLOG_API_DOCUMENTATION.md
BLOG_ADMIN_GUIDE.md
BLOG_EDITOR_GUIDE.md
BLOG_SEO_GUIDE.md
BLOG_MEDIA_GUIDE.md
BLOG_IMPORT_FORMAT.md
BLOG_SECURITY.md
BLOG_DEPLOYMENT.md
BLOG_TEST_REPORT.md
BLOG_CHANGELOG.md
```

در فایل `BLOG_IMPORT_FORMAT.md` قالب دقیق JSON و Markdown قابل ورود را ثبت کن تا بتوانم مقاله‌های تولیدشده توسط ChatGPT را مستقیم داخل سیستم Import کنم.

---

# ترتیب اجرای کار

کار را دقیقاً با این ترتیب انجام بده:

1. تحلیل کامل پروژه
2. شناسایی Stack
3. شناسایی ماژول‌های مرتبط
4. گزارش مشکلات فعلی وبلاگ و SEO
5. تهیه Backup و Git Commit
6. طراحی دیتابیس
7. ایجاد Migration
8. ایجاد Backend
9. ایجاد API
10. ایجاد Media Library
11. ایجاد Editor
12. ایجاد پنل مدیریت
13. ایجاد صفحات عمومی وبلاگ
14. ایجاد Meta Tags
15. ایجاد Schema
16. ایجاد Sitemap
17. ایجاد RSS
18. ایجاد Redirect Manager
19. ایجاد SEO Analysis
20. ایجاد Internal Linking
21. ایجاد Version History
22. ایجاد Scheduling
23. ایجاد Import و Export
24. ایجاد Tests
25. اجرای Build
26. رفع TypeScript Errors
27. رفع Lint Errors
28. رفع Test Errors
29. تست Responsive
30. تست Security
31. تست Core Web Vitals
32. تهیه مستندات
33. Git Commit نهایی

---

# الزامات نهایی

* هیچ Mock API در Production باقی نماند.
* هیچ TODO بحرانی باقی نماند.
* هیچ `any` غیرضروری در TypeScript استفاده نشود.
* هیچ خطای Build باقی نماند.
* هیچ خطای TypeScript باقی نماند.
* هیچ خطای Lint باقی نماند.
* تمام Migrationها قابل Rollback باشند.
* تمام APIها Error Handling استاندارد داشته باشند.
* تمام فرم‌ها Validation سمت کلاینت و سرور داشته باشند.
* اطلاعات دو سایت کاملاً تفکیک شوند.
* پنل مدیریت فارسی و RTL باشد.
* داده‌های سایت تک و عمده با هم مخلوط نشوند.
* مقاله Draft قابل ایندکس نباشد.
* Preview قابل ایندکس نباشد.
* صفحه حذف‌شده به‌درستی Redirect یا 410 شود.
* Structured Data فقط بر اساس اطلاعات واقعی تولید شود.
* تصاویر دارای Alt Text، Width و Height باشند.
* تمام URLها Canonical صحیح داشته باشند.
* Sitemap و RSS بعد از انتشار به‌روزرسانی شوند.
* تغییر Slug مقاله منتشرشده Redirect 301 ایجاد کند.

---

# گزارش نهایی

پس از پایان کار، دقیقاً این موارد را گزارش کن:

```text
1. Stack شناسایی‌شده پروژه
2. معماری ماژول ساخته‌شده
3. فایل‌های ایجادشده
4. فایل‌های تغییرکرده
5. Migrationهای ساخته‌شده
6. APIهای ساخته‌شده
7. صفحات پنل مدیریت
8. صفحات عمومی وبلاگ
9. تنظیمات SEO اضافه‌شده
10. Schemaهای اضافه‌شده
11. تست‌های انجام‌شده
12. نتیجه Build
13. نتیجه Lint
14. نتیجه Type Check
15. نتیجه Unit Tests
16. نتیجه Integration Tests
17. متغیرهای Environment لازم
18. روش اجرای Migration
19. روش اجرای پروژه
20. روش ساخت اولین مقاله
21. روش Import مقاله JSON
22. روش Import مقاله Markdown
23. مشکلات یا محدودیت‌های باقی‌مانده
```

در پایان این Commit را ایجاد کن:

```bash
git add .
git commit -m "feat: add multi-site advanced blog and seo management module"
```

ابتدا فقط پروژه را بررسی کن و یک گزارش کوتاه از Stack، ساختار فعلی و برنامه اجرای ماژول بده؛ سپس بدون حذف امکانات قبلی، پیاده‌سازی را مرحله‌به‌مرحله شروع کن.

```
```
