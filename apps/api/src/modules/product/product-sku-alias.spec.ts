/**
 * npx ts-node --transpile-only src/modules/product/product-sku-alias.spec.ts
 */
import { planSkuChange, skuIsOccupied } from './product-sku-alias';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  assert(planSkuChange('COATS00012', 'COATS00012') === null, 'same sku: no plan');
  const plan = planSkuChange('COATS00012', '7126');
  assert(plan?.newSku === '7126', 'new sku is ERP code');
  assert(plan?.aliasOld === 'COATS00012', 'old marketing sku becomes alias');

  const occupied = ['7126', 'COATS00001', 'coats00012'];
  assert(skuIsOccupied('7126', occupied), 'ERP code already used');
  assert(
    skuIsOccupied('COATS00012', occupied, ['COATS00012']) === false,
    'own current sku is free for alias keep',
  );
  assert(skuIsOccupied('COATS00099', occupied) === false, 'unused sku free');
  console.log('product-sku-alias.spec.ts: ok');
}

main();
