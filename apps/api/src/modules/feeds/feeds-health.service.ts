import { Injectable } from '@nestjs/common';
import { IntegrationHealthTracker } from '../../common/integration-health';

/**
 * Feed-generation health (Torob/Bam XML|CSV).
 * Instrumented via Fastify onResponse hook so TASK-006-claimed FeedsController stays untouched.
 *
 * Retry notes: feed GETs are read-only and idempotent — crawlers may retry freely.
 */
@Injectable()
export class FeedsHealthService {
  private readonly tracker = new IntegrationHealthTracker();

  recordSuccess(meta?: Record<string, unknown>) {
    this.tracker.recordSuccess(meta);
  }

  recordError(message: string, meta?: Record<string, unknown>) {
    this.tracker.recordError(message, meta);
  }

  health() {
    const snap = this.tracker.snapshot();
    const ok =
      snap.errorCount === 0 ||
      (snap.lastSuccessAt != null &&
        (snap.lastErrorAt == null || snap.lastSuccessAt >= snap.lastErrorAt));
    return {
      integration: 'feeds' as const,
      ok,
      ...snap,
      retry: {
        idempotent: true,
        notes:
          'GET /feeds/torob.xml|bam.csv|bam.xml are read-only catalog exports; safe to retry. No inventing private marketplace write APIs.',
      },
    };
  }
}
