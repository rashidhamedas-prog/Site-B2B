/**
 * Unit checks for blog analytics abuse controls (HIGH-4).
 * No Nest bootstrap / Jest — plain ts-node.
 * Run: npx ts-node --transpile-only src/modules/blog/blog-analytics-rate-limit.spec.ts
 */
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { BlogExtrasService } from './blog-extras.service';
import { extractClientIp } from '../../common/client-ip';
import type { RedisService } from '../redis/redis.module';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function clearMemoryHits() {
  (BlogExtrasService as unknown as { analyticsHits: Map<string, number[]> }).analyticsHits.clear();
}

type MockRedis = {
  ready: boolean;
  incrCalls: string[];
  nxCalls: string[];
  counts: Map<string, number>;
  nxKeys: Map<string, string>;
  isReady: boolean;
  incrWithTtl: (key: string, ttl: number) => Promise<number | null>;
  setNxEx: (key: string, ttl: number, value?: string) => Promise<boolean>;
};

function createMockRedis(ready = true): MockRedis {
  const state: MockRedis = {
    ready,
    incrCalls: [],
    nxCalls: [],
    counts: new Map(),
    nxKeys: new Map(),
    get isReady() {
      return state.ready;
    },
    async incrWithTtl(key: string) {
      state.incrCalls.push(key);
      if (!state.ready) return null;
      const n = (state.counts.get(key) || 0) + 1;
      state.counts.set(key, n);
      return n;
    },
    async setNxEx(key: string) {
      state.nxCalls.push(key);
      if (!state.ready) return false;
      if (state.nxKeys.has(key)) return false;
      state.nxKeys.set(key, '1');
      return true;
    },
  };
  return state;
}

function createService(redis: MockRedis, opts?: { published?: boolean }) {
  const published = opts?.published !== false;
  const postRepo = {
    findOne: async () => (published ? { id: 'ok' } : null),
  };
  const analyticsQueries: Array<{ sql: string; params: unknown[] }> = [];
  const analyticsRepo = {
    query: async (sql: string, params: unknown[]) => {
      analyticsQueries.push({ sql, params });
      return undefined;
    },
    findOne: async () => ({ articleId: 'a', pageViews: 1, uniqueViews: 1 }),
  };
  const noopRepo = {} as never;
  const storage = {} as never;
  const dataSource = {} as never;

  const svc = new BlogExtrasService(
    postRepo as never,
    noopRepo,
    noopRepo,
    noopRepo,
    analyticsRepo as never,
    noopRepo,
    noopRepo,
    storage,
    dataSource,
    redis as unknown as RedisService
  );
  return { svc, analyticsQueries, redis };
}

async function main() {
  // ── extractClientIp ─────────────────────────────────────────
  assert(extractClientIp({ ip: '203.0.113.10' }) === '203.0.113.10', 'extractClientIp uses req.ip');
  assert(extractClientIp({ ip: ' 10.0.0.1 ' }) === '10.0.0.1', 'extractClientIp trims');
  assert(extractClientIp({}) === '0.0.0.0', 'extractClientIp empty fallback');
  assert(extractClientIp(null) === '0.0.0.0', 'extractClientIp null fallback');

  // ── Redis incr path ─────────────────────────────────────────
  {
    clearMemoryHits();
    const redis = createMockRedis(true);
    const { svc } = createService(redis);
    await svc.assertAnalyticsRateLimit('1.2.3.4');
    assert(redis.incrCalls.length === 1, 'redis incr called once');
    assert(redis.incrCalls[0].startsWith('blog:analytics:rl:'), 'redis rl key prefix');
    assert(redis.counts.get(redis.incrCalls[0]) === 1, 'redis count starts at 1');
  }

  // ── 61st request → 429 ──────────────────────────────────────
  {
    clearMemoryHits();
    const redis = createMockRedis(true);
    const { svc } = createService(redis);
    for (let i = 0; i < 60; i++) {
      await svc.assertAnalyticsRateLimit('9.9.9.9');
    }
    let threw429 = false;
    try {
      await svc.assertAnalyticsRateLimit('9.9.9.9');
    } catch (err) {
      threw429 = err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS;
    }
    assert(threw429, '61st request throws HttpException 429');
    assert(redis.incrCalls.length === 61, 'redis counted all 61 attempts');
  }

  // ── Bounded memory fallback ─────────────────────────────────
  {
    clearMemoryHits();
    const redis = createMockRedis(false);
    const { svc } = createService(redis);
    const hits = (BlogExtrasService as unknown as { analyticsHits: Map<string, number[]> })
      .analyticsHits;
    for (let i = 0; i < 10_050; i++) {
      await svc.assertAnalyticsRateLimit(`10.0.${Math.floor(i / 256)}.${i % 256}`);
    }
    assert(hits.size <= 10_000, `memory map bounded (<=10000), got ${hits.size}`);
    assert(redis.incrCalls.length === 0, 'memory path does not call redis incr when not ready');
  }

  // ── Unique view once via setNxEx ────────────────────────────
  {
    clearMemoryHits();
    const redis = createMockRedis(true);
    const articleId = '550e8400-e29b-41d4-a716-446655440000';
    const { svc, analyticsQueries } = createService(redis);
    await svc.trackEvent(articleId, 'view', { ip: '8.8.8.8' });
    await svc.trackEvent(articleId, 'view', { ip: '8.8.8.8' });

    assert(redis.nxCalls.length === 2, 'setNxEx called twice for two views');
    assert(
      redis.nxCalls[0].includes(articleId) && redis.nxCalls[0].startsWith('blog:analytics:uv:'),
      'uv redis key shape'
    );
    const updates = analyticsQueries.filter((q) => /UPDATE\s+blog_analytics/i.test(q.sql));
    assert(updates.length === 2, 'two page view updates');
    assert(updates[0].params[1] === 1, 'first view increments uniqueViews');
    assert(updates[1].params[1] === 0, 'second view same IP does not increment uniqueViews');
  }

  // ── Invalid uuid / event rejected before side effects ───────
  {
    clearMemoryHits();
    const redis = createMockRedis(true);
    const { svc, analyticsQueries } = createService(redis);

    let badUuid = false;
    try {
      await svc.trackEvent('not-a-uuid', 'view', { ip: '1.1.1.1' });
    } catch (err) {
      badUuid = err instanceof BadRequestException;
    }
    assert(badUuid, 'invalid uuid → BadRequestException');
    assert(redis.incrCalls.length === 0, 'invalid uuid does not consume rate limit');
    assert(analyticsQueries.length === 0, 'invalid uuid does not touch analytics SQL');

    let badEvent = false;
    try {
      await svc.trackEvent('550e8400-e29b-41d4-a716-446655440000', 'hack', { ip: '1.1.1.1' });
    } catch (err) {
      badEvent = err instanceof BadRequestException;
    }
    assert(badEvent, 'invalid event → BadRequestException');
    assert(redis.incrCalls.length === 0, 'invalid event does not consume rate limit');
    assert(analyticsQueries.length === 0, 'invalid event does not touch analytics SQL');
  }

  console.log('blog-analytics-rate-limit.spec.ts: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
