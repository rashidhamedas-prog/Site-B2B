import assert from 'node:assert/strict';
import { wholesaleColorSelectPrompt } from './wholesale-color-prompt';

const empty = wholesaleColorSelectPrompt(3, 0);
assert.equal(empty.tone, 'need');
assert.equal(empty.title, 'رنگ‌های موردنظرتان را انتخاب کنید');
assert.match(empty.body, /حداقل ۳ رنگ/);
assert.match(empty.body, /رنگ‌های انتخابی/);

const partial = wholesaleColorSelectPrompt(3, 1);
assert.equal(partial.tone, 'need');
assert.match(partial.body, /۱ رنگ انتخاب شده/);
assert.match(partial.body, /۲ رنگ دیگر/);

const ready = wholesaleColorSelectPrompt(3, 3);
assert.equal(ready.tone, 'ready');
assert.equal(ready.title, 'رنگ‌های پک آماده است');
assert.match(ready.body, /۳ رنگ انتخاب شد/);

const overMin = wholesaleColorSelectPrompt(2, 5);
assert.equal(overMin.tone, 'ready');

console.log('wholesale-color-prompt.spec.ts: ok');
