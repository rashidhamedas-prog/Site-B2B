/**
 * npx ts-node --transpile-only src/modules/product/catalog-price-import.spec.ts
 */
import {
  buildPriceImportTemplate,
  parsePriceImportBuffer,
  parseTomanCell,
  planPriceImportRows,
  summarizePricePlans,
  tomanToIrr,
  type PriceImportProduct,
} from './catalog-price-import';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(tomanToIrr(125000) === 1_250_000, 'toman to irr');
assert(parseTomanCell('').ok && (parseTomanCell('') as any).value === null, 'empty cell');
assert(parseTomanCell('۲۵۰٬۰۰۰').ok && (parseTomanCell('۲۵۰٬۰۰۰') as any).value === 250000, 'persian digits');
assert(!parseTomanCell('-1').ok, 'negative rejected');
assert(!parseTomanCell('12.5').ok, 'fraction rejected');

const products: PriceImportProduct[] = [
  {
    id: 'p1',
    sku: 'LINEN-1',
    name: 'مانتو',
    showOnWholesale: true,
    showOnRetail: true,
    wholesalePrice: 2_000_000,
    retailPrice: 3_000_000,
    wholesaleCompareAtPrice: null,
    retailCompareAtPrice: null,
  },
  {
    id: 'p2',
    sku: 'RETAIL-ONLY',
    name: 'فقط تکی',
    showOnWholesale: false,
    showOnRetail: true,
    wholesalePrice: 500_000,
    retailPrice: 900_000,
  },
];

const tpl = buildPriceImportTemplate(products);
assert(tpl.filename.includes('price-update'), 'template filename');
assert(tpl.buffer.includes(Buffer.from('قیمت‌ها', 'utf8')), 'price sheet name');
assert(tpl.buffer.includes(Buffer.from('راهنما', 'utf8')), 'guide sheet');

const rows = parsePriceImportBuffer(tpl.buffer);
assert(rows.length === 2, 'two data rows from template');
assert(rows[0]!.sku === 'LINEN-1', 'sku parsed');

// Mutate: only wholesale final for first product
const bySku = new Map(products.map((p) => [p.sku.toLowerCase(), p]));
const byId = new Map(products.map((p) => [p.id, p]));
const planned = planPriceImportRows(
  [
    {
      excelRow: 2,
      id: 'p1',
      sku: 'LINEN-1',
      nameHint: '',
      wholesaleFinalToman: 210000,
      wholesaleCompareToman: null,
      retailFinalToman: null,
      retailCompareToman: null,
      touchedWholesaleFinal: true,
      touchedWholesaleCompare: false,
      touchedRetailFinal: false,
      touchedRetailCompare: false,
    },
    {
      excelRow: 3,
      id: '',
      sku: 'MISSING',
      nameHint: '',
      wholesaleFinalToman: 1,
      wholesaleCompareToman: null,
      retailFinalToman: null,
      retailCompareToman: null,
      touchedWholesaleFinal: true,
      touchedWholesaleCompare: false,
      touchedRetailFinal: false,
      touchedRetailCompare: false,
    },
    {
      excelRow: 4,
      id: '',
      sku: 'LINEN-1',
      nameHint: '',
      wholesaleFinalToman: 200000,
      wholesaleCompareToman: null,
      retailFinalToman: null,
      retailCompareToman: null,
      touchedWholesaleFinal: true,
      touchedWholesaleCompare: false,
      touchedRetailFinal: false,
      touchedRetailCompare: false,
    },
  ],
  bySku,
  byId,
);

const summary = summarizePricePlans(planned);
assert(summary.changed === 1, 'one change');
assert(summary.errors === 2, 'missing + duplicate');
const change = planned.find((p) => p.kind === 'change');
assert(change?.kind === 'change', 'change plan');
if (change?.kind === 'change') {
  assert(change.after.wholesalePrice === 2_100_000, 'wholesale updated irr');
  assert(change.after.retailPrice === 3_000_000, 'retail untouched');
}

console.log('catalog-price-import.spec.ts OK');
