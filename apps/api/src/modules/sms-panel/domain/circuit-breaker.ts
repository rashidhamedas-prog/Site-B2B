/**
 * Provider circuit breaker. After `failureThreshold` consecutive transport
 * failures the circuit opens and dispatch is deferred for `cooldownMs`; then a
 * single half-open probe decides whether to close or reopen.
 * State is per process, like the outbound token bucket.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export const SMS_CIRCUIT_FAILURE_THRESHOLD = 5;
export const SMS_CIRCUIT_COOLDOWN_MS = 60_000;

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  now?: () => number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private openedAt = 0;
  private probeInFlight = false;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(opts?: CircuitBreakerOptions) {
    this.threshold = Math.max(1, Math.floor(opts?.failureThreshold ?? SMS_CIRCUIT_FAILURE_THRESHOLD));
    this.cooldownMs = Math.max(1_000, Math.floor(opts?.cooldownMs ?? SMS_CIRCUIT_COOLDOWN_MS));
    this.now = opts?.now ?? Date.now;
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && this.now() - this.openedAt >= this.cooldownMs) {
      this.state = 'HALF_OPEN';
      this.probeInFlight = false;
    }
    return this.state;
  }

  /** True when a send may go to the provider now. In HALF_OPEN only one probe is allowed. */
  allowRequest(): boolean {
    const state = this.getState();
    if (state === 'CLOSED') return true;
    if (state === 'HALF_OPEN' && !this.probeInFlight) {
      this.probeInFlight = true;
      return true;
    }
    return false;
  }

  /** When the next send may be attempted (for deferring queued rows). */
  retryAt(): Date {
    if (this.state === 'OPEN') return new Date(this.openedAt + this.cooldownMs);
    return new Date(this.now() + 1_000);
  }

  recordSuccess(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.probeInFlight = false;
  }

  /** Returns true when this failure opened (or reopened) the circuit. */
  recordFailure(): boolean {
    const state = this.getState();
    this.probeInFlight = false;
    if (state === 'HALF_OPEN') {
      this.open();
      return true;
    }
    if (state === 'OPEN') return false;
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.open();
      return true;
    }
    return false;
  }

  private open(): void {
    this.state = 'OPEN';
    this.openedAt = this.now();
    this.failures = 0;
  }
}
