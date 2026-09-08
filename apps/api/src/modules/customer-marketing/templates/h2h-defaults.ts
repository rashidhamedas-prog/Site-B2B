import type { MarketingChannel, MessageClass } from '../customer-marketing.constants';

export type H2hSeed = {
  code: string;
  channel: MarketingChannel;
  title: string;
  medium: 'SMS' | 'CALL';
  messageClass: MessageClass;
  body: string;
  callScript?: string;
  automation: 'on' | 'off' | 'overlap';
};

export const H2H_TEMPLATE_SEEDS: H2hSeed[] = [
  {
    code: 'retail.welcome.after_otp',
    channel: 'RETAIL',
    title: 'خوش‌آمد ورود تکی',
    medium: 'SMS',
    messageClass: 'NURTURE',
    automation: 'on',
    body: `پوشاک ترنم
{name}، ورودتان ثبت شد.
اگر بین سایز یا مدل مردد هستید، همین‌جا بپرسید.
poshaktaranom.ir`,
  },
  {
    code: 'retail.checkout.abandoned',
    channel: 'RETAIL',
    title: 'سبد مانده',
    medium: 'SMS',
    messageClass: 'NURTURE',
    automation: 'overlap',
    body: `پوشاک ترنم
{name}، سبدتان مانده.
اگر سایز یا پرداخت گیر کرده، بگویید کمک کنیم.
poshaktaranom.ir`,
  },
  {
    code: 'retail.care.14d',
    channel: 'RETAIL',
    title: 'مراقبت ۱۴ روز',
    medium: 'SMS',
    messageClass: 'NURTURE',
    automation: 'on',
    body: `پوشاک ترنم
{name}، حدود دو هفته از سفارش {orderNumber} گذشته.
اگر شست‌وشو یا تنخور سؤال شد، بپرسید.`,
  },
  {
    code: 'retail.winback.30d',
    channel: 'RETAIL',
    title: 'پیگیری ۳۰ روز',
    medium: 'SMS',
    messageClass: 'PROMO',
    automation: 'off',
    body: `پوشاک ترنم
{name}، اگر برای انتخاب بعدی بین مدل یا سایز مردد هستید، موقعیت استفاده را بگویید تا محدودتر راهنمایی کنیم.
poshaktaranom.ir`,
  },
  {
    code: 'retail.fit.concern',
    channel: 'RETAIL',
    title: 'نگرانی سایز',
    medium: 'CALL',
    messageClass: 'NURTURE',
    automation: 'off',
    body: `پوشاک ترنم
{name}، پیام‌تان درباره سایز {productName} رسید.
قد و وزن تقریبی یا عکس برچسب سایز را بفرستید تا دقیق‌تر بگوییم.`,
    callScript: 'شروع: سلام {name}، پوشاک ترنمم. درباره سایز بگویید کجا تنگ یا گشاد است.\nتردید: بدون قد و یک دور بدن حدس نمی‌زنم.\nبستن: یادداشت می‌کنم و نتیجه را شفاف می‌گویم. تعویض را تا ندیدن فایل قطعی نمی‌کنم.',
  },
  {
    code: 'retail.complaint',
    channel: 'RETAIL',
    title: 'شکایت تکی',
    medium: 'CALL',
    messageClass: 'NURTURE',
    automation: 'off',
    body: `پوشاک ترنم
{name}، پیام‌تان درباره سفارش {orderNumber} رسید.
همان را بررسی می‌کنیم و نتیجه را می‌گوییم.`,
    callScript: 'شروع: ناراحتی را از زبان خودتان بشنوم.\nتردید: تا وضعیت روشن نشده دفاع نمی‌کنم.\nبستن: با سفارش چک می‌کنم و از همین شماره خبر می‌دهم.',
  },
  {
    code: 'wholesale.apply.received',
    channel: 'WHOLESALE',
    title: 'رسید درخواست عمده',
    medium: 'SMS',
    messageClass: 'NURTURE',
    automation: 'on',
    body: `پوشاک ترنم
درخواست همکاری عمده ثبت شد.
پس از بررسی از همین شماره خبر می‌دهیم.
poshaktaranom.com`,
  },
  {
    code: 'wholesale.apply.pending_wait',
    channel: 'WHOLESALE',
    title: 'انتظار بررسی عمده',
    medium: 'SMS',
    messageClass: 'NURTURE',
    automation: 'on',
    body: `پوشاک ترنم
{name}، پرونده عمده شما هنوز در بررسی است.
اگر مدرک یا توضیح لازم باشد، خبر می‌دهیم.`,
  },
  {
    code: 'wholesale.catalog.first_nudge',
    channel: 'WHOLESALE',
    title: 'یادآوری کاتالوگ',
    medium: 'SMS',
    messageClass: 'NURTURE',
    automation: 'on',
    body: `پوشاک ترنم
{name}، کاتالوگ عمده: poshaktaranom.com
حداقل سفارش و ترکیب سایز هر مدل همان‌جاست. مبهم بود بگویید.`,
  },
  {
    code: 'wholesale.order.none_7d',
    channel: 'WHOLESALE',
    title: 'هفت روز بدون سفارش',
    medium: 'SMS',
    messageClass: 'NURTURE',
    automation: 'on',
    body: `پوشاک ترنم
{name}، اگر حداقل سفارش یا چینش سایز مانع شده، مدل و شهر را بگویید تا روی عدد همان مدل حرف بزنیم.`,
    callScript: 'شروع: حساب فعال است و سفارشی نیامده؛ گیر حداقل/سایز است یا هنوز کاتالوگ؟\nتردید: یک مدل را باز می‌کنیم؛ حاشیه را بدون قیمت همان مدل قول نمی‌دهم.\nبستن: فشاری روی سفارش اول نیست.',
  },
  {
    code: 'wholesale.dormant.45d',
    channel: 'WHOLESALE',
    title: '۴۵ روز بدون سفارش',
    medium: 'SMS',
    messageClass: 'PROMO',
    automation: 'off',
    body: `پوشاک ترنم
{name}، مدتی سفارشی از شما نبود.
اگر ویترین نیاز به شارژ دارد بگویید تا روی مدل‌های قبلی یا موجودی فعلی حرف بزنیم.`,
  },
  {
    code: 'wholesale.apply.approved_intro',
    channel: 'WHOLESALE',
    title: 'معارفه بعد تأیید (تماس)',
    medium: 'CALL',
    messageClass: 'NURTURE',
    automation: 'overlap',
    body: `پوشاک ترنم
{name}، پورتال: poshaktaranom.com/portal
حداقل سفارش هر مدل روی همان صفحه است.`,
    callScript: 'شروع: حساب تأیید شده. اول کاتالوگ یا چینش سایز یک مدل؟\nتردید: حداقل را از روی خود مدل ببینید.\nبستن: لازم نیست امروز سفارش ببندید.',
  },
  {
    code: 'wholesale.help.moq_sizerun',
    channel: 'WHOLESALE',
    title: 'حداقل سفارش و سایز',
    medium: 'CALL',
    messageClass: 'NURTURE',
    automation: 'off',
    body: `پوشاک ترنم
{name}، برای حداقل سفارش و چینش سایز {productName} تماس می‌گیریم.`,
    callScript: 'شروع: حداقل همان مدل را از صفحه محصول می‌خوانم.\nتردید: ترکیب را با ویترین خودتان می‌چینیم.\nبستن: عدد نهایی روی پورتال.',
  },
  {
    code: 'wholesale.complaint',
    channel: 'WHOLESALE',
    title: 'شکایت عمده',
    medium: 'CALL',
    messageClass: 'NURTURE',
    automation: 'off',
    body: `پوشاک ترنم
{name}، مورد سفارش {orderNumber} ثبت شد.
پس از تطبیق با فاکتور و محموله خبر می‌دهیم.`,
    callScript: 'شروع: کسری است، ایراد دوخت، یا اختلاف عدد؟\nتردید: تا شمارش/عکس نبینم تعویض نمی‌گذارم.\nبستن: نتیجه را با عدد می‌گویم.',
  },
  {
    code: 'wholesale.payment.credit',
    channel: 'WHOLESALE',
    title: 'تسویه و اعتبار',
    medium: 'CALL',
    messageClass: 'NURTURE',
    automation: 'off',
    body: `پوشاک ترنم
{name}، درباره تسویه سفارش {orderNumber} تماس می‌گیریم.
اگر ساعت بهتری دارید پیام بدهید.`,
    callScript: 'شروع: وضعیت تسویه را از زبان خودتان بشنوم.\nتردید: روی تلفن سقف اعتبار باز نمی‌کنم.\nبستن: فاکتور را چک می‌کنم و نتیجه مشخص برمی‌گردد.',
  },
];
