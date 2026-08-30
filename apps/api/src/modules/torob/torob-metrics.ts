type CounterKey = 'requests' | 'status400' | 'status401' | 'status500' | 'success';

export interface TorobProductMetricsSnapshot {
  requests: number;
  status400: number;
  status401: number;
  status500: number;
  success: number;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastLatencyMs: number | null;
  publishedCount: number | null;
  skippedCount: number | null;
  lastParityMismatch: number;
}

class TorobProductMetrics {
  private counts: Record<CounterKey, number> = {
    requests: 0,
    status400: 0,
    status401: 0,
    status500: 0,
    success: 0,
  };
  private lastSuccessAt: string | null = null;
  private lastErrorAt: string | null = null;
  private lastLatencyMs: number | null = null;
  private publishedCount: number | null = null;
  private skippedCount: number | null = null;
  private lastParityMismatch = 0;

  recordRequest() {
    this.counts.requests += 1;
  }

  recordStatus(status: number, latencyMs: number) {
    this.lastLatencyMs = latencyMs;
    if (status === 400) this.counts.status400 += 1;
    if (status === 401) this.counts.status401 += 1;
    if (status >= 500) {
      this.counts.status500 += 1;
      this.lastErrorAt = new Date().toISOString();
    }
    if (status === 200) {
      this.counts.success += 1;
      this.lastSuccessAt = new Date().toISOString();
    }
  }

  recordCatalog(published: number, skipped: number) {
    this.publishedCount = published;
    this.skippedCount = skipped;
  }

  recordParity(mismatch: number) {
    this.lastParityMismatch = mismatch;
  }

  snapshot(): TorobProductMetricsSnapshot {
    return {
      ...this.counts,
      lastSuccessAt: this.lastSuccessAt,
      lastErrorAt: this.lastErrorAt,
      lastLatencyMs: this.lastLatencyMs,
      publishedCount: this.publishedCount,
      skippedCount: this.skippedCount,
      lastParityMismatch: this.lastParityMismatch,
    };
  }
}

export const torobProductMetrics = new TorobProductMetrics();
