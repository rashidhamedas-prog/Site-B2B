/**
 * npx ts-node --transpile-only src/common/xlsx-reader.spec.ts
 */
import { buildXlsx } from './xlsx-builder';
import { findSheet, parseXlsx } from './xlsx-reader';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const buf = buildXlsx([
  {
    name: 'قیمت‌ها',
    headers: ['SKU', 'قیمت نهایی عمده (تومان)'],
    rows: [
      ['LIN-1', 250000],
      ['LIN-2', 320000],
    ],
  },
  {
    name: 'راهنما',
    headers: ['موضوع', 'مقدار'],
    rows: [['واحد', 'تومان']],
  },
]);

const sheets = parseXlsx(buf);
assert(sheets.length === 2, 'two sheets');
const price = findSheet(sheets, ['قیمت‌ها']);
assert(!!price, 'price sheet found');
assert(price!.rows[0]?.[0] === 'SKU', 'header sku');
assert(price!.rows[1]?.[0] === 'LIN-1', 'first sku');
assert(price!.rows[1]?.[1] === '250000', 'numeric cell as string');
assert(price!.rows[2]?.[0] === 'LIN-2', 'second sku');

console.log('xlsx-reader.spec.ts OK');
