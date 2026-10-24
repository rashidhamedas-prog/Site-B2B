import assert from 'node:assert/strict';
import {
  hasGa4PageViewSent,
  markGa4PageViewSent,
  resetGa4PageViewSentForTests,
} from './WebVitalsReporter';

resetGa4PageViewSentForTests();
assert.equal(hasGa4PageViewSent('G-F2V7VSJMLE'), false);
markGa4PageViewSent('G-F2V7VSJMLE');
assert.equal(hasGa4PageViewSent('G-F2V7VSJMLE'), true);
assert.equal(hasGa4PageViewSent('G-YVT5DXZF5Z'), false, 'other stream still gated');
markGa4PageViewSent('');
assert.equal(hasGa4PageViewSent(''), false, 'empty id ignored');
resetGa4PageViewSentForTests();
assert.equal(hasGa4PageViewSent('G-F2V7VSJMLE'), false);

console.log('web-vitals-gate.spec.ts ok');
