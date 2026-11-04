import * as assert from 'node:assert/strict';
import { DEFAULT_SHIPPING_ENGINE_SETTINGS, roundFeeIrr } from './shipping.contract';

assert.equal(roundFeeIrr(1_234_567, 100), 1_235_000);
assert.equal(roundFeeIrr(1_234_567, 1000), 1_230_000);
assert.equal(roundFeeIrr(1_235_000, 1000), 1_240_000);
assert.equal(roundFeeIrr(0, 1000), 0);
assert.equal(roundFeeIrr(-5, 1000), 0);
assert.equal(roundFeeIrr(1_234_567.6, 0), 1_234_568);
assert.equal(DEFAULT_SHIPPING_ENGINE_SETTINGS.defaultPieceGrams, 450);
assert.equal(DEFAULT_SHIPPING_ENGINE_SETTINGS.roundingToman, 1000);

console.log('shipping.contract.spec OK');
