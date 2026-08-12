/**
 * In-process integration health counters for marketplace/affiliate probes.
 * Process-local (resets on restart) — enough for ops dashboards, not durable audit.
 */
export type IntegrationHealthSnapshot = {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  successCount: number;
  errorCount: number;
  lastMeta: Record<string, unknown> | null;
};

export class IntegrationHealthTracker {
  private lastSuccessAt: Date | null = null;
  private lastErrorAt: Date | null = null;
  private lastError: string | null = null;
  private successCount = 0;
  private errorCount = 0;
  private lastMeta: Record<string, unknown> | null = null;

  recordSuccess(meta?: Record<string, unknown>) {
    this.lastSuccessAt = new Date();
    this.successCount += 1;
    if (meta) this.lastMeta = meta;
  }

  recordError(message: string, meta?: Record<string, unknown>) {
    this.lastErrorAt = new Date();
    this.lastError = String(message || 'unknown').slice(0, 500);
    this.errorCount += 1;
    if (meta) this.lastMeta = meta;
  }

  snapshot(): IntegrationHealthSnapshot {
    return {
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastErrorAt: this.lastErrorAt?.toISOString() ?? null,
      lastError: this.lastError,
      successCount: this.successCount,
      errorCount: this.errorCount,
      lastMeta: this.lastMeta,
    };
  }
}
