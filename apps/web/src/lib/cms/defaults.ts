import { newBlockId, type ContentBlock, type BlockType } from './types';

function b(type: BlockType, props: Record<string, unknown>): ContentBlock {
  return { id: newBlockId(), type, props };
}

/** Header top bar + brand + footer + floating contact — pageKey `chrome` */
export function defaultWholesaleChrome(): ContentBlock[] {
  return [
    b('announcement', {
      enabled: true,
      phoneLabel: '۰۹۱۵-۲۴۲-۴۶۲۴',
      phoneHref: 'tel:09152424624',
      telegramLabel: '@toliditaranom کانال تلگرام',
      telegramHref: 'https://t.me/toliditaranom',
      text: 'ارسال به سراسر ایران — حداقل سفارش ۵ عدد',
    }),
    b('chrome', {
      brandName: 'پوشاک ترنم',
      brandTagline: 'تولیدی مانتو زنانه مشهد',
      logoUrl: '/logo-128.png',
      registerLabel: 'ثبت‌نام عمده‌فروش',
      registerHref: '/portal/register',
      portalHref: '/portal',
      blurb:
        'از سال ۱۳۹۴ تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد. فروش عمده به بوتیک‌ها و فروشندگان در سراسر ایران.',
      footerQuickTitle: 'دسترسی سریع',
      footerLegalTitle: 'اطلاعات حقوقی',
      footerContactTitle: 'اطلاعات تماس',
      phoneLabel: '۰۹۱۵-۲۴۲-۴۶۲۴',
      phoneHref: 'tel:09152424624',
      ownerLabel: 'حامد رشید — مدیر فروش',
      addressTitle: 'دفتر پخش:',
      addressLines: [
        'مشهد — میدان ۱۷ شهریور',
        'پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳',
      ],
      telegramHref: 'https://t.me/toliditaranom',
      instagramHref: 'https://instagram.com/tolidi.taranom',
      copyright: '© ۱۴۰۳ پوشاک ترنم — تمامی حقوق محفوظ است',
      madeInLabel: 'تولید و طراحی در مشهد',
      retailStoreLabel: 'فروشگاه خرید تکی',
      retailStoreHref: 'https://www.poshaktaranom.ir',
      floatPhone: '09152424624',
      floatWhatsapp: '989152424624',
      floatTelegram: 'toliditaranom',
      floatWhatsappMessage: 'سلام، میخوام اطلاعات عمده‌فروشی ترنم رو بدونم',
    }),
  ];
}

