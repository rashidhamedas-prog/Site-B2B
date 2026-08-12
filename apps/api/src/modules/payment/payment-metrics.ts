import { Injectable, Logger } from '@nestjs/common';

/**
 * Phase 8 — process-local counters (no Prometheus / heavy deps).
 * Reset on API restart; suitable for smoke + admin glance, not durable SLOs.
 *
 * Future: swap increments for OTel/Prometheus without changing call sites.
 */
export type PaymentMetricName =
  | 'payment_start_total'
  | 'payment_success_total'
  | 'payment_failure_total'
  | 'callback_duplicate_total';

const METRIC_NAMES: PaymentMetricName[] = [
  'payment_start_total',
  'payment_success_total',
  'payment_failure_total',
  'callback_duplicate_total',
];

/** Mask mobile/phone for logs — keep last 4 digits only. */
export function maskMobile(mobile?: string | null): string | undefined {
  if (mobile == null || mobile === '') return undefined;
  const digits = String(mobile).replace(/\D/g, '');
  if (!digits) return '***';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

@Injectable()
export class PaymentMetrics {
  private readonly logger = new Logger(PaymentMetrics.name);
  private readonly counts = new Map<PaymentMetricName, number>(
    METRIC_NAMES.map((n) => [n, 0]),
  );

  incr(name: PaymentMetricName, by = 1): void {
    const next = (this.counts.get(name) ?? 0) + by;
    this.counts.set(name, next);
    // Logger-based visibility for grepping without a metrics backend
    this.logger.debug(`metric ${name}=${next}`);
  }

  snapshot(): Record<PaymentMetricName, number> & { processUptimeSec: number } {
    const out = {} as Record<PaymentMetricName, number>;
    for (const n of METRIC_NAMES) {
      out[n] = this.counts.get(n) ?? 0;
    }
    return {
      ...out,
      processUptimeSec: Math.floor(process.uptime()),
    };
  }
}
