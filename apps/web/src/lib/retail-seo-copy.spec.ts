import assert from 'node:assert/strict';
import {
  looksWholesaleIntent,
  resolveRetailProductSeo,
  toRetailIntent,
} from './retail-seo-copy';

assert.equal(looksWholesaleIntent('خرید عمده کاپشن بامبری'), true);
assert.equal(looksWholesaleIntent('خرید کاپشن بامبری زنانه'), false);
assert.equal(toRetailIntent('خرید عمده کاپشن بامبری ضدآب'), 'خرید کاپشن بامبری ضدآب');
assert.equal(
  toRetailIntent('عمده فروشی کاپشن بامبری زنانه ضدآب | قیمت دست اول تولیدی'),
  'کاپشن بامبری زنانه ضدآب',
);

const bamber = resolveRetailProductSeo({
  slug: 'kapshan-bamber-65',
  name: 'کاپشن',
  seo: { title: 'عمده فروشی کاپشن بامبری زنانه ضدآب | قیمت دست اول تولیدی' },
});
assert.equal(bamber.title, 'خرید کاپشن بامبری زنانه');
assert.match(bamber.description, /بامبری/);
assert.equal(bamber.focusKeyword, 'کاپشن بامبری زنانه');

const alias = resolveRetailProductSeo({ slug: 'winter-wear00014', name: 'کاپشن' });
assert.equal(alias.title, bamber.title);

const coat = resolveRetailProductSeo({
  slug: 'some-coat',
  name: 'کت آلیس',
  seo: {
    title: 'خرید عمده کت زنانه',
    description: 'خرید عمده کت کتان با حاشیه سود مناسب بوتیک.',
    focusKeyword: 'خرید عمده کت زنانه',
  },
});
assert.equal(coat.title, 'خرید کت زنانه');
assert.equal(looksWholesaleIntent(coat.description), false);
assert.equal(coat.focusKeyword, 'خرید کت زنانه');

const clean = resolveRetailProductSeo({
  slug: 'shomiz-linen-sara',
  name: 'شومیز لینن سارا',
  seo: { retailTitle: 'خرید شومیز لینن مدل سارا زنانه', retailDescription: 'خرید تکی از مشهد.' },
});
assert.equal(clean.title, 'خرید شومیز لینن مدل سارا زنانه');

console.log('retail-seo-copy.spec.ts ok');