export function defaultWholesaleHome(): ContentBlock[] {
  return [
    b('hero', {
      brandEyebrow: 'پوشاک ترنم',
      headline: 'مانتو زنانه\nمستقیم از تولیدی\nبه بوتیک شما',
      headlineAccent: 'به بوتیک شما',
      body: 'تولیدکننده مانتو شومیزی لینن و کتان در مشهد — بیش از ده سال تجربه، فروش عمده به سراسر ایران.',
      imageUrl: '',
      ctaLabel: 'مشاهده محصولات',
      ctaHref: '/products',
      ctaSecondaryLabel: 'ثبت‌نام عمده‌فروش',
      ctaSecondaryHref: '/portal/register',
    }),
    b('stats', {
      items: [
        { value: '+۵۰۰', label: 'مشتری عمده‌فروش', sublabel: 'در سراسر ایران' },
        { value: '۱۰+', label: 'سال تجربه', sublabel: 'در بازار پوشاک' },
        { value: '+۵۰', label: 'مدل فعال', sublabel: 'بهار و تابستان' },
        { value: '۱۵', label: 'نفر پرسنل', sublabel: 'در خط تولید' },
      ],
    }),
    b('features', {
      eyebrow: 'اعتماد عمده‌فروشان',
      headline: 'چرا تولیدی ترنم؟',
      body: 'مزایایی که همکاری با تولیدی ترنم را برای بوتیک‌ها پایدار و سودآور می‌کند',
      items: [
        {
          icon: 'Package',
          title: 'تولید ۰ تا ۱۰۰ داخل کارگاه',
          description:
            'از برش تا بسته‌بندی در کارگاه ترنم انجام می‌شود؛ کنترل کیفیت مستقیم و قیمت کارخانه برای عمده‌فروشان.',
        },
        {
          icon: 'Shield',
          title: 'ضمانت شستشوی آنزیمی',
          description:
            'لینن و پارچه‌های حساس با شستشوی آنزیمی ضدآبرفت آماده می‌شوند تا بوتیک شما مرجوعی کمتری داشته باشد.',
        },
        {
          icon: 'Zap',
          title: '۱۴ سال تجربه تولیدی',
          description:
            'از ۱۳۹۴ تا امروز، تامین‌کننده بوتیک‌ها در مشهد و سراسر ایران با کلکسیون‌های فصلی مستمر.',
        },
        {
          icon: 'Truck',
          title: 'ارسال سریع',
          description: 'ارسال چاپار به سراسر ایران. ارسال رایگان برای سفارش‌های بالای ۵۰۰ هزار تومان.',
        },
        {
          icon: 'CreditCard',
          title: 'پرداخت اعتباری',
          description: 'مشتریان دائمی می‌توانند از اعتبار خرید استفاده کنند. سیستم فاکتور و حساب‌کتاب دقیق.',
        },
        {
          icon: 'Headphones',
          title: 'پشتیبانی اختصاصی',
          description: 'ویزیتور اختصاصی برای مشتریان مشهد و چند شهر. پشتیبانی تلفنی و تلگرامی.',
        },
      ],
    }),
    b('products', {
      eyebrow: 'کاتالوگ فصل',
      headline: 'محصولات برتر',
      body: 'پرفروش‌ترین و جدیدترین مدل‌های فصل',
      ctaLabel: 'همه محصولات',
      ctaHref: '/products',
      limit: 6,
      viewAllLabel: 'مشاهده همه محصولات',
    }),
    b('comingSoon', {
      eyebrow: 'پیش‌خرید ویژه',
      headline: 'به‌زودی در ترنم',
      body: 'مدل‌های جدید فصل را قبل از عرضه عمومی پیش‌خرید کنید و از تخفیف ویژه عمده‌فروشان بهره‌مند شوید.',
      callout: 'فرصت محدود برای عمده‌فروشان تأییدشده',
      ctaLabel: 'کاتالوگ کامل',
      ctaHref: '/products',
    }),
    b('process', {
      eyebrow: 'فرآیند ساده',
      headline: 'فرآیند خرید عمده',
      body: 'چهار قدم تا دریافت سفارش در بوتیک شما',
      steps: [
        {
          step: '۰۱',
          title: 'ثبت‌نام',
          description: 'فرم ثبت‌نام را تکمیل کنید. تیم فروش ظرف ۲۴ ساعت با شما تماس می‌گیرد.',
        },
        {
          step: '۰۲',
          title: 'مشاهده کاتالوگ',
          description: 'پس از تأیید، به قیمت‌های عمده و تمام مدل‌های فصل دسترسی پیدا می‌کنید.',
        },
        {
          step: '۰۳',
          title: 'ثبت سفارش',
          description: 'سفارش خود را آنلاین ثبت کنید. پیش‌فاکتور فوری صادر می‌شود.',
        },
        {
          step: '۰۴',
          title: 'دریافت سفارش',
          description: 'پس از تأیید پرداخت، سفارش بسته‌بندی و از طریق چاپار ارسال می‌شود.',
        },
      ],
    }),
    b('testimonials', {
      eyebrow: 'نظر مشتریان',
      headline: 'بوتیک‌داران چه می‌گویند',
      body: 'تجربه واقعی عمده‌فروشان سراسر ایران از همکاری با ترنم',
      items: [
        {
          name: 'فاطمه رضایی',
          business: 'بوتیک گلستان',
          city: 'تهران',
          rating: 5,
          text: 'بیش از ۳ سال است که از ترنم خرید می‌کنم. کیفیت پارچه و دوخت مانتوها فوق‌العاده است. مشتریانم همیشه از جنس و طرح‌ها راضی هستند. پشتیبانی سریع و ارسال به موقع هم از مزایای بزرگ این تولیدی است.',
          avatar: 'ف',
        },
        {
          name: 'مریم احمدی',
          business: 'گالری پوشاک مریم',
          city: 'اصفهان',
          rating: 5,
          text: 'مانتوهای لینن ترنم در بوتیک ما بهترین فروش را دارند. طرح‌ها خاص و متفاوت هستند و رقبا نمی‌توانند پیدا کنند. سیستم آنلاین سفارش‌گیری هم خیلی راحت شده — دیگر نیازی به تلفن نیست.',
          avatar: 'م',
        },
        {
          name: 'زهرا کریمی',
          business: 'پوشاک زیبا',
          city: 'مشهد',
          rating: 5,
          text: 'از وقتی با ترنم آشنا شدم، دیگر از جای دیگری خرید نمی‌کنم. قیمت مستقیم کارخانه، کیفیت درجه یک، و تنوع رنگ و سایز. ویزیتور حضوری هم هر ماه می‌آید و آخرین مدل‌ها را نشان می‌دهد.',
          avatar: 'ز',
        },
        {
          name: 'سمیرا حسینی',
          business: 'بوتیک آناهیتا',
          city: 'شیراز',
          rating: 5,
          text: 'پنل مشتری خیلی کار ما را ساده کرده. فاکتور، وضعیت سفارش، سابقه خرید — همه در یک جا. مانتوهای کتان امسال خیلی خوب فروختند. حتما برای فصل پاییز هم سفارش می‌دهم.',
          avatar: 'س',
        },
        {
          name: 'نگار محمدی',
          business: 'گالری مد نگار',
          city: 'تبریز',
          rating: 5,
          text: 'دوخت و کیفیت محصولات ترنم واقعاً ممتاز است. لینن‌هایشان خیلی راحت هستند و مشتریان بازار می‌آیند. قیمت‌گذاری منصفانه و تخفیف مشتریان دائمی هم خیلی خوب است.',
          avatar: 'ن',
        },
      ],
      footerStats: [
        { value: '+۲۰۰', label: 'مشتری فعال' },
        { value: '+۳۰', label: 'شهر در ایران' },
        { value: '۱۰+', label: 'سال تجربه' },
        { value: '+۵۰', label: 'مدل در کاتالوگ' },
      ],
    }),
    b('faq', {
      headline: 'سوالاتی که معمولاً می‌پرسند',
      body: 'جواب کوتاه، بدون حاشیه — اگر چیزی جا ماند با ما تماس بگیرید.',
      items: [
        {
          question: 'حداقل سفارش عمده چقدر است؟',
          answer:
            'برای بیشتر مدل‌ها حداقل سفارش حدود ۵ عدد است. عدد دقیق هر محصول روی صفحه همان مدل نوشته شده.',
        },
        {
          question: 'ارسال عمده به شهرستان دارید؟',
          answer:
            'بله. سفارش‌ها از دفتر پخش مشهد بسته‌بندی می‌شوند و به سراسر ایران ارسال می‌گردند.',
        },
        {
          question: 'چطور عمده‌فروش شوم؟',
          answer:
            'از صفحه شرایط عمده یا ثبت‌نام پنل مشتری درخواست بدهید. بعد از تأیید، قیمت عمده و ثبت سفارش برایتان باز می‌شود.',
        },
        {
          question: 'خرید تکی هم دارید؟',
          answer:
            'بله — فروشگاه تکی روی دامنه poshaktaranom.ir است. این سایت (.com) مخصوص همکاری عمده با بوتیک‌هاست.',
        },
      ],
    }),
    b('cta', {
      eyebrow: 'شروع همکاری',
      headline: 'آماده همکاری با ترنم هستید؟',
      body: 'همین الان ثبت‌نام کنید و به جمع عمده‌فروشان ما در سراسر ایران بپیوندید، یا با تیم فروش تماس بگیرید.',
      ctaLabel: 'ثبت‌نام رایگان',
      ctaHref: '/portal/register',
      ctaSecondaryLabel: 'تماس با فروش',
      ctaSecondaryHref: 'tel:09152424624',
      ctaTertiaryLabel: 'تلگرام',
      ctaTertiaryHref: 'https://t.me/toliditaranom',
    }),
  ];
}

