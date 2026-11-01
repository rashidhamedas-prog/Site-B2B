/** Still-lifes for the about scrollytelling. Illustrations of the process, not photos of the Mashhad floor. */
export const ABOUT_STAGES = [
  {
    kicker: 'کارگاه',
    title: 'انتخاب پارچه',
    body: 'هر مدل از بررسی لینن و کتان شروع می‌شود؛ پارچه‌هایی که سبک می‌مانند، فرم ویترین را نگه می‌دارند و برای کار روزانه بوتیک مناسب‌اند. طاقه خام روی میز برش، نقطه آغاز همکاری با فروشنده است.',
    src: '/about/process/01-linen-bolt.webp',
    alt: 'طاقه لینن بازشده روی میز برش، کنار متر پارچه',
  },
  {
    kicker: 'الگو',
    title: 'طراحی و برش',
    body: 'الگو در کارگاه مشهد روی پارچه می‌نشیند و برش داخل مجموعه انجام می‌شود. هدف، سایزبندی منظم و جزئیاتی است که روی مانکن فروشگاه خوانا بماند؛ نه دوخت نمایشی جدا از خط تولید.',
    src: '/about/process/02-pattern-cut.webp',
    alt: 'الگوی کاغذی لباس و قیچی روی پارچه لینن',
  },
  {
    kicker: 'خط تولید',
    title: 'دوخت و کنترل کیفیت',
    body: 'قطعه‌ها به هم می‌رسند، دوخت صنعتی انجام می‌شود و پیش از بسته‌بندی کنترل می‌شود. این فاصله کوتاه بین کارگاه و دفتر پخش کمک می‌کند فروشنده مدل را با اطمینان به ویترین ببرد.',
    src: '/about/process/03-sewing.webp',
    alt: 'چرخ خیاطی صنعتی در حال دوخت پارچه لینن',
  },
  {
    kicker: 'عمده',
    title: 'آماده برای فروش عمده',
    body: 'لباس از کارگاه به دفتر پخش محدوده ۱۷ شهریور، پاساژ کیمیا می‌رسد. از آنجا می‌توانید مدل را ببینید، سفارش عمده ثبت کنید و ارسال به سراسر ایران را پیگیری کنید.',
    src: '/about/process/04-wholesale-ready.webp',
    alt: 'سه مانتو لینن روی چوب‌لباسی و کارتن آماده ارسال',
  },
] as const;

export function aboutSceneIndex(stage: number) {
  if (!Number.isFinite(stage)) return 0;
  return Math.min(ABOUT_STAGES.length - 1, Math.max(0, Math.trunc(stage)));
}
