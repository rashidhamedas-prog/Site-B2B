/**
 * SEO analysis unit checks (no jest).
 * Run: npx ts-node --transpile-only src/modules/blog/blog-seo-analysis.spec.ts
 */
import { analyzeSeo } from './blog-seo-analysis';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const poor = analyzeSeo({ title: '', content: 'کوتاه' });
assert(poor.score < 50, 'poor score');
assert(poor.errors.some((e) => e.id === 'title'), 'missing title error');

const good = analyzeSeo({
  title: 'راهنمای انتخاب مانتو پاییزه زنانه برای خرید بهتر',
  seoTitle: 'راهنمای انتخاب مانتو پاییزه زنانه؛ پارچه و سایز',
  metaDescription:
    'برای خرید مانتو پاییزه، جنس پارچه، رنگ، اندازه و مدل مناسب را بشناسید و انتخاب کاربردی‌تری داشته باشید.',
  focusKeyword: 'خرید مانتو پاییزه',
  slug: 'kharid-manto-payize',
  excerpt: 'در این مقاله نکات مهم انتخاب مانتو مناسب فصل پاییز را بررسی می‌کنیم.',
  content: `برای خرید مانتو پاییزه باید به چند نکته توجه کنید.

## خرید مانتو پاییزه و پارچه

متن کافی برای عبور از حداقل تعداد کلمات. ${' کلمه '.repeat(320)}

## رنگ و استایل

نکات بیشتر درباره استایل.`,
  coverImage: 'https://example.com/a.webp',
  coverAlt: 'مانتو پاییزه',
  faqItems: [{ question: 'سوال؟', answer: 'جواب' }],
  primaryCta: { buttonUrl: '/products' },
  relatedArticleIds: ['a'],
  relatedProductIds: ['p'],
  authorName: 'ترنم',
  publishedAt: new Date().toISOString(),
  canonicalType: 'SELF',
  robotsIndex: true,
  articleSchemaEnabled: true,
  breadcrumbEnabled: true,
});

assert(good.score >= 70, `good score got ${good.score}`);
assert(good.status === 'GOOD' || good.status === 'EXCELLENT', 'good status');

console.log('blog-seo-analysis.spec.ts: all assertions passed');
