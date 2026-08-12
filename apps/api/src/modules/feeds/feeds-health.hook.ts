import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { FeedsHealthService } from './feeds-health.service';

const FEED_PATH_RE = /\/v1\/feeds\/(torob\.xml|bam\.csv|bam\.xml)\/?$/i;

/**
 * Fastify onResponse hook — Nest Express middleware is a poor fit for this app's Fastify adapter.
 * Records lastSuccess/lastError without editing TASK-006-claimed FeedsController.
 */
@Injectable()
export class FeedsHealthHook implements OnModuleInit {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly health: FeedsHealthService,
  ) {}

  onModuleInit() {
    const instance = this.httpAdapterHost.httpAdapter?.getInstance?.();
    if (!instance || typeof instance.addHook !== 'function') {
      return;
    }

    instance.addHook('onResponse', async (req: { url?: string }, reply: { statusCode?: number }) => {
      const path = String(req.url || '').split('?')[0];
      if (!FEED_PATH_RE.test(path)) return;

      const statusCode = Number(reply.statusCode) || 0;
      const meta = { path, statusCode };
      if (statusCode >= 200 && statusCode < 400) {
        this.health.recordSuccess(meta);
      } else if (statusCode >= 400) {
        this.health.recordError(`HTTP ${statusCode}`, meta);
      }
    });
  }
}
