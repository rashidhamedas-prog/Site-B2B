import { BUSINESS_FACTS } from '@/lib/business-facts';
import { newBlockId, type ContentBlock, type BlockType } from './types';

// Kept apart from `defaults.ts` so client chrome hooks do not bundle every page's default blocks.

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const faDigits = (input: number) => String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]!);

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
      text: 'ارسال به سراسر ایران — حداقل سفارش در محصول از ۶ عدد به بالا می‌باشد.',
      tickerItems: [
        'ارسال به سراسر ایران از دفتر پخش مشهد',
        'حداقل سفارش هر مدل از ۶ عدد',
        `تولیدی لینن و کتان از سال ${faDigits(BUSINESS_FACTS.foundedSolarYear)}`,
        'تماس فروش: ۰۹۱۵-۲۴۲-۴۶۲۴',
      ],
    }),
    b('chrome', {
      brandName: 'پوشاک ترنم',
      brandTagline: 'تولیدی مانتو زنانه مشهد',
      logoUrl: '/logo-128.png',
      registerLabel: 'درخواست همکاری',
      registerHref: '/portal/register',
      portalHref: '/portal',
      blurb: `از سال ${faDigits(BUSINESS_FACTS.foundedSolarYear)} تولیدکننده مانتو شومیزی زنانه لینن و کتان در مشهد. فروش عمده به بوتیک‌ها و فروشندگان در سراسر ایران.`,
      footerQuickTitle: 'دسترسی سریع',
      footerLegalTitle: 'اطلاعات حقوقی',
      footerContactTitle: 'اطلاعات تماس',
      phoneLabel: '۰۹۱۵-۲۴۲-۴۶۲۴',
      phoneHref: 'tel:09152424624',
      ownerLabel: 'حامد رشید — مدیر فروش',
      addressTitle: 'دفتر پخش:',
      addressLines: ['مشهد — میدان ۱۷ شهریور', 'پاساژ کیمیا — طبقه منفی ۱ — پلاک ۱۳۳'],
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

export function defaultRetailChrome(): ContentBlock[] {
  return [
    b('announcement', {
      enabled: true,
      text: 'خرید تکی از همان کارگاه مشهد — ارسال از تولیدی، تعویض سایز از حساب کاربری',
      tickerItems: [
        'خرید تکی از همان کارگاه مشهد',
        'ارسال از تولیدی — تعویض سایز از حساب کاربری',
        'شومیز، کت، کاپشن و کفتان',
        'پرداخت امن زرین‌پال',
      ],
    }),
    b('chrome', {
      brandName: 'POSHAK TARANOM',
      brandTagline: 'فروشگاه تکی',
      logoUrl: '/logo-128.png',
      blurb: 'پوشاک ترنم در مشهد؛ خرید تکی از همان کارگاهی که برای بوتیک‌ها هم می‌دوزد.',
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
}
