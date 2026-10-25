/**
 * npx tsx src/components/sales-partners/storyboard/carousel-index.spec.ts
 */
import assert from 'node:assert/strict';
import {
  closestSlideIndex,
  indexAfterJump,
  indexAfterStep,
  indexDuringScroll,
  indexOnScrollEnd,
} from './carousel-index.ts';

const count = 6;

// Five rapid «بعد» clicks start at 0 and land on the last slide.
// A measured index of 0 between clicks must not rewind the counter.
let nav = indexAfterStep(0, 0, count);
for (let step = 0; step < 5; step += 1) {
  assert.equal(indexDuringScroll(nav).index, nav.index);
  nav = indexAfterStep(nav.index, 1, count);
}
assert.deepEqual(nav, { index: 5, pending: 5 });
assert.equal(indexDuringScroll({ index: 5, pending: 5 }).index, 5);

// Dot 6 is index 5. A scroll sample that still sees slide 0 does not disable «قبل».
const jumped = indexAfterJump(5, count);
assert.deepEqual(jumped, { index: 5, pending: 5 });
assert.deepEqual(indexDuringScroll(jumped), jumped);
assert.deepEqual(indexOnScrollEnd(jumped, 0, count), { index: 5, pending: null });

// «قبل» on the first slide stays put. «بعد» on the last slide stays put.
assert.deepEqual(indexAfterStep(0, -1, count), { index: 0, pending: 0 });
assert.deepEqual(indexAfterStep(5, 1, count), { index: 5, pending: 5 });

// A swipe settles on the measured slide only when nothing programmatic is pending.
assert.deepEqual(indexOnScrollEnd({ index: 0, pending: null }, 3, count), { index: 3, pending: null });

// Reduced motion uses the same index math; only the scroll behavior differs.
assert.deepEqual(indexAfterJump(5, count), indexAfterJump(5, count));

assert.equal(closestSlideIndex([100, 280, 460], 270), 1);
assert.equal(closestSlideIndex([10], 10), 0);

console.log('carousel-index.spec.ts: ok');
