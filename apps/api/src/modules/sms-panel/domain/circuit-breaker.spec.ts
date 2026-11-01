import * as assert from 'node:assert/strict';
import { CircuitBreaker } from './circuit-breaker';

let t = 1_000_000;
const now = () => t;

// closed: failures below threshold keep it closed; success resets the count
const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 60_000, now });
assert.equal(cb.getState(), 'CLOSED');
assert.equal(cb.recordFailure(), false);
assert.equal(cb.recordFailure(), false);
cb.recordSuccess();
assert.equal(cb.recordFailure(), false);
assert.equal(cb.recordFailure(), false);
assert.equal(cb.allowRequest(), true);

// third consecutive failure opens it and blocks sends until cooldown
assert.equal(cb.recordFailure(), true);
assert.equal(cb.getState(), 'OPEN');
assert.equal(cb.allowRequest(), false);
assert.equal(cb.retryAt().getTime(), t + 60_000);
t += 59_999;
assert.equal(cb.allowRequest(), false);

// after cooldown: half-open allows exactly one probe
t += 1;
assert.equal(cb.getState(), 'HALF_OPEN');
assert.equal(cb.allowRequest(), true);
assert.equal(cb.allowRequest(), false);

// failed probe reopens for a full cooldown
assert.equal(cb.recordFailure(), true);
assert.equal(cb.getState(), 'OPEN');
assert.equal(cb.allowRequest(), false);
t += 60_000;
assert.equal(cb.allowRequest(), true);

// successful probe closes it
cb.recordSuccess();
assert.equal(cb.getState(), 'CLOSED');
assert.equal(cb.allowRequest(), true);
assert.equal(cb.allowRequest(), true);

// failures while already open do not extend the cooldown
const cb2 = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 10_000, now });
assert.equal(cb2.recordFailure(), true);
const openUntil = cb2.retryAt().getTime();
t += 5_000;
assert.equal(cb2.recordFailure(), false);
assert.equal(cb2.retryAt().getTime(), openUntil);

// options are clamped to sane minimums
const cb3 = new CircuitBreaker({ failureThreshold: 0, cooldownMs: 0, now });
assert.equal(cb3.recordFailure(), true);
assert.equal(cb3.retryAt().getTime(), t + 1_000);

console.log('circuit-breaker.spec OK');
