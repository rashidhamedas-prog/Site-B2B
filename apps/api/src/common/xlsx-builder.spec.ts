/**
 * npx ts-node --transpile-only src/common/xlsx-builder.spec.ts
 */
import { buildXlsx, contentDispositionUtf8 } from './xlsx-builder';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const buf = buildXlsx([
  {
    name: 'محصولات',
    headers: ['SKU', 'نام', 'قیمت'],
    rows: [
      ['LIN-1', 'مانتو لینن', 450000],
      ['A&B <test>', 'کتی «گل»', null],
    ],
  },
  {
    name: 'واریانت‌ها',
    headers: ['SKU', 'رنگ'],
    rows: [['LIN-1', 'سفید']],
  },
]);

assert(buf.length > 100, 'xlsx has bytes');
assert(buf.readUInt32LE(0) === 0x04034b50, 'zip local header');
assert(buf.includes(Buffer.from('xl/workbook.xml')), 'workbook path present');
assert(buf.includes(Buffer.from('محصولات', 'utf8')), 'persian sheet name stored');
assert(buf.includes(Buffer.from('A&amp;B', 'utf8')), 'xml special chars escaped');
assert(buf.includes(Buffer.from('t="inlineStr"', 'utf8')), 'strings as inlineStr');
assert(buf.includes(Buffer.from('<v>450000</v>', 'utf8')), 'numbers stay numeric');
assert(buf.includes(Buffer.from('rightToLeft="1"', 'utf8')), 'rtl sheet');

const cd = contentDispositionUtf8('محصولات-عمده.xlsx');
assert(cd.startsWith('attachment;'), 'disposition attachment');
assert(cd.includes("filename*=UTF-8''"), 'rfc5987 filename');
assert(!cd.includes('filename="محصولات'), 'ascii filename fallback');

console.log('xlsx-builder.spec.ts OK');
