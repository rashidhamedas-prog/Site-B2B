/**
 * npx tsx src/lib/sales-partner-public-facts.spec.ts
 */
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
  storyCardAlt,
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
assert(steps[0]?.image === '/sales-partner/storyboard/scene-01-desktop.webp', 'scene 1 desktop slot');
assert(steps[0]?.imageMobile === '/sales-partner/storyboard/scene-01-mobile.webp', 'scene 1 mobile slot');
assert(steps[5]?.image === '/sales-partner/storyboard/scene-06-desktop.webp', 'scene 6 desktop slot');
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
assert(storyCardAlt(steps[5]!).includes('۲۰٪') && storyCardAlt(steps[5]!).includes('۱۴ روز'), 'scene 6 alt facts');

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
