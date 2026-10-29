/**
 * PR-14 Rubika (+ optional Bale fallback) order-bot poller.
 * No-op when orderBotEnabled=false or provider env flag OFF.
 * Never invents webhook for Rubika.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';
import { BaleAdapter } from '../adapters/bale.adapter';
import { RubikaAdapter } from '../adapters/rubika.adapter';
import {
  readOrderBotEnabled,
  readOrderBotPollCursor,
  withOrderBotPollCursor,
} from '../bots/bot-order-enabled';
import {
  isOmnichannelOrderBotBaleEnabled,
  isOmnichannelOrderBotRubikaEnabled,
} from '../omnichannel.constants';
import { OmnichannelBotInboundService } from './omnichannel-bot-inbound.service';

@Injectable()
export class OmnichannelBotPollerService {
  private readonly logger = new Logger(OmnichannelBotPollerService.name);
  private ticking = false;

  constructor(
    @InjectRepository(ChannelConnectionEntity)
    private readonly connections: Repository<ChannelConnectionEntity>,
    private readonly inbound: OmnichannelBotInboundService,
    private readonly rubika: RubikaAdapter,
    private readonly bale: BaleAdapter,
  ) {}

  /** Worker/cron tick — bounded; safe when all flags OFF. */
  async maybePoll(): Promise<{ processed: number; skipped: string }> {
    if (this.ticking) return { processed: 0, skipped: 'busy' };
    this.ticking = true;
    try {
      let processed = 0;
      if (isOmnichannelOrderBotRubikaEnabled()) {
        processed += await this.pollRubika();
      }
      if (isOmnichannelOrderBotBaleEnabled()) {
        processed += await this.pollBaleFallback();
      }
      if (!isOmnichannelOrderBotRubikaEnabled() && !isOmnichannelOrderBotBaleEnabled()) {
        return { processed: 0, skipped: 'flags_off' };
      }
      return { processed, skipped: '' };
    } finally {
      this.ticking = false;
    }
  }

  private async pollRubika(): Promise<number> {
    const conns = await this.connections.find({ where: { provider: 'RUBIKA' }, take: 20 });
    let n = 0;
    for (const conn of conns) {
      if (!readOrderBotEnabled(conn.publishSettings)) continue;
      const secretRef = String(conn.secretRef || '').trim();
      if (!secretRef) continue;
      const cursor = readOrderBotPollCursor(conn.publishSettings);
      const result = await this.rubika.fetchOrderBotUpdates(secretRef, cursor || null);
      if (!result.ok) {
        this.logger.warn(`rubika poll failed conn=${conn.id}: ${result.error}`);
        continue;
      }
      for (const update of result.updates) {
        await this.inbound.ingestRubikaUpdate(conn.id, update);
        n += 1;
      }
      if (result.nextOffsetId) {
        conn.publishSettings = withOrderBotPollCursor(
          (conn.publishSettings || {}) as Record<string, unknown>,
          result.nextOffsetId,
        );
        await this.connections.save(conn);
      }
    }
    return n;
  }

  /** Optional Bale poll when webhook unavailable (webhook_active false path). */
  private async pollBaleFallback(): Promise<number> {
    const conns = await this.connections.find({ where: { provider: 'BALE' }, take: 20 });
    let n = 0;
    for (const conn of conns) {
      if (!readOrderBotEnabled(conn.publishSettings)) continue;
      const secretRef = String(conn.secretRef || '').trim();
      if (!secretRef) continue;
      const cursorRaw = readOrderBotPollCursor(conn.publishSettings);
      const offset = cursorRaw ? Number(cursorRaw) : null;
      const result = await this.bale.fetchOrderBotUpdates(
        secretRef,
        Number.isFinite(offset as number) ? (offset as number) : null,
      );
      if (!result.ok) continue;
      for (const update of result.updates) {
        await this.inbound.processInbound({
          provider: 'BALE',
          connectionId: conn.id,
          customerChatId: String(
            (update as { message?: { chat?: { id?: string | number } } }).message?.chat?.id || '',
          ),
          text: String(
            (update as { message?: { text?: string } }).message?.text || '',
          ),
          providerMessageId:
            (update as { message?: { message_id?: number } }).message?.message_id != null
              ? String((update as { message?: { message_id?: number } }).message!.message_id)
              : null,
        });
        n += 1;
      }
      if (result.nextOffset != null) {
        conn.publishSettings = withOrderBotPollCursor(
          (conn.publishSettings || {}) as Record<string, unknown>,
          String(result.nextOffset),
        );
        await this.connections.save(conn);
      }
    }
    return n;
  }
}
