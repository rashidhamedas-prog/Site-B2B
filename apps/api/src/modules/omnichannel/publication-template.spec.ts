/**
 * npx ts-node --transpile-only src/modules/omnichannel/publication-template.spec.ts
 */
import {
  SAMPLE_WHOLESALE_VARS,
  defaultRetailLayout,
  defaultWholesaleLayout,
  formatChannelToman,
  extractProductLookupKey,
  imageCandidates,
  isLegacyProductTemplate,
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

assert(isLegacyProductTemplate('{name} — {price} تومان\n{url}'), 'old admin default is legacy');
const upgraded = parseTemplateLayout('{name} — {price} تومان\n{url}', 'RETAIL');
assert(upgraded.blocks.some((row) => row.type === 'photos'), 'legacy retail upgrades to channel layout');
assert(upgraded.blocks.some((row) => row.type === 'title'), 'legacy retail has a title block');
const custom = parseTemplateLayout(JSON.stringify(defaultRetailLayout()), 'RETAIL');
assert(!isLegacyProductTemplate(JSON.stringify(defaultRetailLayout())), 'structured layout is kept');
assert(custom.blocks.filter((row) => row.type === 'field').length >= 3, 'saved structured layout wins');

assert(
  extractProductLookupKey('https://www.poshaktaranom.ir/products/coats00011') === 'coats00011',
  'product url becomes slug',
);
assert(extractProductLookupKey(' coats00011 ') === 'coats00011', 'sku/slug trimmed');
assert(imageCandidates(['/media/a.jpg', { url: '/media/b.jpg' }]).length === 2, 'string and object images');
assert(
  isLegacyProductTemplate(JSON.stringify({ v: 1, blocks: [{ id: 'legacy', type: 'text', enabled: true, text: '{name} — {price} تومان\n{url}' }] })),
  'one-block wrap of old template is legacy',
);

assert(publicProductPhotoUrl('RETAIL', '/uploads/a.jpg') === 'https://www.poshaktaranom.ir/uploads/a.jpg', 'relative upload');
assert(publicProductPhotoUrl('RETAIL', 'https://evil.example/a.jpg') === null, 'foreign host rejected');
assert(publicProductPhotoUrl('RETAIL', 'http://www.poshaktaranom.ir/uploads/a.jpg') === null, 'http rejected');
assert(sanitizePhotoUrls('RETAIL', ['/uploads/a.jpg', 'https://evil.example/b.jpg'], 5).length === 1, 'allowlist');
assert(sanitizePhotoUrls('RETAIL', ['/uploads/a.jpg'], 0).length === 0, 'photos off');

console.log('publication-template.spec.ts: ok');
