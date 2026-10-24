/**
 * Public sales-partner figures and the copy that must stay in lockstep with them.
 * Image slots are versioned filenames. A later art swap bumps the version suffix.
 *
 * Desktop: scene-0N-desktop-v2a.webp — 1280×720 (16:9)
 * Mobile:  scene-0N-mobile-v2a.webp  — 1080×1350 (4:5)
 *
 * Filenames carry an art version suffix (STORYBOARD_ART_VERSION). A new art set
 * gets a new suffix so browser, CDN and next/image caches cannot serve old art.
 *
 * The files in public/ are the v2 cards. Persian copy is baked into each image,
 * so the card renders the picture only. `storyCardAlt` is that step's heading
 * plus its description from the brief (scene 4 includes the «راه دوم» note).
 */

export const SP_COMMISSION_PERCENT = 20;
export const SP_MIN_PAYOUT_TOMAN = 1_000_000;
export const SP_HOLD_DAYS = 14;
export const SP_LINK_DAYS = 14;
export const SP_REVIEW_HOURS = 12;
export const SP_PAYOUT_IDLE_DAYS = 14;

/** v2 pixel sizes. Containers use these ratios; a file swap must not change them. */
export const STORY_FRAME = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 1080, height: 1350 },
} as const;

export const STORYBOARD_PUBLIC_DIR = '/sales-partner/storyboard';
/** Bump with every art swap (new files, new names) so no cache serves the old art. */
export const STORYBOARD_ART_VERSION = 'v2a';

const LEGACY_STORYBOARD_SRC = /^\/sales-partner\/storyboard\/scene-\d{2}-(?:desktop|mobile)(?:-v[0-9a-z]+)?\.webp$/;

/** Stored CMS paths that point at an older storyboard file fall back to the current versioned slot. */
function currentStoryboardSrc(stored: unknown, fallback: string): string {
  const value = typeof stored === 'string' ? stored.trim() : '';
  if (!value || LEGACY_STORYBOARD_SRC.test(value)) return fallback;
  return value;
}

export function storyboardImageSrc(scene: number): { desktop: string; mobile: string } {
  const n = String(Math.min(99, Math.max(1, Math.trunc(scene) || 1))).padStart(2, '0');
  return {
    desktop: `${STORYBOARD_PUBLIC_DIR}/scene-${n}-desktop-${STORYBOARD_ART_VERSION}.webp`,
    mobile: `${STORYBOARD_PUBLIC_DIR}/scene-${n}-mobile-${STORYBOARD_ART_VERSION}.webp`,
  };
}

export function formatTomanFa(amount: number): string {
  return Math.trunc(amount).toLocaleString('fa-IR');
}

/** «۱ میلیون تومان» when the amount is a whole million; otherwise the full toman figure. */
export function formatMillionToman(amount: number): string {
  if (amount > 0 && amount % 1_000_000 === 0) {
    return `${formatTomanFa(amount / 1_000_000)} میلیون تومان`;
  }
  return `${formatTomanFa(amount)} تومان`;
}

export type EarningLine = { label: string; priceToman: number };

export type EarningFigures = {
  sum: number;
  discount: number;
  base: number;
  commission: number;
  repeat: number;
  meetsMin: boolean;
};

export function computeEarningExample(input: {
  items: Array<{ priceToman: number }>;
  discountPercent: number;
  commissionPercent: number;
  minPayoutToman: number;
}): EarningFigures {
  const sum = input.items.reduce((total, item) => total + Math.trunc(item.priceToman || 0), 0);
  const discount = Math.floor((sum * input.discountPercent) / 100);
  const base = sum - discount;
  const commission = Math.floor((base * input.commissionPercent) / 100);
  const repeat = commission * 2;
  return {
    sum,
    discount,
    base,
    commission,
    repeat,
    meetsMin: repeat >= input.minPayoutToman,
  };
}

export const EARNING_EXAMPLE_ITEMS: EarningLine[] = [
  { label: 'مانتو', priceToman: 2_400_000 },
  { label: 'شلوار', priceToman: 1_600_000 },
];

export const EARNING_DISCOUNT_PERCENT = 10;

export const EARNING_DISCLAIMER =
  'این فقط یک مثال است و درآمد تضمینی نیست. پورسانت فقط برای سفارش‌هایی است که واقعاً تحویل شده‌اند و مرجوع نشده‌اند.';

export const EARNING_REPEAT_TEMPLATE =
  'اگر هفتهٔ بعد هم یک خرید مشابه از لینکش انجام شود، جمع پورسانت او {repeat} تومان می‌شود؛ یعنی از حداقل {min} بیشتر است و می‌تواند درخواست برداشت بدهد.';

export function renderEarningRepeatNote(template: string, repeat: number, min: number): string {
  return template
    .replaceAll('{repeat}', formatTomanFa(repeat))
    .replaceAll('{min}', formatMillionToman(min));
}

