/**
 * npx ts-node --transpile-only src/modules/cms/cms-page-seo.spec.ts
 */
import { sanitizeCmsPageSeo } from './cms-page-seo';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const clean = sanitizeCmsPageSeo({
    title: '<script>x</script>حریم خصوصی',
    description: 'شرح',
    ogImage: 'javascript:alert(1)',
    ogAlt: 'آلت بنر',
    canonical: '/privacy',
    robots: 'noindex',
    evil: '<img src=x onerror=alert(1)>',
  });
  assert(!!clean, 'object returned');
  assert(clean!.title === 'حریم خصوصی', 'tags stripped');
  assert(clean!.ogImage === undefined, 'script url dropped');
  assert(clean!.canonical === '/privacy', 'relative path kept');
  assert(clean!.robots === 'noindex', 'robots kept');
  assert(!('evil' in clean!), 'unknown key dropped');
}

{
  assert(sanitizeCmsPageSeo(null) === null, 'null');
  assert(sanitizeCmsPageSeo([]) === null, 'array');
  assert(sanitizeCmsPageSeo({}) === null, 'empty object');
}

console.log('cms-page-seo.spec.ts: ok');
