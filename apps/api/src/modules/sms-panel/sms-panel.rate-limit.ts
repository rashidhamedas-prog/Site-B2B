import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../redis/redis.module';
import { SmsMessageEntity } from './entities/sms-panel.entities';

/**
 * Persistent rate limits via Redis (with DB counts for promo caps).
 */
@Injectable()
export class SmsPanelRateLimit {
  private tokens = 5;
  private lastRefill = Date.now();
  private readonly capacity: number;

  constructor(
    private readonly redis: RedisService,
    @InjectRepository(SmsMessageEntity)
    private readonly messages: Repository<SmsMessageEntity>,
  ) {
    this.capacity = Math.max(1, Number(process.env.SMS_PROVIDER_RPS || 5) || 5);
    this.tokens = this.capacity;
  }

  private async incr(key: string, ttlSec: number): Promise<number> {
    const n = await this.redis.incrWithTtl(key, ttlSec);
    if (n == null) return 1;
    return n;
  }

  /** Returns retryAfter seconds if limited, else null. Call AFTER gates pass. */
  async hitActorSend(actorId: string, limit = 10, windowSec = 60): Promise<number | null> {
    const n = await this.incr(`sms:rl:actor:${actorId}`, windowSec);
    if (n > limit) return windowSec;
    return null;
  }

  async hitOtpPhone(phone: string): Promise<{ ok: boolean; retryAfter?: number; code?: string }> {
    const n60 = await this.incr(`sms:rl:otp:60:${phone}`, 60);
    if (n60 > 1) return { ok: false, retryAfter: 60, code: 'OTP_COOLDOWN' };
    const nHour = await this.incr(`sms:rl:otp:h:${phone}`, 3600);
    if (nHour > 5) return { ok: false, retryAfter: 3600, code: 'OTP_HOUR' };
    const nDay = await this.incr(`sms:rl:otp:d:${phone}`, 86400);
    if (nDay > 10) return { ok: false, retryAfter: 86400, code: 'OTP_DAY' };
    return { ok: true };
  }

  async hitOtpIp(ip: string): Promise<number | null> {
    if (!ip) return null;
    const n = await this.incr(`sms:rl:otp:ip:${ip}`, 3600);
    if (n > 20) return 3600;
    return null;
  }

  async promoCaps(
    phone: string,
    perDay: number,
    perWeek: number,
  ): Promise<'DAY' | 'WEEK' | null> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const day = await this.messages
      .createQueryBuilder('m')
      .where('m.phoneNormalized = :phone', { phone })
      .andWhere('m.messageClass = :cls', { cls: 'PROMO' })
      .andWhere('m.createdAt >= :dayAgo', { dayAgo })
      .andWhere('m.status NOT IN (:...skip)', {
        skip: ['SKIPPED', 'CANCELLED', 'FAILED'],
      })
      .getCount();
    if (day >= perDay) return 'DAY';
    const week = await this.messages
      .createQueryBuilder('m')
      .where('m.phoneNormalized = :phone', { phone })
      .andWhere('m.messageClass = :cls', { cls: 'PROMO' })
      .andWhere('m.createdAt >= :weekAgo', { weekAgo })
      .andWhere('m.status NOT IN (:...skip)', {
        skip: ['SKIPPED', 'CANCELLED', 'FAILED'],
      })
      .getCount();
    if (week >= perWeek) return 'WEEK';
    return null;
  }

  takeProviderToken(): boolean {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.capacity);
    this.lastRefill = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