export function earningExampleStory(
  items: EarningLine[] = EARNING_EXAMPLE_ITEMS,
  discountPercent = EARNING_DISCOUNT_PERCENT,
): string {
  const [first, second] = items;
  const discount = formatTomanFa(discountPercent);
  if (!first || !second) {
    return `شخصیت فرضی دو کالا را با کد تخفیف ${discount}٪ می‌خرد. قیمت‌ها فرضی است.`;
  }
  return `خانم «مریم» (شخصیت فرضی) لینک یک ${first.label} ${formatTomanFa(first.priceToman)} تومانی و یک ${second.label} ${formatTomanFa(second.priceToman)} تومانی را برای دوستش می‌فرستد. دوستش هر دو را با کد تخفیف ${discount}٪ می‌خرد.`;
}

export type StoryAside = { title: string; body: string };

export type StoryStepCopy = {
  n: number;
  title: string;
  body: string;
  aside?: StoryAside;
  /** Stable public path. v2 replaces this file; the name stays. */
  image: string;
  imageMobile: string;
};

function sentence(head: string, tail: string): string {
  if (!head) return tail;
  if (!tail) return head;
  return /[.!?؟…]$/.test(head) ? `${head} ${tail}` : `${head}. ${tail}`;
}

/**
 * Alt for one card: the brief heading, then its description.
 * Scene 4's description includes the «راه دوم» aside, which is baked into that card.
 * Nothing else on the card repeats this string.
 */
export function storyCardAlt(step: {
  title?: string;
  body?: string;
  aside?: { title?: string; body?: string } | null;
}): string {
  const title = (step.title ?? '').trim();
  const body = (step.body ?? '').trim();
  const asideTitle = (step.aside?.title ?? '').trim();
  const asideBody = (step.aside?.body ?? '').trim();
  const aside =
    asideTitle && asideBody ? `${asideTitle}: ${asideBody}` : asideTitle || asideBody;
  return sentence(sentence(title, body), aside);
}

export function salesPartnerStorySteps(): StoryStepCopy[] {
  const days = formatTomanFa(SP_LINK_DAYS);
  const hold = formatTomanFa(SP_HOLD_DAYS);
  const hours = formatTomanFa(SP_REVIEW_HOURS);
  const percent = formatTomanFa(SP_COMMISSION_PERCENT);
  const scenes: Array<Omit<StoryStepCopy, 'image' | 'imageMobile'>> = [
    {
      n: 1,
      title: 'رایگان ثبت‌نام کنید',
      body: 'فرم پایین همین صفحه را پر کنید و کدی را که پیامک می‌شود وارد کنید. عضویت رایگان است.',
    },
    {
      n: 2,
      title: `کمتر از ${hours} ساعت صبر کنید`,
      body: 'همکاران ترنم درخواستتان را بررسی می‌کنند. بعد از تأیید، نام کاربری و رمز برایتان پیامک می‌شود.',
    },
    {
      n: 3,
      title: 'وارد پنل همکاران شوید',
      body: 'با همان شماره موبایل وارد شوید. محصولات، سفارش‌ها، پورسانت و تسویه همه در پنل است.',
    },
    {
      n: 4,
      title: 'لینک مخصوص خودتان را بفرستید',
      body: `از بخش «محصولات» لینک هر کالا را کپی کنید و با عکس‌های آماده برای دوستان یا در اینستاگرام و تلگرام بفرستید. اگر مشتری تا ${days} روز از همان لینک خرید کند، خرید به نام شما ثبت می‌شود.`,
      aside: {
        title: 'راه دوم',
        body: 'مشتری حضوری دارید؟ در «سفارش جدید» سبد را بسازید؛ پیامک تأیید برای مشتری می‌رود و خودش پرداخت می‌کند.',
      },
    },
    {
      n: 5,
      title: 'بقیهٔ کار با ترنم',
      body: 'مشتری روی درگاه امن ترنم پرداخت می‌کند. ما بسته‌بندی و ارسال می‌کنیم. لازم نیست پولی دریافت کنید یا جنسی نگه دارید.',
    },
    {
      n: 6,
      title: `${percent}٪ پورسانت بگیرید`,
      body: `بعد از تحویل سفارش و گذشت ${hold} روز، پورسانت قابل‌برداشت می‌شود و به شماره شبای شما واریز می‌شود.`,
    },
  ];
  return scenes.map((scene) => {
    const src = storyboardImageSrc(scene.n);
    return { ...scene, image: src.desktop, imageMobile: src.mobile };
  });
}

export function salesPartnerMoneyStages(): Array<{ title: string; body: string }> {
  const days = formatTomanFa(SP_HOLD_DAYS);
  const idle = formatTomanFa(SP_PAYOUT_IDLE_DAYS);
  const min = formatMillionToman(SP_MIN_PAYOUT_TOMAN);
  return [
    { title: 'در انتظار', body: 'مشتری پرداخت کرد؛ پورسانت در پنل دیده می‌شود.' },
    { title: 'قابل‌برداشت', body: `${days} روز بعد از تحویل سفارش.` },
    {
      title: 'درخواست تسویه',
      body: `وقتی موجودی قابل‌برداشت به ${min} رسید، از پنل درخواست بدهید.`,
    },
    {
      title: 'واریز به شبا',
      body: `اگر ${idle} روز درخواست ندهید، نگران نباشید: در تسویهٔ ماهانه خودکار واریز می‌شود.`,
    },
  ];
}

