/**
 * npx ts-node --transpile-only src/modules/omnichannel/publication-template.spec.ts
 */
import {
  SAMPLE_WHOLESALE_VARS,
  defaultWholesaleLayout,
  formatChannelToman,
  parseTemplateLayout,
  publicProductPhotoUrl,
  renderPublicationLayout,
  sanitizePhotoUrls,
  sizesLine,
} from './publication-template';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(formatChannelToman(12_070_000) === '1/207/000', 'rial to slashed toman');
assert(sizesLine('FREE').includes('فری سایز'), 'free size line');

const rendered = renderPublicationLayout(defaultWholesaleLayout(), SAMPLE_WHOLESALE_VARS, 'WHOLESALE');
assert(rendered.text.includes('مانتو جلوباز کتان مدل کیان'), 'title');
assert(rendered.text.includes('کتان ۴۳۰ گرم کجراه'), 'fabric');
assert(rendered.text.includes('1/207/000'), 'price');
assert(rendered.text.includes('@Taranomrashid'), 'order handle');
assert(!rendered.text.includes('{name}'), 'tokens resolved');

const legacy = parseTemplateLayout('{name} — {price} تومان\n{url}', 'RETAIL');
assert(legacy.blocks[0].type === 'text', 'legacy string becomes a text block');

assert(publicProductPhotoUrl('RETAIL', '/uploads/a.jpg') === 'https://www.poshaktaranom.ir/uploads/a.jpg', 'relative upload');
assert(publicProductPhotoUrl('RETAIL', 'https://evil.example/a.jpg') === null, 'foreign host rejected');
assert(publicProductPhotoUrl('RETAIL', 'http://www.poshaktaranom.ir/uploads/a.jpg') === null, 'http rejected');
assert(sanitizePhotoUrls('RETAIL', ['/uploads/a.jpg', 'https://evil.example/b.jpg'], 5).length === 1, 'allowlist');
assert(sanitizePhotoUrls('RETAIL', ['/uploads/a.jpg'], 0).length === 0, 'photos off');

console.log('publication-template.spec.ts: ok');
