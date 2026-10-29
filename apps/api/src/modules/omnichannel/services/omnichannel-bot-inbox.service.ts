/**
 * PR-14 admin inbox: list/thread/reply/refer-social/mark-answered.
 * Never exposes tokens; ownerChatId forward only.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OmnichannelBotConversationEntity } from '../entities/omnichannel-bot-conversation.entity';
import { OmnichannelBotMessageEntity } from '../entities/omnichannel-bot-message.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';
import { ChannelAdapterRegistry } from '../adapters/adapter-registry';
import { OmnichannelAlertsService } from './omnichannel-alerts.service';
import { ownerChatIdConfigured, ownerChatIdForDestination } from '../channel-settings';
import { readOrderBotEnabled, withOrderBotEnabled } from '../bots/bot-order-enabled';
import { assertOrderBotEnableAllowed } from './omnichannel-bot-inbound.service';
import { truncateBodyPreview, BODY_PREVIEW_MAX } from '../unanswered-alert-policy';
import {
  assertGoRefPresent,
  isOmnichannelRbacEnabled,
  roleMeetsMinimum,
  type OmnichannelRole,
} from '../omnichannel-rbac';
import { isDocumentedBaleCanaryKey } from '../canary-live-guard';

@Injectable()
export class OmnichannelBotInboxService {
  private readonly logger = new Logger(OmnichannelBotInboxService.name);

  constructor(
    @InjectRepository(OmnichannelBotConversationEntity)
    private readonly conversations: Repository<OmnichannelBotConversationEntity>,
    @InjectRepository(OmnichannelBotMessageEntity)
    private readonly messages: Repository<OmnichannelBotMessageEntity>,
    @InjectRepository(ChannelDestinationEntity)
    private readonly destinations: Repository<ChannelDestinationEntity>,
    @InjectRepository(ChannelConnectionEntity)
    private readonly connections: Repository<ChannelConnectionEntity>,
    private readonly adapters: ChannelAdapterRegistry,
    private readonly alerts: OmnichannelAlertsService,
  ) {}

  async listInbox(query: {
    provider?: string;
    tag?: string;
    unansweredOnly?: boolean;
    limit?: number;
  }): Promise<{ items: Array<Record<string, unknown>> }> {
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const qb = this.conversations
      .createQueryBuilder('c')
      .where('c.status = :open', { open: 'open' })
      .orderBy('c.lastCustomerMessageAt', 'DESC', 'NULLS LAST')
      .take(limit);
    if (query.provider) {
      qb.andWhere('c.provider = :provider', {
        provider: String(query.provider).toUpperCase(),
      });
    }
    if (query.tag) {
      qb.andWhere(`c.tags @> :tagJson`, {
        tagJson: JSON.stringify([String(query.tag)]),
      });
    }
    if (query.unansweredOnly) {
      qb.andWhere('c.unansweredSince IS NOT NULL');
    }
    const rows = await qb.getMany();
    const destIds = [...new Set(rows.map((r) => r.destinationId))];
    const dests = destIds.length
      ? await this.destinations.find({ where: { id: In(destIds) } })
      : [];
    const destMap = new Map(dests.map((d) => [d.id, d]));

    const items = rows.map((c) => {
      const dest = destMap.get(c.destinationId);
      const tags = Array.isArray(c.tags) ? c.tags : [];
      return {
        id: c.id,
        provider: c.provider,
        customerChatId: c.customerChatId,
        customerLabel: `…${String(c.customerChatId).slice(-4)}`,
        state: c.state,
        tags,
        unanswered: !!c.unansweredSince || tags.includes('unanswered'),
        sensitive: tags.includes('sensitive'),
        autoRepliedAt: c.autoRepliedAt?.toISOString() ?? null,
        lastCustomerMessageAt: c.lastCustomerMessageAt?.toISOString() ?? null,
        orderId: c.orderId,
        invoiceId: c.invoiceId,
        destinationId: c.destinationId,
        destinationLabel: dest?.displayName || dest?.destinationKey || null,
        ownerChatConfigured: ownerChatIdConfigured(dest?.publishSettings),
      };
    });
    return { items };
  }

  async getThread(conversationId: string): Promise<Record<string, unknown>> {
    const conv = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('گفتگو یافت نشد');
    const msgs = await this.messages.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: 200,
    });
    return {
      conversation: {
        id: conv.id,
        provider: conv.provider,
        state: conv.state,
        tags: conv.tags,
        orderId: conv.orderId,
        invoiceId: conv.invoiceId,
        customerChatId: conv.customerChatId,
      },
      messages: msgs.map((m) => ({
        id: m.id,
        direction: m.direction,
        bodyPreview: m.bodyPreview,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async reply(
    conversationId: string,
    text: string,
    actor: { role: OmnichannelRole; goRef?: string },
  ): Promise<{ ok: boolean }> {
    if (!roleMeetsMinimum(actor.role, 'PUBLISHER')) {
      throw new ForbiddenException('دسترسی کافی نیست');
    }
    const body = String(text || '').trim();
    if (!body) throw new BadRequestException('متن خالی است');

    const conv = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('گفتگو یافت نشد');
    const dest = await this.destinations.findOne({ where: { id: conv.destinationId } });
    if (!dest) throw new NotFoundException('مقصد یافت نشد');
    const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
    const botOn = readOrderBotEnabled(conn?.publishSettings);
    if (!botOn) {
      if (isOmnichannelRbacEnabled()) {
        if (actor.role !== 'OWNER') {
          throw new ForbiddenException('ربات خاموش است؛ فقط Owner با goRef');
        }
        assertGoRefPresent(actor.goRef);
      }
    }

    const now = new Date();
    conv.lastStaffReplyAt = now;
    conv.lastOutboundAt = now;
    conv.unansweredSince = null;
    await this.conversations.save(conv);

    await this.messages.save(
      this.messages.create({
        conversationId: conv.id,
        direction: 'outbound',
        bodyPreview: truncateBodyPreview(body, BODY_PREVIEW_MAX),
        body: body.slice(0, 2000),
        provider: conv.provider,
        providerMessageId: null,
        meta: { source: 'admin_inbox' },
      }),
    );

    await this.alerts.resolveOpenForConversation(conv.id).catch(() => undefined);

    const secretRef = String(conn?.secretRef || '').trim();
    if (secretRef && String(conv.provider).toUpperCase() !== 'TELEGRAM') {
      try {
        await this.adapters.for(conv.provider).create({
          secretRef,
          chatId: conv.customerChatId,
          destinationKey: conv.customerChatId,
          text: body,
          parseMode: 'PLAIN',
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`inbox reply send failed: ${msg.slice(0, 80)}`);
      }
    }
    return { ok: true };
  }

  async referSocial(
    conversationId: string,
    note?: string,
  ): Promise<{ ok: boolean; forwarded: boolean; audit: string }> {
    const conv = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('گفتگو یافت نشد');
    const dest = await this.destinations.findOne({ where: { id: conv.destinationId } });
    if (!dest) throw new NotFoundException('مقصد یافت نشد');
    const ownerChatId = ownerChatIdForDestination(dest.publishSettings);
    const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
    const secretRef = String(conn?.secretRef || '').trim();
    const text =
      `ارجاع به سوشال مدیا\nگفتگو: ${conv.id}\n`
      + `وضعیت: ${conv.state}\n`
      + (note ? `یادداشت: ${String(note).slice(0, 200)}\n` : '');

    if (!ownerChatId) {
      return { ok: true, forwarded: false, audit: 'owner_chat_missing' };
    }
    if (!secretRef || String(conv.provider).toUpperCase() === 'TELEGRAM') {
      return { ok: true, forwarded: false, audit: 'forward_skipped' };
    }
    try {
      await this.adapters.for(conv.provider).create({
        secretRef,
        chatId: ownerChatId,
        destinationKey: ownerChatId,
        text,
        parseMode: 'PLAIN',
      });
      return { ok: true, forwarded: true, audit: 'bot_refer_social' };
    } catch {
      return { ok: true, forwarded: false, audit: 'forward_failed' };
    }
  }

  async markAnswered(conversationId: string): Promise<{ ok: boolean }> {
    const conv = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('گفتگو یافت نشد');
    conv.unansweredSince = null;
    conv.lastStaffReplyAt = new Date();
    await this.conversations.save(conv);
    await this.alerts.resolveOpenForConversation(conv.id).catch(() => undefined);
    return { ok: true };
  }

  async setOrderBotEnabled(
    connectionId: string,
    enabled: boolean,
    actor: { role: OmnichannelRole; goRef?: string },
  ): Promise<{ ok: boolean; orderBotEnabled: boolean }> {
    assertOrderBotEnableAllowed({
      role: actor.role,
      goRef: actor.goRef,
      rbacEnabled: isOmnichannelRbacEnabled(),
    });
    if (isOmnichannelRbacEnabled()) assertGoRefPresent(actor.goRef);
    const conn = await this.connections.findOne({ where: { id: connectionId } });
    if (!conn) throw new NotFoundException('اتصال یافت نشد');
    conn.publishSettings = withOrderBotEnabled(
      (conn.publishSettings || {}) as Record<string, unknown>,
      enabled === true,
    );
    await this.connections.save(conn);
    // Canary dual-role: warn only — never clear/remap 4858359991.
    const dests = await this.destinations.find({ where: { connectionId }, take: 20 });
    for (const d of dests) {
      if (isDocumentedBaleCanaryKey(d.destinationKey) && d.settings?.isCanary === true) {
        this.logger.warn(
          `canary_dual_role_warn destination=${d.id} key_documented_bale — not remapped`,
        );
      }
    }
    return { ok: true, orderBotEnabled: enabled === true };
  }

  async testOwnerChat(
    destinationId: string,
    actor: { role: OmnichannelRole; goRef?: string },
  ): Promise<{ ok: boolean; sent: boolean; reason?: string }> {
    if (isOmnichannelRbacEnabled()) {
      if (actor.role !== 'OWNER') throw new ForbiddenException('فقط Owner');
      assertGoRefPresent(actor.goRef);
    }
    const dest = await this.destinations.findOne({ where: { id: destinationId } });
    if (!dest) throw new NotFoundException('مقصد یافت نشد');
    const ownerChatId = ownerChatIdForDestination(dest.publishSettings);
    if (!ownerChatId) {
      throw new BadRequestException('ownerChatId خالی است — هرگز شناسه ساختگی وارد نکنید');
    }
    if (isDocumentedBaleCanaryKey(dest.destinationKey)) {
      this.logger.warn(
        `canary_dual_role_warn test-owner-chat destination=${dest.id} — not remapped`,
      );
    }
    const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
    const secretRef = String(conn?.secretRef || '').trim();
    const provider = String(conn?.provider || '').toUpperCase();
    if (!secretRef) return { ok: true, sent: false, reason: 'token_missing' };
    if (provider === 'TELEGRAM') return { ok: true, sent: false, reason: 'telegram_deferred' };
    try {
      await this.adapters.for(provider).create({
        secretRef,
        chatId: ownerChatId,
        destinationKey: ownerChatId,
        text: 'تست آی‌دی مقصد هدایت پیام‌ها (پنل اومنی‌چنل) — پیام آزمایشی.',
        parseMode: 'PLAIN',
      });
      return { ok: true, sent: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'send_failed';
      return { ok: true, sent: false, reason: msg.slice(0, 64) };
    }
  }
}
