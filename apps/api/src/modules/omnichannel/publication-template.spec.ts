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

// --- post options ---
{
  const layout = defaultRetailLayout();
  const vars = { ...SAMPLE_WHOLESALE_VARS, name: 'مانتو <کیان> & co', images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg'] };
  const html = renderPublicationLayout(layout, vars, 'RETAIL');
  assert(html.parseMode === 'HTML', 'default parse mode is HTML');
  assert(html.text.includes('<b>مانتو &lt;کیان&gt; &amp; co</b>'), 'title bold + user text escaped');
  assert(!html.text.includes('<کیان>'), 'raw angle brackets never reach Telegram');
  assert(html.text.includes('<b>1/207/000</b>'), 'price bold in HTML');
  assert(html.mediaMode === 'album' && html.photoUrls.length === 3, 'album keeps up to maxPhotos');
  assert(html.buttons.length === 0 && html.silent === false && html.linkPreview === false, 'safe option defaults');

  const plain = renderPublicationLayout({ ...layout, options: { ...layout.options, parseMode: 'PLAIN' } }, vars, 'RETAIL');
  assert(!plain.text.includes('<b>') && plain.text.includes('مانتو <کیان> & co'), 'PLAIN mode leaves text untouched');

  const single = renderPublicationLayout({
    ...layout,
    options: {
      ...layout.options,
      mediaMode: 'single',
      silent: true,
      protectContent: true,
      buttons: [
        { label: 'مشاهده و خرید', url: '{url}' },
        { label: 'کانال', url: 'https://t.me/taranom' },
        { label: 'بد', url: 'https://evil.example/{sku}' },
        { label: 'ناامن', url: 'http://www.poshaktaranom.ir/x' },
      ],
    },
  }, vars, 'RETAIL');
  assert(single.photoUrls.length === 1, 'single media mode keeps one photo');
  assert(single.buttons.length === 2, 'buttons: token url + t.me kept, foreign/http dropped');
  assert(single.buttons[0].url === 'https://poshaktaranom.com/products/kian', 'button {url} substituted');
  assert(single.silent && single.protectContent, 'silent/protect pass through');

  const textOnly = renderPublicationLayout({ ...layout, options: { ...layout.options, mediaMode: 'text', linkPreview: true } }, vars, 'RETAIL');
  assert(textOnly.photoUrls.length === 0 && textOnly.linkPreview === true, 'text mode drops photos and may keep preview');

  const parsed = parseTemplateLayout(JSON.stringify({
    ...layout,
    options: { mediaMode: 'weird', parseMode: 'Markdown', buttons: [{ label: 'x'.repeat(80), url: 'https://t.me/a' }, { url: 'https://t.me/b' }], silent: 'yes' },
  }), 'RETAIL');
  assert(parsed.options.mediaMode === 'album' && parsed.options.parseMode === 'HTML', 'unknown option values fall back');
  assert(parsed.options.buttons.length === 1 && parsed.options.buttons[0].label.length === 40, 'button label capped, label-less dropped');
  assert(parsed.options.silent === false, 'non-boolean silent is false');

  const legacy = parseTemplateLayout('{name} — {price} تومان\n{url}', 'RETAIL');
  assert(legacy.options.parseMode === 'HTML', 'legacy upgrade renders as HTML default layout');
  const customRaw = parseTemplateLayout(
    'متن سفارشی {name} <b>x</b> {price} {url} و توضیح طولانی‌تر برای اینکه به‌عنوان قالب قدیمی پیش‌فرض شناخته نشود و همین‌طور بماند',
    'RETAIL',
  );
  assert(customRaw.options.parseMode === 'PLAIN', 'hand-written raw template stays PLAIN so its angle brackets are literal');
}

console.log('publication-template.spec.ts: ok');
