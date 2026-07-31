import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash, randomInt, timingSafeEqual } from 'crypto';

export type OtpRecord = {
  hash: string;
  attempts: number;
  name?: string;
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get('REDIS_HOST', 'localhost');
    const port = Number(this.config.get('REDIS_PORT', 6379));
    const password = this.config.get<string>('REDIS_PASS') || undefined;
    try {
      this.client = new Redis({
        host,
        port,
        password,
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      this.client.connect().catch((err) => {
        this.logger.warn(`Redis connect failed: ${err?.message || err}`);
      });
      this.client.on('error', (err) => {
        this.logger.warn(`Redis error: ${err?.message || err}`);
      });
    } catch (err: any) {
      this.logger.warn(`Redis init failed: ${err?.message || err}`);
      this.client = null;
    }
  }

  get isReady(): boolean {
    return !!this.client && this.client.status === 'ready';
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.setex(key, ttlSeconds, value);
      return true;
    } catch {
      return false;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch {
      /* ignore */
    }
  }

  async incr(key: string): Promise<number | null> {
    if (!this.client) return null;
    try {
      return await this.client.incr(key);
    } catch {
      return null;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.expire(key, ttlSeconds);
    } catch {
      /* ignore */
    }
  }

  /** SET key NX EX ttl — returns true if set (first writer wins). */
  async setNxEx(key: string, ttlSeconds: number, value = '1'): Promise<boolean> {
    if (!this.client) return false;
    try {
      const r = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return r === 'OK';
    } catch {
      return false;
    }
  }
}

@Injectable()
export class OtpService {
  private readonly memory = new Map<string, { hash: string; expiresAt: number; attempts: number; name?: string }>();
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private ttl(): number {
    return Number(this.config.get('OTP_TTL_SECONDS', 300)) || 300;
  }

  private maxAttempts(): number {
    return Number(this.config.get('OTP_MAX_ATTEMPTS', 5)) || 5;
  }

  private cooldown(): number {
    return Number(this.config.get('OTP_RESEND_COOLDOWN_SECONDS', 60)) || 60;
  }

  private hashCode(phone: string, code: string): string {
    const pepper = this.config.get<string>('JWT_SECRET') || 'dev-otp-pepper';
    return createHash('sha256').update(`${pepper}:${phone}:${code}`).digest('hex');
  }

  private otpKey(phone: string) {
    return `otp:retail:${phone}`;
  }

  private cooldownKey(phone: string) {
    return `otp:cooldown:${phone}`;
  }

  /** Generate + store hashed OTP. Enforces resend cooldown. */
  async issue(phone: string, name?: string): Promise<{ code: string }> {
    const cdKey = this.cooldownKey(phone);
    const redisOk = this.redis.isReady;
    if (redisOk) {
      const allowed = await this.redis.setNxEx(cdKey, this.cooldown(), '1');
      if (!allowed) {
        throw new Error('COOLDOWN');
      }
    } else {
      const existing = this.memory.get(phone);
      if (existing && existing.expiresAt - (this.ttl() - this.cooldown()) * 1000 > Date.now()) {
        // within cooldown window from last issue
        const issuedAt = existing.expiresAt - this.ttl() * 1000;
        if (Date.now() - issuedAt < this.cooldown() * 1000) {
          throw new Error('COOLDOWN');
        }
      }
    }

    const code = String(randomInt(100000, 999999));
    const hash = this.hashCode(phone, code);
    const record: OtpRecord = { hash, attempts: 0, name: name?.trim() || undefined };
    const payload = JSON.stringify(record);

    if (redisOk) {
      const ok = await this.redis.setex(this.otpKey(phone), this.ttl(), payload);
      if (!ok) {
        this.logger.warn('OTP Redis setex failed — falling back to memory');
        this.memory.set(phone, {
          hash,
          expiresAt: Date.now() + this.ttl() * 1000,
          attempts: 0,
          name: record.name,
        });
      }
    } else {
      this.memory.set(phone, {
        hash,
        expiresAt: Date.now() + this.ttl() * 1000,
        attempts: 0,
        name: record.name,
      });
    }

    return { code };
  }

  /**
   * Verify OTP (constant-time hash compare). Single-use on success.
   * Returns stored name if any.
   */
  async verify(phone: string, code: string): Promise<{ name?: string }> {
    const key = this.otpKey(phone);
    let record: OtpRecord | null = null;
    let fromRedis = false;

    if (this.redis.isReady) {
      const raw = await this.redis.get(key);
      if (raw) {
        try {
          record = JSON.parse(raw) as OtpRecord;
          fromRedis = true;
        } catch {
          record = null;
        }
      }
    }

    if (!record) {
      const mem = this.memory.get(phone);
      if (!mem || mem.expiresAt < Date.now()) {
        this.memory.delete(phone);
        throw new Error('EXPIRED');
      }
      record = { hash: mem.hash, attempts: mem.attempts, name: mem.name };
    }

    record.attempts += 1;
    if (record.attempts > this.maxAttempts()) {
      await this.clear(phone);
      throw new Error('MAX_ATTEMPTS');
    }

    const expected = Buffer.from(record.hash, 'hex');
    const actual = Buffer.from(this.hashCode(phone, String(code).trim()), 'hex');
    const match =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!match) {
      // persist attempts
      if (fromRedis && this.redis.isReady) {
        const ttl = this.ttl();
        await this.redis.setex(key, ttl, JSON.stringify(record));
      } else {
        const mem = this.memory.get(phone);
        if (mem) mem.attempts = record.attempts;
      }
      throw new Error('INVALID');
    }

    await this.clear(phone);
    return { name: record.name };
  }

  async clear(phone: string) {
    this.memory.delete(phone);
    await this.redis.del(this.otpKey(phone));
  }

  isRedisReady(): boolean {
    return this.redis.isReady;
  }
}

@Global()
@Module({
  providers: [RedisService, OtpService],
  exports: [RedisService, OtpService],
})
export class RedisModule {}
