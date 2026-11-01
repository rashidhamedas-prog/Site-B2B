/**
 * PR-13 unanswered alerts: scan, list, ack, resolve, optional owner notify.
 * Never invents chat IDs. Empty ownerChatId → panel-only. Telegram notify deferred (panel only).
 * Soft PR-12: BALE/RUBIKA notify uses existing adapter.create when connectors already LIVE.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OmnichannelAlertEntity } from '../entities/omnichannel-alert.entity';
import { OmnichannelBotConversationEntity } from '../entities/omnichannel-bot-conversation.entity';
import { OmnichannelBotMessageEntity } from '../entities/omnichannel-bot-message.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';
import { ChannelAdapterRegistry } from '../adapters/adapter-registry';
import { ownerChatIdForDestination } from '../channel-settings';
import {
  areOmnichannelConnectorsEnabled,
  isOmnichannelProviderEnabled,
} from '../omnichannel.constants';
import {
  BODY_PREVIEW_MAX,
  evaluateUnansweredAlerts,
  OWNER_NOTIFY_ATTEMPT_CAP,
  truncateBodyPreview,
  unansweredOwnerNotifyText,
  unansweredThresholdSec,
  type UnansweredConversationRow,
} from '../unanswered-alert-policy';

const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

function toTehranLabel(d: Date | null | undefined): string | null {
  if (!d) return null;
  const t = new Date(d.getTime() + TEHRAN_OFFSET_MS);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, '0');
  const day = String(t.getUTCDate()).padStart(2, '0');
  const hh = String(t.getUTCHours()).padStart(2, '0');
  const mm = String(t.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

@Injectable()
export class OmnichannelAlertsService {
  private readonly logger = new Logger(OmnichannelAlertsService.name);
  private lastScanAt = 0;
  private scanning = false;

  constructor(
    @InjectRepository(OmnichannelAlertEntity)
    private readonly alerts: Repository<OmnichannelAlertEntity>,
    @InjectRepository(OmnichannelBotConversationEntity)
    private readonly conversations: Repository<OmnichannelBotConversationEntity>,
    @InjectRepository(OmnichannelBotMessageEntity)
    private readonly messages: Repository<OmnichannelBotMessageEntity>,
    @InjectRepository(ChannelDestinationEntity)
    private readonly destinations: Repository<ChannelDestinationEntity>,
    @InjectRepository(ChannelConnectionEntity)
    private readonly connections: Repository<ChannelConnectionEntity>,
    private readonly adapters: ChannelAdapterRegistry,
  ) {}

  /** Worker tick hook — rate-limited; no-op when table empty / already scanning. */
  async maybeScanFromWorker(now = new Date()): Promise<{ raised: number; scanned: number }> {
    const intervalMs = Math.max(
      5_000,
      Number(process.env.OMNICHANNEL_UNANSWERED_SCAN_INTERVAL_MS || 15_000) || 15_000,
    );
    if (this.scanning) return { raised: 0, scanned: 0 };
    if (Date.now() - this.lastScanAt < intervalMs) return { raised: 0, scanned: 0 };
    this.scanning = true;
    try {
      const result = await this.scanUnanswered(now);
      this.lastScanAt = Date.now();
      return result;
    } finally {
      this.scanning = false;
    }
  }

  async scanUnanswered(now = new Date()): Promise<{ raised: number; scanned: number }> {
    const threshold = unansweredThresholdSec();
    const openConvs = await this.conversations.find({
      where: { status: 'open' },
      take: 500,
      order: { lastCustomerMessageAt: 'ASC' },
    });
    if (!openConvs.length) return { raised: 0, scanned: 0 };

    const openAlerts = await this.alerts.find({
      where: {
        type: 'bot_unanswered',
        status: In(['open', 'acked']),
        conversationId: In(openConvs.map((c) => c.id)),
      },
      select: ['conversationId', 'status'],
    });

    const rows: UnansweredConversationRow[] = openConvs.map((c) => ({
      conversationId: c.id,
      destinationId: c.destinationId,
      provider: c.provider,
      status: c.status,
      lastCustomerMessageAt: c.lastCustomerMessageAt,
      lastStaffReplyAt: c.lastStaffReplyAt,
    }));

    const decisions = evaluateUnansweredAlerts(now, rows, openAlerts, threshold);
    let raised = 0;
    for (const d of decisions) {
      if (d.action !== 'raise') continue;
      const conv = openConvs.find((c) => c.id === d.conversationId);
      if (!conv) continue;
      try {
        const alert = await this.raisePanelAlert(conv, d.ageSec, now);
        raised += 1;
        await this.maybeNotifyOwner(alert, conv, d.ageSec);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Unique race: another tick already opened — ignore.
        if (/unique|duplicate/i.test(msg)) continue;
        this.logger.warn(`unanswered raise failed conv=${d.conversationId}: ${msg}`);
      }
    }
    return { raised, scanned: openConvs.length };
  }

  private async raisePanelAlert(
    conv: OmnichannelBotConversationEntity,
    ageSec: number,
    now: Date,
  ): Promise<OmnichannelAlertEntity> {
    const dest = await this.destinations.findOne({ where: { id: conv.destinationId } });
    const ownerConfigured = ownerChatIdForDestination(dest?.publishSettings).length > 0;
    const row = this.alerts.create({
      type: 'bot_unanswered',
      destinationId: conv.destinationId,
      conversationId: conv.id,
      severity: 'warn',
      status: 'open',
      notifiedOwnerAt: null,
      panelSeenAt: null,
      detail: {
        ageSec,
        provider: conv.provider,
        ownerChatConfigured: ownerConfigured,
        notifyAttempts: 0,
        raisedAt: now.toISOString(),
      },
    });
    return this.alerts.save(row);
  }

  /**
   * Owner messenger notify — only uses Owner-entered ownerChatId from PR-10 settings.
   * Telegram: structure only (panel alert; no send). BALE/RUBIKA: adapter.create when connectors on.
   */
  private async maybeNotifyOwner(
    alert: OmnichannelAlertEntity,
    conv: OmnichannelBotConversationEntity,
    ageSec: number,
  ): Promise<void> {
    const dest = await this.destinations.findOne({ where: { id: conv.destinationId } });
    const ownerChatId = ownerChatIdForDestination(dest?.publishSettings);
    const detail = { ...(alert.detail || {}) } as Record<string, unknown>;
    detail.ownerChatConfigured = ownerChatId.length > 0;

    if (!ownerChatId) {
      detail.notifyErrorCode = 'owner_chat_id_empty';
      alert.detail = detail;
      await this.alerts.save(alert);
      return;
    }

    const provider = String(conv.provider || '').toUpperCase();
    if (provider === 'TELEGRAM') {
      detail.notifyErrorCode = 'telegram_notify_deferred';
      alert.detail = detail;
      await this.alerts.save(alert);
      return;
    }

    const attempts = Number(detail.notifyAttempts || 0);
    if (attempts >= OWNER_NOTIFY_ATTEMPT_CAP) {
      detail.notifyErrorCode = 'notify_cap_reached';
      alert.detail = detail;
      await this.alerts.save(alert);
      return;
    }

    if (!areOmnichannelConnectorsEnabled() || !isOmnichannelProviderEnabled(provider)) {
      detail.notifyAttempts = attempts + 1;
      detail.notifyErrorCode = 'connector_disabled';
      alert.detail = detail;
      await this.alerts.save(alert);
      return;
    }

    if (provider !== 'BALE' && provider !== 'RUBIKA') {
      detail.notifyAttempts = attempts + 1;
      detail.notifyErrorCode = 'provider_unsupported';
      alert.detail = detail;
      await this.alerts.save(alert);
      return;
    }

    const conn = dest
      ? await this.connections.findOne({ where: { id: dest.connectionId } })
      : null;
    const secretRef = String(conn?.secretRef || '').trim();
    if (!secretRef) {
      detail.notifyAttempts = attempts + 1;
      detail.notifyErrorCode = 'token_missing';
      alert.detail = detail;
      await this.alerts.save(alert);
      return;
    }

    const text = unansweredOwnerNotifyText({
      destinationLabel: dest?.displayName || dest?.destinationKey || provider,
      provider,
      ageSec,
    });

    try {
      const adapter = this.adapters.for(provider);
      await adapter.create({
        secretRef,
        chatId: ownerChatId,
        destinationKey: ownerChatId,
        text,
        parseMode: 'PLAIN',
      });
      detail.notifyAttempts = attempts + 1;
      delete detail.notifyErrorCode;
      alert.detail = detail;
      alert.notifiedOwnerAt = new Date();
      await this.alerts.save(alert);
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'telegramCode' in err
          ? String((err as { telegramCode?: string }).telegramCode || 'notify_failed')
          : err instanceof Error
            ? err.message.slice(0, 64)
            : 'notify_failed';
      detail.notifyAttempts = attempts + 1;
      detail.notifyErrorCode = code;
      alert.detail = detail;
      await this.alerts.save(alert);
      this.logger.warn(`owner notify failed alert=${alert.id}: ${code}`);
    }
  }

  async listAlerts(query: {
    status?: string;
    destinationId?: string;
  }): Promise<{
    openCount: number;
    items: Array<Record<string, unknown>>;
  }> {
    const status = String(query.status || 'open').toLowerCase();
    const qb = this.alerts
      .createQueryBuilder('a')
      .where('a.type = :type', { type: 'bot_unanswered' })
      .orderBy('a.createdAt', 'DESC')
      .take(100);
    if (status !== 'all') {
      if (status === 'open') {
        qb.andWhere('a.status IN (:...st)', { st: ['open', 'acked'] });
      } else {
        qb.andWhere('a.status = :st', { st: status });
      }
    }
    if (query.destinationId) {
      qb.andWhere('a.destinationId = :destinationId', {
        destinationId: query.destinationId,
      });
    }
    const rows = await qb.getMany();
    const openCount = await this.alerts.count({
      where: { type: 'bot_unanswered', status: In(['open', 'acked']) },
    });

    const destIds = [...new Set(rows.map((r) => r.destinationId))];
    const dests = destIds.length
      ? await this.destinations.find({ where: { id: In(destIds) } })
      : [];
    const destMap = new Map(dests.map((d) => [d.id, d]));
    const connIds = [...new Set(dests.map((d) => d.connectionId).filter(Boolean))];
    const conns = connIds.length
      ? await this.connections.find({ where: { id: In(connIds) }, select: ['id', 'provider'] })
      : [];
    const connMap = new Map(conns.map((c) => [c.id, c]));

    const items = rows.map((a) => {
      const dest = destMap.get(a.destinationId);
      const conn = dest ? connMap.get(dest.connectionId) : undefined;
      const ownerChatConfigured = ownerChatIdForDestination(dest?.publishSettings).length > 0;
      return {
        id: a.id,
        type: a.type,
        destinationId: a.destinationId,
        conversationId: a.conversationId,
        severity: a.severity,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
        createdAtTehran: toTehranLabel(a.createdAt),
        notifiedOwnerAt: a.notifiedOwnerAt?.toISOString() ?? null,
        panelSeenAt: a.panelSeenAt?.toISOString() ?? null,
        destinationLabel: dest?.displayName || dest?.destinationKey || null,
        provider:
          conn?.provider
          || (typeof a.detail?.provider === 'string' ? a.detail.provider : null),
        ownerChatConfigured:
          typeof a.detail?.ownerChatConfigured === 'boolean'
            ? a.detail.ownerChatConfigured
            : ownerChatConfigured,
        notifyErrorCode: (a.detail?.notifyErrorCode as string | undefined) || null,
        ageSec: typeof a.detail?.ageSec === 'number' ? a.detail.ageSec : null,
        settingsHint: ownerChatConfigured
          ? null
          : 'ownerChatId خالی است — در تنظیمات کانال (PR-10) آی‌دی مقصد هدایت پیام‌ها را وارد کنید. هرگز شناسه ساختگی وارد نکنید.',
      };
    });

    return { openCount, items };
  }

  async ackAlert(id: string): Promise<OmnichannelAlertEntity> {
    const alert = await this.alerts.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('هشدار یافت نشد');
    if (alert.status === 'resolved') return alert;
    alert.status = 'acked';
    alert.panelSeenAt = new Date();
    return this.alerts.save(alert);
  }

  async resolveAlert(id: string): Promise<OmnichannelAlertEntity> {
    const alert = await this.alerts.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('هشدار یافت نشد');
    alert.status = 'resolved';
    if (!alert.panelSeenAt) alert.panelSeenAt = new Date();
    return this.alerts.save(alert);
  }

  /** PR-14 inbox reply / mark-answered — resolve open unanswered for a conversation. */
  async resolveOpenForConversation(conversationId: string): Promise<number> {
    const open = await this.alerts.find({
      where: {
        type: 'bot_unanswered',
        conversationId,
        status: In(['open', 'acked']),
      },
    });
    if (!open.length) return 0;
    const now = new Date();
    for (const alert of open) {
      alert.status = 'resolved';
      if (!alert.panelSeenAt) alert.panelSeenAt = now;
    }
    await this.alerts.save(open);
    return open.length;
  }

  /**
   * Test/staging helper — NOT an HTTP production route.
   * Callers must pass explicit customerChatId from fixtures (never invent LIVE ids).
   */
  async seedConversationFixture(input: {
    destinationId: string;
    provider: string;
    customerChatId: string;
    bodyPreview?: string;
    lastCustomerMessageAt?: Date;
    lastStaffReplyAt?: Date | null;
  }): Promise<{ conversationId: string; messageId: string }> {
    const customerChatId = String(input.customerChatId || '').trim();
    if (!customerChatId) {
      throw new Error('customerChatId_required');
    }
    const conv = await this.conversations.save(
      this.conversations.create({
        destinationId: input.destinationId,
        provider: String(input.provider || '').toUpperCase(),
        customerChatId,
        lastCustomerMessageAt: input.lastCustomerMessageAt || new Date(),
        lastStaffReplyAt: input.lastStaffReplyAt === undefined ? null : input.lastStaffReplyAt,
        status: 'open',
      }),
    );
    const msg = await this.messages.save(
      this.messages.create({
        conversationId: conv.id,
        direction: 'inbound',
        bodyPreview: truncateBodyPreview(input.bodyPreview || '', BODY_PREVIEW_MAX),
        providerMessageId: null,
      }),
    );
    return { conversationId: conv.id, messageId: msg.id };
  }
}
