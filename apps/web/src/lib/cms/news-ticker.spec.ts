import { defaultTickerItems, isStorefrontHomePath, resolveTickerItems } from './news-ticker';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(defaultTickerItems('WHOLESALE').length >= 3, 'wholesale defaults');
assert(defaultTickerItems('RETAIL').some((item) => item.includes('خرید تکی')), 'retail singles claim');
assert(!defaultTickerItems('RETAIL').some((item) => item.includes('۶ عدد')), 'retail ticker has no MOQ');

assert(
  resolveTickerItems({ enabled: true, text: '', phoneLabel: '', phoneHref: '', telegramLabel: '', telegramHref: '', tickerItems: ['خبر یک', 'خبر دو'] }, 'RETAIL').length === 2,
  'CMS tickerItems win',
);

assert(
  resolveTickerItems(
    {
      enabled: true,
      text: 'ارسال به سراسر ایران — حداقل سفارش هر مدل از ۶ عدد',
      phoneLabel: '',
      phoneHref: '',
      telegramLabel: '',
      telegramHref: '',
    },
    'WHOLESALE',
  ).length >= 2,
  'splits announcement text',
);

assert(resolveTickerItems({ enabled: false, text: 'x', phoneLabel: '', phoneHref: '', telegramLabel: '', telegramHref: '' }, 'RETAIL').length === 0, 'disabled hides ticker');

assert(isStorefrontHomePath('/'), 'root is home');
assert(isStorefrontHomePath('/retail'), 'retail app home');
assert(!isStorefrontHomePath('/products'), 'catalog is not home');

console.log('news-ticker.spec.ts: OK');
