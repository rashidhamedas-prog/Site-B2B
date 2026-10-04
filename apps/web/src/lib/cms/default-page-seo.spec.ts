/**
 * npx ts-node --transpile-only --compiler-options "{\"module\":\"commonjs\",\"moduleResolution\":\"node\"}" src/lib/cms/default-page-seo.spec.ts
 */
import { getDefaultPageSeo, getDefaultPageTitle } from './default-page-seo.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const seo = getDefaultPageSeo('RETAIL', 'salesPartnership');
  assert(seo.title.includes('همکار بازاریاب'), 'title');
  assert(seo.description.includes('بدون انبار'), 'description honesty');
  assert(!/\d+\s*%/.test(seo.description), 'no commission percent');
  assert(seo.canonical === 'https://www.poshaktaranom.ir/sales-partnership', 'canonical retail');
  assert(seo.ogImage.includes('/sales-partner/hero-banner.webp'), 'og plate');
  assert(seo.robots === 'index', 'indexable');
  assert(getDefaultPageTitle('RETAIL', 'salesPartnership', 'x') === 'همکار بازاریاب پوشاک ترنم', 'title field');
}

{
  const empty = getDefaultPageSeo('WHOLESALE', 'salesPartnership');
  assert(!empty.title && !empty.canonical, 'no wholesale salesPartnership seo');
  const home = getDefaultPageSeo('RETAIL', 'home');
  assert(!home.title, 'home uses empty default seo');
  const referral = getDefaultPageSeo('WHOLESALE', 'hamkarMoarefi');
  assert(referral.canonical === 'https://poshaktaranom.com/hamkar-moarefi', 'referral canonical');
  assert(!/\d+\s*%/.test(referral.description), 'no invented percent');
  assert(getDefaultPageTitle('WHOLESALE', 'hamkarMoarefi', 'x') === 'همکار معرفی بوتیک', 'referral title');
}

console.log('default-page-seo.spec.ts: ok');
