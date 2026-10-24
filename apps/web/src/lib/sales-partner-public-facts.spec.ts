/**
 * npx tsx src/lib/sales-partner-public-facts.spec.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDefaultBlocks } from './cms/defaults.ts';
import {
  EARNING_DISCOUNT_PERCENT,
  EARNING_EXAMPLE_ITEMS,
  EARNING_REPEAT_TEMPLATE,
  SP_COMMISSION_PERCENT,
  SP_MIN_PAYOUT_TOMAN,
  STORY_FRAME,
  computeEarningExample,
  renderEarningRepeatNote,
  salesPartnerFaqItems,
  salesPartnerStorySteps,
  parseStorySteps,
  storyCardAlt,
  storySceneAlt,
  STORYBOARD_ART_VERSION,
  STORYBOARD_MOBILE_ART_VERSION,
} from './sales-partner-public-facts.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const figures = computeEarningExample({
  items: EARNING_EXAMPLE_ITEMS,
  discountPercent: EARNING_DISCOUNT_PERCENT,
  commissionPercent: SP_COMMISSION_PERCENT,
  minPayoutToman: SP_MIN_PAYOUT_TOMAN,
});

assert(figures.sum === 4_000_000, `sum ${figures.sum}`);
assert(figures.discount === 400_000, `discount ${figures.discount}`);
assert(figures.base === 3_600_000, `base ${figures.base}`);
assert(figures.commission === 720_000, `commission ${figures.commission}`);
assert(figures.repeat === 1_440_000, `repeat ${figures.repeat}`);
assert(figures.meetsMin && figures.repeat >= SP_MIN_PAYOUT_TOMAN, 'repeat covers the minimum payout');

const note = renderEarningRepeatNote(EARNING_REPEAT_TEMPLATE, figures.repeat, SP_MIN_PAYOUT_TOMAN);
assert(
  note ===
    'اگر هفتهٔ بعد هم یک خرید مشابه از لینکش انجام شود، جمع پورسانت او ۱٬۴۴۰٬۰۰۰ تومان می‌شود؛ یعنی از حداقل ۱ میلیون تومان بیشتر است و می‌تواند درخواست برداشت بدهد.',
  `repeat note drifted: ${note}`,
);

assert(STORY_FRAME.desktop.width === 1280 && STORY_FRAME.desktop.height === 720, 'desktop 16:9');
assert(STORY_FRAME.mobile.width === 1080 && STORY_FRAME.mobile.height === 1350, 'mobile 4:5');
assert(STORY_FRAME.desktop.width / STORY_FRAME.desktop.height === 16 / 9, 'desktop ratio');
assert(STORY_FRAME.mobile.width / STORY_FRAME.mobile.height === 4 / 5, 'mobile ratio');

const steps = salesPartnerStorySteps();
assert(steps.length === 6, 'six scenes');
assert(STORYBOARD_ART_VERSION === 'v2b', 'desktop art version');
assert(STORYBOARD_MOBILE_ART_VERSION === 'v2b', 'mobile art version');
assert(steps[0]?.image === '/sales-partner/storyboard/scene-01-desktop-v2b.webp', 'scene 1 desktop slot');
assert(steps[0]?.imageMobile === '/sales-partner/storyboard/scene-01-mobile-v2b.webp', 'scene 1 mobile slot');
assert(steps[5]?.image === '/sales-partner/storyboard/scene-06-desktop-v2b.webp', 'scene 6 desktop slot');
for (const step of steps) {
  const sceneAlt = storySceneAlt(step.n);
  assert(step.imageAlt === sceneAlt && sceneAlt.length > 20, `scene ${step.n} image alt`);
  assert(!sceneAlt.includes(step.title), `scene ${step.n} alt repeats the title`);
  assert(sceneAlt !== storyCardAlt(step), `scene ${step.n} alt duplicates the baked copy`);
}
assert(
  storyCardAlt(steps[0]!) ===
    'رایگان ثبت‌نام کنید. فرم پایین همین صفحه را پر کنید و کدی را که پیامک می‌شود وارد کنید. عضویت رایگان است.',
  'scene 1 alt',
);
assert(
  storyCardAlt(steps[3]!) ===
    'لینک مخصوص خودتان را بفرستید. از بخش «محصولات» لینک هر کالا را کپی کنید و با عکس‌های آماده برای دوستان یا در اینستاگرام و تلگرام بفرستید. اگر مشتری تا ۱۴ روز از همان لینک خرید کند، خرید به نام شما ثبت می‌شود. راه دوم: مشتری حضوری دارید؟ در «سفارش جدید» سبد را بسازید؛ پیامک تأیید برای مشتری می‌رود و خودش پرداخت می‌کند.',
  `scene 4 alt drifted: ${storyCardAlt(steps[3]!)}`,
);
assert(
  storyCardAlt(steps[1]!) ===
    'کمتر از ۱۲ ساعت صبر کنید. همکاران ترنم درخواستتان را بررسی می‌کنند. بعد از تأیید، نام کاربری و رمز برایتان پیامک می‌شود.',
  'scene 2 alt',
);
assert(
  storyCardAlt(steps[2]!) ===
    'وارد پنل همکاران شوید. با همان شماره موبایل وارد شوید. محصولات، سفارش‌ها، پورسانت و تسویه همه در پنل است.',
  'scene 3 alt',
);
assert(
  storyCardAlt(steps[4]!) ===
    'بقیهٔ کار با ترنم. مشتری روی درگاه امن ترنم پرداخت می‌کند. ما بسته‌بندی و ارسال می‌کنیم. لازم نیست پولی دریافت کنید یا جنسی نگه دارید.',
  'scene 5 alt',
);
assert(
  storyCardAlt(steps[5]!) ===
    '۲۰٪ پورسانت بگیرید. بعد از تحویل سفارش و گذشت ۱۴ روز، پورسانت قابل‌برداشت می‌شود و به شماره شبای شما واریز می‌شود.',
  `scene 6 alt drifted: ${storyCardAlt(steps[5]!)}`,
);

function webpSize(buf: Buffer): { width: number; height: number } {
  if (buf.subarray(0, 4).toString() !== 'RIFF' || buf.subarray(8, 12).toString() !== 'WEBP') {
    throw new Error('not a webp');
  }
  if (buf.subarray(12, 16).toString() !== 'VP8 ') throw new Error('expected lossy VP8');
  const start = buf.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
  if (start < 0) throw new Error('missing VP8 frame');
  return {
    width: buf.readUInt16LE(start + 3) & 0x3fff,
    height: buf.readUInt16LE(start + 5) & 0x3fff,
  };
}

const legacy = parseStorySteps([
  {
    n: 2,
    title: 't',
    body: 'b',
    image: '/sales-partner/storyboard/scene-02-desktop.webp',
    imageMobile: '/sales-partner/storyboard/scene-02-mobile.webp',
  },
])[0];
assert(legacy?.image === '/sales-partner/storyboard/scene-02-desktop-v2b.webp', 'legacy desktop path maps to v2b');
assert(legacy?.imageMobile === '/sales-partner/storyboard/scene-02-mobile-v2b.webp', 'legacy mobile path maps to v2b');
const previous = parseStorySteps([
  {
    n: 2,
    title: 't',
    body: 'b',
    image: '/sales-partner/storyboard/scene-02-desktop-v2a.webp',
    imageMobile: '/sales-partner/storyboard/scene-02-mobile-v2a.webp',
  },
])[0];
assert(previous?.image === '/sales-partner/storyboard/scene-02-desktop-v2b.webp', 'v2a desktop path maps to v2b');
assert(previous?.imageMobile === '/sales-partner/storyboard/scene-02-mobile-v2b.webp', 'v2a mobile path maps to v2b');
assert(previous?.imageAlt === storySceneAlt(2), 'missing image alt falls back to the scene description');
const custom = parseStorySteps([
  { n: 2, title: 't', body: 'b', image: 'https://cdn.example/custom.webp', imageMobile: 'https://cdn.example/m.webp' },
])[0];
assert(custom?.image === 'https://cdn.example/custom.webp', 'custom desktop path is kept');

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../../public/sales-partner/storyboard');
for (const step of steps) {
  const desktop = webpSize(readFileSync(join(publicDir, step.image.replace('/sales-partner/storyboard/', ''))));
  const mobile = webpSize(readFileSync(join(publicDir, step.imageMobile.replace('/sales-partner/storyboard/', ''))));
  assert(
    desktop.width === STORY_FRAME.desktop.width && desktop.height === STORY_FRAME.desktop.height,
    `scene ${step.n} desktop ${desktop.width}x${desktop.height}`,
  );
  assert(
    mobile.width === STORY_FRAME.mobile.width && mobile.height === STORY_FRAME.mobile.height,
    `scene ${step.n} mobile ${mobile.width}x${mobile.height}`,
  );
}

const faq = salesPartnerFaqItems();
assert(faq.length === 12, 'twelve faq items');
assert(faq[0]?.answer.startsWith('۲۰٪'), 'faq commission');
assert(faq[3]?.answer === '۱ میلیون تومان', 'faq minimum');
assert(!faq.some((item) => item.answer.includes('اعلام نمی‌کنیم')), 'old faq sentence gone');

const blocks = getDefaultBlocks('RETAIL', 'salesPartnership');
const dumped = JSON.stringify(blocks);
assert(!blocks.some((block) => block.type === 'process'), 'process block removed');
assert(blocks.some((block) => block.type === 'storyboard'), 'storyboard block');
assert(blocks.some((block) => block.type === 'moneyTimeline'), 'money timeline block');
assert(blocks.some((block) => block.type === 'earningExample'), 'earning example block');
assert(blocks.some((block) => block.type === 'roles'), 'roles block');
assert(!dumped.includes('اعلام نمی‌کنیم'), 'no unpublished-percent sentence');
assert(!dumped.includes('درصد ثابت عمومی'), 'who-section contradiction removed');
assert(dumped.includes('۲۰٪'), 'published percent is in the defaults');
const faqBlock = blocks.find((block) => block.type === 'faq');
assert(faqBlock?.props.emitJsonLd === false, 'page graph owns FAQPage; component must not emit a second one');

console.log('sales-partner-public-facts.spec.ts: ok');
