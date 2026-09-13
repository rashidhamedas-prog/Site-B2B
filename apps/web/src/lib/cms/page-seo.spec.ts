/**
 * npx ts-node --transpile-only --compiler-options "{\"module\":\"commonjs\",\"moduleResolution\":\"node\"}" src/lib/cms/page-seo.spec.ts
 */
import {
  cmsPagePublicPath,
  cmsPageSeoForSave,
  defaultCanonical,
  metadataFromCmsSeo,
  normalizeCmsPageSeo,
} from './page-seo.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const seo = normalizeCmsPageSeo({
    title: ' <b>ارسال</b> ',
    description: 'شرح',
    ogImage: 'javascript:alert(1)',
    ogAlt: 'آلت',
    canonical: 'https://www.poshaktaranom.ir/shipping',
    robots: 'noindex',
    extra: 'drop',
  });
  assert(seo.title === 'ارسال', 'strip tags from title');
  assert(seo.ogImage === '', 'reject javascript url');
  assert(seo.robots === 'noindex', 'noindex kept');
  assert(seo.canonical.includes('/shipping'), 'canonical kept');
}

{
  const saved = cmsPageSeoForSave(normalizeCmsPageSeo({ title: 'خانه' }));
  assert(saved.title === 'خانه', 'persist title');
  assert(saved.robots === 'index', 'default index persisted');
}

{
  assert(cmsPagePublicPath('RETAIL', 'privacy') === '/privacy', 'retail public privacy');
  assert(cmsPagePublicPath('WHOLESALE', 'terms') === '/terms', 'wholesale terms');
  assert(defaultCanonical('RETAIL', 'about').endsWith('/about'), 'retail about canonical');
}

{
  const meta = metadataFromCmsSeo(
    normalizeCmsPageSeo({ title: 'سئو صفحه', robots: 'noindex' }),
    { title: 'fallback', description: 'شرح پیش‌فرض' },
    'RETAIL',
    'terms',
  );
  assert(meta.title === 'سئو صفحه', 'page title wins');
  assert((meta.robots as { index?: boolean }).index === false, 'noindex applied');
}

console.log('page-seo.spec.ts: ok');
