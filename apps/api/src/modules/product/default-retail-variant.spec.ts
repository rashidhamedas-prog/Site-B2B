import { selectDefaultRetailVariant } from './default-retail-variant';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const a = { id: 'aaa', retailStock: 0, createdAt: '2026-01-02T00:00:00.000Z' };
const b = { id: 'bbb', retailStock: 4, createdAt: '2026-01-01T00:00:00.000Z' };
const c = { id: 'ccc', retailStock: 0, createdAt: '2026-01-01T00:00:00.000Z' };

assert(selectDefaultRetailVariant([a, b, c], 'aaa')?.id === 'aaa', 'preferred exists');
assert(selectDefaultRetailVariant([a, b, c], 'missing')?.id === 'bbb', 'in stock');
assert(selectDefaultRetailVariant([a, c], null)?.id === 'ccc', 'first by createdAt then id');
assert(selectDefaultRetailVariant([], 'aaa') === null, 'empty');

console.log('default-retail-variant.spec ok');
