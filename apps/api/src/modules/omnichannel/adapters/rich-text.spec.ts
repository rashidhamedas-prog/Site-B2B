/**
 * npx ts-node --transpile-only src/modules/omnichannel/adapters/rich-text.spec.ts
 */
import {
  appendLinkLines,
  canonicalToBaleMarkdown,
  canonicalToPlain,
  canonicalToRubika,
  parseCanonicalSpans,
  unescapeCanonicalHtml,
} from './rich-text';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const caption = '🌿 <b>مانتو کیان</b>\n▫️ جنس: کتان &amp; ویسکوز\n💵 قیمت: <b>1/207/000</b> تومان\nhttps://poshaktaranom.com/products/kian_2';

// spans
const spans = parseCanonicalSpans(caption);
assert(spans.filter((s) => s.bold).length === 2, 'two bold spans');
assert(spans[1].text === 'مانتو کیان' && spans[1].bold, 'bold text unescaped');
assert(unescapeCanonicalHtml('a &lt;b&gt; &amp; c') === 'a <b> & c', 'entities');
assert(parseCanonicalSpans('<i>x</i><b>y</b>').map((s) => s.text).join('|') === 'x|y', 'unknown tag dropped, text kept');

// plain
const plain = canonicalToPlain(caption);
assert(!plain.includes('<b>') && plain.includes('کتان & ویسکوز'), 'plain strips tags and unescapes');

// Bale markdown: bold wrapped in stars with separators on both sides
const bale = canonicalToBaleMarkdown(caption);
assert(bale.includes('🌿 *مانتو کیان*\n'), 'title bold with space before and newline after');
assert(bale.includes('قیمت: *1/207/000* تومان'), 'price bold separated by spaces');
assert(bale.includes('kian‗2'), 'literal underscore neutralised');
assert(canonicalToBaleMarkdown('<b>x</b>y') === '*x* y', 'separator inserted after closing star');
assert(canonicalToBaleMarkdown('a<b>x</b>') === 'a *x*', 'separator inserted before opening star');
assert(canonicalToBaleMarkdown('2*3') === '2✱3', 'literal star neutralised');
assert(canonicalToBaleMarkdown('<b>  </b>z') === '  z', 'whitespace-only bold not starred');

// Rubika metadata: UTF-16 offsets (emoji = 2 units)
const rubika = canonicalToRubika('🌿 <b>مانتو</b> x');
assert(rubika.text === '🌿 مانتو x', 'rubika text is plain');
assert(rubika.parts.length === 1 && rubika.parts[0].type === 'Bold', 'one bold part');
assert(rubika.parts[0].from_index === 3 && rubika.parts[0].length === 5, `utf16 offsets 3/5 got ${rubika.parts[0].from_index}/${rubika.parts[0].length}`);
assert(rubika.text.slice(rubika.parts[0].from_index, rubika.parts[0].from_index + rubika.parts[0].length) === 'مانتو', 'slice round-trips');
const many = canonicalToRubika(Array.from({ length: 40 }, (_, i) => `<b>${i}</b> `).join(''));
assert(many.parts.length === 30, 'metadata capped at 30 parts');
assert(canonicalToRubika('a &amp; b').text === 'a & b' && canonicalToRubika('a &amp; b').parts.length === 0, 'entities unescaped before indexing');

// link lines
assert(appendLinkLines('x', []) === 'x', 'no buttons no change');
assert(appendLinkLines('x', [{ label: 'خرید', url: 'https://poshaktaranom.com/p' }]) === 'x\n\n🔗 خرید: https://poshaktaranom.com/p', 'link line appended');
assert(appendLinkLines('', [{ label: 'a', url: 'https://x' }]) === '🔗 a: https://x', 'no leading blank lines on empty text');

console.log('rich-text.spec.ts: ok');
