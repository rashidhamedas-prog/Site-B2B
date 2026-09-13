/**
 * npx ts-node --transpile-only src/lib/product-image-alt.spec.ts
 */
import assert from 'node:assert/strict';
import {
  sanitizeProductImageAlt,
  normalizeProductImageAlts,
  suggestProductImageAlt,
  resolveProductImageAlt,
  jsonLdImageObjects,
} from './product-image-alt.ts';

assert.equal(sanitizeProductImageAlt('  مانتو <b>لینن</b>  '), 'مانتو لینن');
assert.equal(sanitizeProductImageAlt('javascript:alert(1)'), 'javascript:alert(1)');
assert.ok(sanitizeProductImageAlt('الف'.repeat(200)).length === 160);

assert.deepEqual(
  normalizeProductImageAlts({
    '/media/a.jpg': 'مانتو لینن سارا از روبرو',
    'javascript:x': 'بد',
    '/media/b.jpg': '<em>پشت</em>',
  }),
  {
    '/media/a.jpg': 'مانتو لینن سارا از روبرو',
    '/media/b.jpg': 'پشت',
  },
);

assert.deepEqual(
  normalizeProductImageAlts({ '/media/a.jpg': 'ok', '/media/gone.jpg': 'drop' }, ['/media/a.jpg']),
  { '/media/a.jpg': 'ok' },
);

assert.equal(
  suggestProductImageAlt({ name: 'شومیز لینن سارا', index: 0 }),
  'شومیز لینن سارا از روبرو',
);
assert.equal(
  suggestProductImageAlt({ name: 'شومیز لینن سارا', color: 'کرم', fabric: 'لینن' }),
  'شومیز لینن سارا — رنگ کرم — لینن',
);
assert.equal(
  suggestProductImageAlt({ name: 'کت اریکا', role: 'fabric', fabric: 'لینن' }),
  'بافت لینن کت اریکا',
);

assert.equal(
  resolveProductImageAlt({ '/p.jpg': 'آلت ذخیره‌شده' }, '/p.jpg', { name: 'fallback' }),
  'آلت ذخیره‌شده',
);
assert.equal(
  resolveProductImageAlt({}, '/p.jpg', { name: 'مانتو بهار', index: 0 }),
  'مانتو بهار از روبرو',
);

const ld = jsonLdImageObjects(
  ['/media/a.jpg'],
  { '/media/a.jpg': 'مانتو از روبرو' },
  { name: 'مانتو' },
  (u) => `https://poshaktaranom.ir${u}`,
);
assert.equal(ld[0]?.['@type'], 'ImageObject');
assert.equal(ld[0]?.name, 'مانتو از روبرو');
assert.equal(ld[0]?.url, 'https://poshaktaranom.ir/media/a.jpg');

console.log('product-image-alt.spec.ts ok');
