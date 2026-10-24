/**
 * npx ts-node --transpile-only src/modules/product/size-chart-variants.spec.ts
 */
import {
  orphanSizeVariants,
  sizeChartLabels,
  variantsOnSizeChart,
} from './size-chart-variants';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  JSON.stringify(sizeChartLabels({ sizeType: 'CUSTOM', sizeLabels: ['37', '38', '39', '40'] })) ===
    JSON.stringify(['37', '38', '39', '40']),
  'CUSTOM labels',
);

const mixed = [
  { id: 'a', size: '37' },
  { id: 'b', size: 'فری سایز' },
  { id: 'c', size: '40' },
  { id: 'd', size: '' },
];

const chart = { sizeType: 'CUSTOM', sizeLabels: ['37', '38', '39', '40'] };
const onChart = variantsOnSizeChart(mixed, chart);
assert(onChart.map((v) => v.id).join(',') === 'a,c,d', 'filter orphans + keep blank');
assert(
  orphanSizeVariants(mixed, chart).map((v) => v.id).join(',') === 'b',
  'orphan is free-size leftover',
);

assert(
  orphanSizeVariants(mixed, { sizeType: 'CUSTOM', sizeLabels: [] }).length === 0,
  'empty CUSTOM chart does not prune',
);
assert(
  variantsOnSizeChart(mixed, { sizeType: 'CUSTOM', sizeLabels: [] }).length === mixed.length,
  'empty CUSTOM chart does not filter',
);

assert(
  orphanSizeVariants(
    [{ id: 'x', size: 'فری سایز' }, { id: 'y', size: '37' }],
    { sizeType: 'FREE' },
  ).map((v) => v.id).join(',') === 'y',
  'FREE chart orphans numeric sizes',
);

console.log('size-chart-variants.spec.ts OK');