export function defaultWholesaleAbout(): ContentBlock[] {
  return [
    b('hero', {
      brandEyebrow: 'هویت برند',
      headline: 'درباره پوشاک ترنم',
      body: 'از سال ۱۳۹۴، تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد',
      ctaLabel: '',
      ctaHref: '',
      ctaSecondaryLabel: '',
      ctaSecondaryHref: '',
      imageUrl: '',
    }),
    b('text', {
      headline: 'داستان ما',
      body:
        'پوشاک ترنم در سال ۱۳۹۴ توسط حامد رشید از صفر پایه‌گذاری شد. با بیش از ۱۰ سال تجربه در بازاریابی و مدیریت فروش پوشاک، حامد تصمیم گرفت تولیدی خودش را راه‌اندازی کند که بر کیفیت پارچه و طراحی مدرن تمرکز داشته باشد.\n\nتخصص ما مانتو شومیزی زنانه اسپرت از جنس لینن و کتان است — پارچه‌هایی که تهویه مناسب داشته، سبک بوده و برای آب‌وهوای ایران مناسب هستند. امروز با تیمی ۱۵ نفره، هر فصل مدل‌های جدید را به بازار عرضه می‌کنیم.',
    }),
    b('stats', {
      items: [
        { value: '۱۳۹۴', label: 'سال تأسیس', sublabel: '' },
        { value: '۱۵ نفر', label: 'تیم تولید', sublabel: '' },
        { value: '+۵۰۰', label: 'مشتری فعال', sublabel: '' },
        { value: '+۵۰ مدل', label: 'در هر فصل', sublabel: '' },
      ],
    }),
    b('contact', {
      headline: 'مکان‌های ما',
      channels: [],
      hours: [],
      locations: [
        {
          title: 'کارگاه تولید',
          address: 'مشهد — بلوار نبوت — میدان عسگریه — خیابان قائمی — پلاک ۱۳۷',
          note: 'ملک ویلایی ۲۵۰ متر، دو طبقه',
        },
        {
          title: 'دفتر پخش',
          address: 'مشهد — میدان ۱۷ شهریور — پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳',
          note: '',
        },
      ],
    }),
    b('features', {
      eyebrow: '',
      headline: 'ارزش‌های ما',
      body: '',
      items: [
        {
          icon: 'Shield',
          title: 'کیفیت بدون واسطه',
          description: 'کنترل کیفیت داخل کارگاه خودمان انجام می‌شود.',
        },
        {
          icon: 'Package',
          title: 'قیمت کارخانه',
          description: 'فروش مستقیم به بوتیک بدون واسطه.',
        },
        {
          icon: 'Headphones',
          title: 'همراهی بلندمدت',
          description: 'پشتیبانی و ویزیت برای مشتریان دائمی.',
        },
      ],
    }),
  ];
}