export const SALES_PARTNER_MONEY_NOTE =
  'اگر سفارشی لغو یا مرجوع شود، پورسانت همان کالا حذف می‌شود.';

export function salesPartnerRoles(): { you: string[]; taranom: string[] } {
  return {
    you: [
      'انتخاب محصول از پنل',
      'فرستادن لینک یا ساخت سفارش',
      'راهنمایی مشتری برای انتخاب مدل و سایز',
    ],
    taranom: [
      'قیمت و موجودی',
      'دریافت پول از مشتری',
      'بسته‌بندی و ارسال',
      'پیگیری، تعویض و مرجوعی',
      'واریز پورسانت به شبای شما',
    ],
  };
}

export function salesPartnerFaqItems(): Array<{ question: string; answer: string }> {
  const percent = formatTomanFa(SP_COMMISSION_PERCENT);
  const days = formatTomanFa(SP_HOLD_DAYS);
  const linkDays = formatTomanFa(SP_LINK_DAYS);
  const idle = formatTomanFa(SP_PAYOUT_IDLE_DAYS);
  const hours = formatTomanFa(SP_REVIEW_HOURS);
  const min = formatMillionToman(SP_MIN_PAYOUT_TOMAN);
  return [
    {
      question: 'چقدر پورسانت می‌گیرم؟',
      answer: `${percent}٪ مبلغ کالا بعد از تخفیف. هزینه ارسال حساب نمی‌شود.`,
    },
    {
      question: 'کی پولم را می‌گیرم؟',
      answer: `${days} روز بعد از تحویل سفارش، پورسانت قابل‌برداشت می‌شود.`,
    },
    {
      question: 'پول چطور به من می‌رسد؟',
      answer: 'به شماره شبایی که در بخش «حساب» ثبت می‌کنید.',
    },
    {
      question: 'حداقل برداشت چقدر است؟',
      answer: min,
    },
    {
      question: 'اگر درخواست تسویه ندهم چه می‌شود؟',
      answer: `اگر ${idle} روز درخواست ندهید، در تسویهٔ ماهانه خودکار واریز می‌شود.`,
    },
    {
      question: 'عضویت هزینه دارد؟ باید جنس بخرم؟',
      answer: 'عضویت رایگان است و خرید یا انبار کردن کالا لازم نیست.',
    },
    {
      question: 'بررسی ثبت‌نام چقدر طول می‌کشد؟',
      answer: `معمولاً کمتر از ${hours} ساعت.`,
    },
    {
      question: 'اگر مشتری امروز لینک را باز کند و چند روز بعد بخرد؟',
      answer: `تا ${linkDays} روز روی همان گوشی یا مرورگر به نام شما ثبت می‌شود. اگر بعداً از لینک همکار دیگری بخرد، به نام آخرین لینک ثبت می‌شود.`,
    },
    {
      question: 'اگر مشتری کالا را مرجوع کند؟',
      answer: 'پورسانت همان کالا حذف می‌شود.',
    },
    {
      question: 'می‌توانم برای خودم بخرم؟',
      answer: 'خیر، خرید با شماره خودتان پورسانت ندارد.',
    },
    {
      question: 'پول مشتری را من می‌گیرم؟',
      answer: 'خیر، پرداخت فقط روی درگاه ترنم است.',
    },
    {
      question: 'سوال یا مشکل داشتم؟',
      answer: 'از بخش تیکت داخل پنل پیام بدهید.',
    },
  ];
}

export function salesPartnerWhoClosing(): string {
  const percent = formatTomanFa(SP_COMMISSION_PERCENT);
  return `درآمد تضمینی نیست. پورسانت ${percent}٪ مبلغ کالا بعد از تخفیف است؛ هزینهٔ ارسال و کیف پول مشتری حساب نمی‌شود.`;
}

export function parseStorySteps(raw: unknown): StoryStepCopy[] {
  if (!Array.isArray(raw)) return [];
  const steps: StoryStepCopy[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const record = item as Record<string, unknown>;
    const n = typeof record.n === 'number' && record.n > 0 ? Math.trunc(record.n) : index + 1;
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const body = typeof record.body === 'string' ? record.body.trim() : '';
    if (!title && !body) return;
    const src = storyboardImageSrc(n);
    let aside: StoryAside | undefined;
    if (record.aside && typeof record.aside === 'object') {
      const extra = record.aside as Record<string, unknown>;
      const asideTitle = typeof extra.title === 'string' ? extra.title.trim() : '';
      const asideBody = typeof extra.body === 'string' ? extra.body.trim() : '';
      if (asideTitle || asideBody) aside = { title: asideTitle, body: asideBody };
    }
    const step: StoryStepCopy = {
      n,
      title,
      body,
      image: currentStoryboardSrc(record.image, src.desktop),
      imageMobile: currentStoryboardSrc(record.imageMobile, src.mobile),
    };
    if (aside) step.aside = aside;
    steps.push(step);
  });
  return steps;
}