export function defaultWholesaleContact(): ContentBlock[] {
  return [
    b('hero', {
      brandEyebrow: 'ارتباط',
      headline: 'تماس با ما',
      body: 'برای همکاری عمده، سوال درباره سفارش یا بازدید از دفتر پخش با ما در ارتباط باشید.',
      ctaLabel: '',
      ctaHref: '',
      imageUrl: '',
    }),
    b('contact', {
      headline: 'راه‌های ارتباطی',
      channels: [
        { icon: 'Phone', title: 'تلفن', value: '۰۹۱۵-۲۴۲-۴۶۲۴', href: 'tel:09152424624' },
        { icon: 'Send', title: 'تلگرام', value: '@toliditaranom', href: 'https://t.me/toliditaranom' },
        {
          icon: 'Instagram',
          title: 'اینستاگرام',
          value: '@tolidi.taranom',
          href: 'https://instagram.com/tolidi.taranom',
        },
      ],
      hours: [
        { day: 'شنبه تا چهارشنبه', time: '۸ تا ۱۷' },
        { day: 'پنج‌شنبه', time: '۸ تا ۱۳' },
        { day: 'جمعه', time: 'تعطیل' },
      ],
      locations: [
        {
          title: 'دفتر پخش',
          address: 'مشهد — میدان ۱۷ شهریور — پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳',
          note: 'ویزیت حضوری با هماهنگی قبلی',
        },
        {
          title: 'کارگاه',
          address: 'مشهد — بلوار نبوت — میدان عسگریه — خیابان قائمی — پلاک ۱۳۷',
          note: '',
        },
      ],
    }),
  ];
}

/** Simple text-page defaults for legal / policy pages */
export function defaultTextPage(headline: string, body: string): ContentBlock[] {
  return [b('text', { headline, body })];
}

export function getDefaultBlocks(
  channel: 'WHOLESALE' | 'RETAIL',
  pageKey: string,
): ContentBlock[] {
  if (channel === 'WHOLESALE') {
    switch (pageKey) {
      case 'chrome':
        return defaultWholesaleChrome();
      case 'home':
        return defaultWholesaleHome();
      case 'about':
        return defaultWholesaleAbout();
      case 'contact':
        return defaultWholesaleContact();
      case 'wholesale':
        return [
          b('hero', {
            brandEyebrow: 'همکاری تجاری',
            headline: 'شرایط عمده‌فروشی',
            body: 'راهنمای کامل همکاری با تولیدی ترنم برای بوتیک‌ها و فروشندگان عمده',
            ctaLabel: 'درخواست عضویت',
            ctaHref: '/portal/register',
            ctaSecondaryLabel: 'ورود به پنل',
            ctaSecondaryHref: '/portal/login',
            imageUrl: '',
          }),
          b('features', {
            eyebrow: '',
            headline: 'سطح‌بندی مشتریان',
            body: 'قیمت نهایی بر اساس سطح مشتری تعیین می‌شود',
            items: [
              {
                icon: 'Package',
                title: 'سطح A — عمده بزرگ',
                description: 'بالای ۱۵۰ پیراهن در ماه — بالاترین تخفیف، اعتبار بیشتر، اولویت رنگ‌بندی، ارسال رایگان',
              },
              {
                icon: 'Truck',
                title: 'سطح B — عمده متوسط',
                description: '۵۰ تا ۱۵۰ پیراهن در ماه — تخفیف متوسط، اعتبار خرید، ارسال نیمه‌رایگان',
              },
              {
                icon: 'CreditCard',
                title: 'سطح C — عمده پایه',
                description: 'زیر ۵۰ پیراهن در ماه — قیمت پایه عمده، سفارش نقدی، ارسال با هزینه',
              },
            ],
          }),
          b('text', {
            headline: 'حداقل سفارش و پرداخت',
            body:
              'حداقل سفارش اولیه: ۱۲ عدد از یک مدل. ترکیب سایزبندی: ۲ عدد از هر سایز (۳۸ تا ۴۶). حداقل رنگ: ۳ رنگ از هر مدل.\n\nپرداخت: نقد در تحویل، چک یک‌ماهه (مشتریان تأییدشده)، نسیه تا سقف اعتبار، انتقال بانکی.',
          }),
          b('cta', {
            eyebrow: '',
            headline: 'آماده همکاری هستید؟',
            body: 'فرم درخواست عضویت را پر کنید. تیم ما ظرف ۲۴ ساعت با شما تماس می‌گیرد.',
            ctaLabel: 'ثبت درخواست عضویت',
            ctaHref: '/portal/register',
            ctaSecondaryLabel: '',
            ctaSecondaryHref: '',
            ctaTertiaryLabel: '',
            ctaTertiaryHref: '',
          }),
        ];
      case 'shipping':
        return [
          b('hero', {
            brandEyebrow: '',
            headline: 'شرایط ارسال',
            body: 'نحوه ارسال سفارشات عمده به سراسر ایران',
            ctaLabel: '',
            ctaHref: '',
            imageUrl: '',
          }),
          b('features', {
            headline: '',
            body: '',
            items: [
              { icon: 'Zap', title: 'زمان آماده‌سازی', description: '۱ تا ۳ روز کاری پس از تأیید سفارش' },
              { icon: 'Truck', title: 'روش‌های ارسال', description: 'چاپار، تیپاکس، پست، تحویل حضوری (مشهد)' },
              { icon: 'Package', title: 'پوشش ارسال', description: 'سراسر ایران — شهرهای بزرگ اولویت دارند' },
              { icon: 'Shield', title: 'بسته‌بندی', description: 'کیف‌های پلی‌اتیلن + کارتن محکم' },
            ],
          }),
          b('html', {
            body:
              '<div class="max-w-3xl mx-auto"><h2 class="font-bold text-gray-900 mb-4">هزینه ارسال</h2><p class="text-sm text-gray-600 mb-2">سطح A: رایگان مشهد و سراسر ایران</p><p class="text-sm text-gray-600 mb-2">سطح B: رایگان مشهد — نیمه‌رایگان سراسر ایران</p><p class="text-sm text-gray-600 mb-2">سطح C: بر اساس وزن</p><p class="text-xs text-gray-400">* سفارش بالای ۵ میلیون تومان برای همه سطوح ارسال رایگان است.</p></div>',
          }),
        ];
      case 'returns':
        return [
          b('hero', {
            headline: 'شرایط مرجوعی',
            body: 'راهنمای بازگشت کالا و ضمانت کیفیت',
            ctaLabel: '',
            ctaHref: '',
            imageUrl: '',
          }),
          b('faq', {
            headline: 'سیاست مرجوعی',
            body: '',
            items: [
              {
                question: 'شرایط پذیرش مرجوعی',
                answer:
                  'مرجوعی فقط در صورت عیب تولیدی یا ارسال کالای اشتباه پذیرفته می‌شود. مهلت اعلام: ۷ روز کاری پس از دریافت.',
              },
              {
                question: 'نحوه درخواست مرجوعی',
                answer:
                  'برای ثبت درخواست مرجوعی با پشتیبانی از طریق تلگرام @toliditaranom تماس بگیرید. تصویر عیب را ارسال کنید.',
              },
              {
                question: 'شرایط کالا',
                answer:
                  'کالا باید بدون استفاده، بدون تغییر و با برچسب‌های اصلی باشد. کالایی که استفاده شده یا دچار آسیب خریدار شده باشد پذیرفته نمی‌شود.',
              },
              {
                question: 'هزینه ارسال و استرداد',
                answer:
                  'در صورت عیب تولیدی، هزینه ارسال مرجوعی توسط ترنم پرداخت می‌شود. پس از تأیید، مبلغ در حساب اعتباری یا واریز بانکی ظرف ۵ روز کاری برگردانده می‌شود.',
              },
            ],
          }),
        ];
      case 'privacy':
        return [
          b('hero', {
            headline: 'حریم خصوصی',
            body: 'سیاست حفظ اطلاعات شخصی کاربران ترنم',
            ctaLabel: '',
            ctaHref: '',
            imageUrl: '',
          }),
          b('faq', {
            headline: '',
            body: '',
            items: [
              {
                question: 'جمع‌آوری اطلاعات',
                answer:
                  'اطلاعات شما صرفاً برای ارائه خدمات عمده‌فروشی جمع‌آوری می‌شود. این اطلاعات شامل نام، شماره تماس، آدرس و سابقه خرید است.',
              },
              {
                question: 'استفاده از اطلاعات',
                answer:
                  'اطلاعات شما برای پردازش سفارش، ارسال فاکتور، اعلان‌های کالای جدید و پشتیبانی مشتری استفاده می‌شود.',
              },
              {
                question: 'اشتراک‌گذاری',
                answer:
                  'اطلاعات شما به هیچ شخص ثالثی فروخته یا واگذار نمی‌شود. تنها برای خدمات ضروری مانند حمل‌ونقل به اطلاعات محدود دسترسی داده می‌شود.',
              },
              {
                question: 'امنیت',
                answer:
                  'داده‌های شما در سرورهای امن نگهداری می‌شوند. ارتباط با سایت از طریق پروتکل HTTPS رمزگذاری می‌شود.',
              },
            ],
          }),
        ];
      case 'terms':
        return [
          b('hero', {
            headline: 'قوانین و مقررات',
            body: 'شرایط استفاده از پلتفرم عمده‌فروشی ترنم',
            ctaLabel: '',
            ctaHref: '',
            imageUrl: '',
          }),
          b('faq', {
            headline: '',
            body: '',
            items: [
              {
                question: '۱. شرایط عضویت',
                answer:
                  'کلیه مشتریان برای استفاده از پنل عمده باید درخواست عضویت دهند. پس از بررسی توسط تیم فروش، حساب فعال می‌شود.',
              },
              {
                question: '۲. قیمت‌گذاری',
                answer:
                  'قیمت‌های نمایش‌داده‌شده در پنل مشتری به صورت اختصاصی برای هر مشتری محاسبه شده‌اند. انتشار یا اشتراک‌گذاری این قیمت‌ها ممنوع است.',
              },
              {
                question: '۳. ثبت سفارش',
                answer:
                  'ثبت سفارش در پنل به معنی درخواست اولیه است. سفارش پس از تأیید توسط تیم ترنم قطعی می‌شود.',
              },
              {
                question: '۴. پرداخت',
                answer:
                  'پرداخت باید طبق شرایط توافق‌شده انجام شود. فاکتور رسمی پس از تأیید سفارش صادر می‌گردد.',
              },
              {
                question: '۵. مرجوعی و ضمانت',
                answer:
                  'مرجوعی تنها در صورت عیب تولیدی و ظرف ۷ روز پس از دریافت پذیرفته می‌شود.',
              },
              {
                question: '۶. حریم خصوصی',
                answer:
                  'اطلاعات مشتریان نزد ترنم محرمانه است و به هیچ شخص ثالثی منتقل نمی‌شود.',
              },
            ],
          }),
        ];
      case 'products':
        return [
          b('text', {
            headline: 'کاتالوگ محصولات',
            body: 'تمام مدل‌های فعال عمده‌فروشی',
          }),
        ];
      default:
        return [];
    }
  }

  // Retail defaults (minimal but editable)
  switch (pageKey) {
    case 'chrome':
      return [
        b('chrome', {
          brandName: 'POSHAK TARANOM',
          brandTagline: 'فروشگاه تکی',
          logoUrl: '/logo-128.png',
          blurb: 'فروشگاه آنلاین پوشاک زنانه — مستقیم از تولیدی مشهد.',
          phoneLabel: '۰۹۱۵-۲۴۲-۴۶۲۴',
          phoneHref: 'tel:09152424624',
          copyright: `© ${new Date().getFullYear()} پوشاک ترنم — www.poshaktaranom.ir`,
          telegramHref: 'https://t.me/toliditaranom',
          instagramHref: 'https://instagram.com/tolidi.taranom',
          floatPhone: '09152424624',
          floatWhatsapp: '989152424624',
          floatTelegram: 'toliditaranom',
        }),
      ];
    case 'home':
      return [
        b('hero', {
          brandEyebrow: 'زیبایی در هارمونی با شما',
          headline: 'استایل شما، امضای ترنم',
          headlineAccent: 'ترنم',
          body: 'کالکشن جدید مانتو و شومیز زنانه — دوخت تولیدی، پارچه‌های لینن و کتان، ارسال سریع به سراسر ایران.',
          imageUrl: '/retail/hero-model.png',
          ctaLabel: 'مشاهده جدیدترین‌ها',
          ctaHref: '/retail/products',
          ctaSecondaryLabel: 'مشاهده مجموعه',
          ctaSecondaryHref: '/retail/collections',
        }),
        b('products', {
          headline: 'جدیدترین‌ها',
          body: '',
          limit: 4,
        }),
        b('stats', {
          items: [
            { value: 'ارسال سریع', label: 'پست پیشتاز، تیپاکس و ارسال تهران', sublabel: '' },
            { value: 'تعویض سایز', label: 'درخواست مرجوعی و تعویض از حساب کاربری', sublabel: '' },
            { value: 'پرداخت امن', label: 'زرین‌پال و پرداخت در محل (با شرایط)', sublabel: '' },
          ],
        }),
        b('faq', {
          headline: 'سوالات پرتکرار',
          body: 'قبل از خرید، این چند مورد را یک‌بار بخوانید.',
          items: [
            {
              question: 'سفارش تکی چقدر طول می‌کشد تا برسد؟',
              answer:
                'معمولاً بعد از ثبت سفارش، بسته‌بندی از مشهد انجام می‌شود و بسته به شهر و روش ارسال چند روز کاری زمان می‌برد.',
            },
            {
              question: 'اگر سایز مناسب نبود چه کار کنم؟',
              answer: 'از حساب کاربری درخواست تعویض سایز یا مرجوعی ثبت کنید.',
            },
            {
              question: 'پرداخت چطور انجام می‌شود؟',
              answer: 'پرداخت آنلاین از طریق زرین‌پال در دسترس است.',
            },
            {
              question: 'این همان تولیدی عمده است؟',
              answer:
                'بله. همان کارگاه ترنم؛ اینجا خرید تکی است و سایت poshaktaranom.com برای سفارش عمده است.',
            },
          ],
        }),
        b('cta', {
          eyebrow: '',
          headline: 'عمده‌فروش هستید؟',
          body: 'برای خرید عمده با حداقل سفارش و قیمت ویژه به سایت عمده سر بزنید.',
          ctaLabel: 'ورود به سایت عمده',
          ctaHref: 'https://poshaktaranom.com',
          ctaSecondaryLabel: '',
          ctaSecondaryHref: '',
          ctaTertiaryLabel: '',
          ctaTertiaryHref: '',
        }),
      ];
    case 'about':
      return defaultTextPage(
        'درباره پوشاک ترنم',
        'تولیدی پوشاک ترنم در مشهد؛ مانتوهای لینن و کتان را هم عمده و هم تکی عرضه می‌کند. این فروشگاه، کانال خرید مستقیم برای شماست — با همان کیفیت کارخانه.\n\nدفتر پخش: مشهد، میدان ۱۷ شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳. تماس: ۰۹۱۵۲۴۲۴۶۲۴',
      );
    case 'contact':
      return [
        b('contact', {
          headline: 'تماس با ما',
          channels: [
            { icon: 'Phone', title: 'تلفن', value: '۰۹۱۵۲۴۲۴۶۲۴', href: 'tel:09152424624' },
            {
              icon: 'Instagram',
              title: 'اینستاگرام',
              value: '@tolidi.taranom',
              href: 'https://www.instagram.com/tolidi.taranom',
            },
          ],
          hours: [],
          locations: [
            {
              title: 'دفتر پخش',
              address: 'مشهد، میدان ۱۷ شهریور، پاساژ کیمیا، طبقه منفی یک، پلاک ۱۳۳',
              note: '',
            },
          ],
        }),
      ];
    case 'shipping':
      return defaultTextPage(
        'ارسال سفارش',
        'بعد از ثبت سفارش، بسته‌تان از مشهد راه می‌افتد:\n\n• پست پیشتاز\n• تیپاکس\n• چاپار\n• پیک موتوری تهران',
      );
    case 'returns':
      return defaultTextPage(
        'مرجوعی و تعویض',
        'از حساب کاربری درخواست مرجوعی یا تعویض سایز ثبت کنید. شرایط دقیق را از پشتیبانی بپرسید.',
      );
    default:
      return defaultTextPage(pageKey, '');
  }
}

export const CMS_PAGE_KEYS_BASE = [
  { key: 'chrome', label: 'هدر / فوتر / شناور' },
  { key: 'home', label: 'صفحه اصلی' },
  { key: 'about', label: 'درباره ما' },
  { key: 'contact', label: 'تماس با ما' },
  { key: 'shipping', label: 'شرایط ارسال' },
  { key: 'returns', label: 'مرجوعی' },
  { key: 'products', label: 'محصولات' },
  { key: 'collections', label: 'کالکشن‌ها' },
  { key: 'privacy', label: 'حریم خصوصی' },
  { key: 'terms', label: 'شرایط و قوانین' },
] as const;

export const CMS_WHOLESALE_ONLY = { key: 'wholesale', label: 'شرایط عمده' } as const;
