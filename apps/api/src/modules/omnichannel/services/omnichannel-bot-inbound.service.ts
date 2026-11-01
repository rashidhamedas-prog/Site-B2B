/**
 * PR-14 order-bot inbound: secret-validated ingest → idempotent persist → FSM → optional PFI draft.
 * Bots default OFF; never invent chat IDs; never DM Hamed personally (ownerChatId only).
 * HARD STOP: never create WHOLESALE CREDIT orders from phone-only match.
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { OmnichannelBotConversationEntity } from '../entities/omnichannel-bot-conversation.entity';
import { OmnichannelBotMessageEntity } from '../entities/omnichannel-bot-message.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';
import { ChannelAdapterRegistry } from '../adapters/adapter-registry';
import { ownerChatIdForDestination } from '../channel-settings';
import {
  extractRubikaMessageId,
  extractTelegramFamilyMessageId,
  isUniqueViolation,
  resolveInboundMessageId,
} from '../bots/bot-inbound-idempotency';
import { checkBotRateLimit } from '../bots/bot-rate-limit';
import { transitionBotOrderFsm, BOT_MENU_COPY, parseStartSku } from '../bots/bot-order-fsm';
import { projectBotCatalog } from '../bots/bot-catalog';
import { buildBotProformaDraft, formatPfiCustomerMessage } from '../bots/bot-pfi';
import { maskIranianMobiles } from '../bots/bot-pii';
import { readOrderBotEnabled } from '../bots/bot-order-enabled';
import { timingSafeSecretEqual } from '../bots/bot-webhook-secret';
import {
  isOmnichannelOrderBotBaleEnabled,
  isOmnichannelOrderBotRubikaEnabled,
  isOmnichannelOrderBotTelegramEnabled,
} from '../omnichannel.constants';
import { truncateBodyPreview, BODY_PREVIEW_MAX } from '../unanswered-alert-policy';
import { ProductService } from '../../product/product.service';
import { CustomerService } from '../../customer/customer.service';
import { InvoiceService } from '../../invoice/invoice.service';
import { parseTelegramInboundUpdate } from '../adapters/telegram.adapter';

export type InboundProcessResult = {
  ok: boolean;
  duplicate?: boolean;
  conversationId?: string;
  state?: string;
  ignored?: string;
};

@Injectable()
export class OmnichannelBotInboundService {
  private readonly logger = new Logger(OmnichannelBotInboundService.name);

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
    private readonly products: ProductService,
    private readonly customers: CustomerService,
    private readonly invoices: InvoiceService,
  ) {}

  assertWebhookSecret(provider: 'BALE' | 'TELEGRAM', headerSecret: string | undefined): void {
    const envName =
      provider === 'BALE' ? 'BALE_ORDER_WEBHOOK_SECRET' : 'TELEGRAM_ORDER_WEBHOOK_SECRET';
    const expected = String(process.env[envName] || '').trim();
    if (!expected) {
      throw new UnauthorizedException('webhook_secret_not_configured');
    }
    const got = String(headerSecret || '').trim();
    if (!got || !timingSafeSecretEqual(expected, got)) {
      throw new UnauthorizedException('invalid_webhook_secret');
    }
  }

  async handleBaleWebhook(
    body: unknown,
    headerSecret: string | undefined,
  ): Promise<InboundProcessResult> {
    this.assertWebhookSecret('BALE', headerSecret);
    if (!isOmnichannelOrderBotBaleEnabled()) {
      return { ok: true, ignored: 'flag_off' };
    }
    return this.ingestTelegramFamilyUpdate('BALE', body);
  }

  async handleTelegramWebhook(
    body: unknown,
    headerSecret: string | undefined,
  ): Promise<InboundProcessResult> {
    this.assertWebhookSecret('TELEGRAM', headerSecret);
    if (!isOmnichannelOrderBotTelegramEnabled()) {
      return { ok: true, ignored: 'flag_off' };
    }
    return this.ingestTelegramFamilyUpdate('TELEGRAM', body);
  }

  async ingestRubikaUpdate(
    connectionId: string,
    update: Record<string, unknown>,
  ): Promise<InboundProcessResult> {
    if (!isOmnichannelOrderBotRubikaEnabled()) {
      return { ok: true, ignored: 'flag_off' };
    }
    const conn = await this.connections.findOne({ where: { id: connectionId } });
    if (!conn || String(conn.provider).toUpperCase() !== 'RUBIKA') {
      return { ok: false, ignored: 'connection_missing' };
    }
    if (!readOrderBotEnabled(conn.publishSettings)) {
      return { ok: true, ignored: 'order_bot_disabled' };
    }
    const chatId = String(update.chat_id || '').trim();
    // Rubika private chats typically u0… — reject channel/group prefixes.
    if (/^(c0|g0|b0)/i.test(chatId)) {
      return { ok: true, ignored: 'non_private' };
    }
    const nm = update.new_message as Record<string, unknown> | undefined;
    const text = String(nm?.text || update.text || '').trim();
    const providerMessageId = extractRubikaMessageId(update);
    return this.processInbound({
      provider: 'RUBIKA',
      connectionId: conn.id,
      customerChatId: chatId,
      text,
      providerMessageId,
      updateId: update.update_id != null ? String(update.update_id) : null,
    });
  }

  private async ingestTelegramFamilyUpdate(
    provider: 'BALE' | 'TELEGRAM',
    body: unknown,
  ): Promise<InboundProcessResult> {
    const parsed =
      provider === 'TELEGRAM'
        ? parseTelegramInboundUpdate(body)
        : this.parseBaleUpdate(body);
    if (!parsed?.customerChatId) {
      return { ok: true, ignored: 'no_private_message' };
    }
    if (!parsed.privateChat) {
      return { ok: true, ignored: 'non_private' };
    }
    const conn = await this.findOrderBotConnection(provider);
    if (!conn) return { ok: true, ignored: 'no_enabled_connection' };
    if (!readOrderBotEnabled(conn.publishSettings)) {
      return { ok: true, ignored: 'order_bot_disabled' };
    }
    const updateId =
      body && typeof body === 'object' && 'update_id' in (body as object)
        ? String((body as { update_id?: unknown }).update_id ?? '')
        : null;
    return this.processInbound({
      provider,
      connectionId: conn.id,
      customerChatId: parsed.customerChatId,
      text: parsed.text,
      providerMessageId: parsed.providerMessageId,
      updateId,
    });
  }

  private parseBaleUpdate(body: unknown): {
    customerChatId: string;
    text: string;
    providerMessageId: string | null;
    privateChat: boolean;
    chatType: string;
  } | null {
    if (!body || typeof body !== 'object') return null;
    const u = body as Record<string, unknown>;
    const msg = (u.message || u.edited_message) as Record<string, unknown> | undefined;
    const chat = msg?.chat as Record<string, unknown> | undefined;
    const chatId = chat?.id != null ? String(chat.id) : '';
    if (!chatId) return null;
    const chatType = String(chat?.type || '').toLowerCase();
    // Require explicit private; empty type treated as reject for safety on Bale.
    const privateChat = chatType === 'private';
    return {
      customerChatId: chatId,
      text: String(msg?.text || '').trim(),
      providerMessageId: extractTelegramFamilyMessageId(body),
      privateChat,
      chatType,
    };
  }

  private async findOrderBotConnection(provider: string): Promise<ChannelConnectionEntity | null> {
    const rows = await this.connections.find({
      where: { provider: provider.toUpperCase() as 'BALE' | 'TELEGRAM' | 'RUBIKA' },
      take: 50,
    });
    return rows.find((c) => readOrderBotEnabled(c.publishSettings)) || null;
  }

  private async findDestinationForConnection(
    connectionId: string,
  ): Promise<ChannelDestinationEntity | null> {
    const dests = await this.destinations.find({
      where: { connectionId },
      take: 20,
      order: { createdAt: 'ASC' },
    });
    return dests.find((d) => d.settings?.isCanary === true) || dests[0] || null;
  }

  private safePreview(text: string, max = BODY_PREVIEW_MAX): string {
    return truncateBodyPreview(maskIranianMobiles(text), max);
  }

  async processInbound(input: {
    provider: string;
    connectionId: string;
    customerChatId: string;
    text: string;
    providerMessageId: string | null;
    updateId?: string | null;
    destinationId?: string;
  }): Promise<InboundProcessResult> {
    const provider = String(input.provider || '').toUpperCase();
    const customerChatId = String(input.customerChatId || '').trim();
    if (!customerChatId) return { ok: false, ignored: 'missing_chat' };

    const dest =
      (input.destinationId
        ? await this.destinations.findOne({ where: { id: input.destinationId } })
        : null)
      || (await this.findDestinationForConnection(input.connectionId));
    if (!dest) return { ok: false, ignored: 'destination_missing' };

    const rate = checkBotRateLimit({ provider, customerChatId });
    if (rate.allowed === false) {
      await this.persistSoftBlockNotice({
        dest,
        connectionId: input.connectionId,
        provider,
        customerChatId,
        notice: rate.notice,
      });
      return { ok: true, ignored: 'rate_limited' };
    }

    const key = resolveInboundMessageId({
      provider,
      customerChatId,
      extractedId: input.providerMessageId,
      updateId: input.updateId,
      text: input.text,
    });
    if (!key) {
      return { ok: true, ignored: 'missing_message_id' };
    }

    const existing = await this.messages.findOne({
      where: { provider: key.provider, providerMessageId: key.providerMessageId },
    });
    if (existing) {
      return { ok: true, duplicate: true, conversationId: existing.conversationId };
    }

    let conv = await this.conversations.findOne({
      where: {
        destinationId: dest.id,
        customerChatId,
        status: 'open',
      },
    });
    const now = new Date();
    if (!conv) {
      conv = await this.conversations.save(
        this.conversations.create({
          destinationId: dest.id,
          connectionId: input.connectionId,
          provider,
          customerChatId,
          externalChatId: customerChatId,
          state: 'MENU',
          statePayload: {},
          tags: [],
          lastCustomerMessageAt: now,
          lastInboundAt: now,
          lastStaffReplyAt: null,
          unansweredSince: now,
          status: 'open',
        }),
      );
    } else {
      conv.lastCustomerMessageAt = now;
      conv.lastInboundAt = now;
      if (!conv.unansweredSince) conv.unansweredSince = now;
      await this.conversations.save(conv);
    }

    try {
      await this.messages.save(
        this.messages.create({
          conversationId: conv.id,
          direction: 'inbound',
          bodyPreview: this.safePreview(input.text),
          body: maskIranianMobiles(input.text).slice(0, 2000),
          provider,
          providerMessageId: key.providerMessageId,
          meta: null,
        }),
      );
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        return { ok: true, duplicate: true, conversationId: conv.id };
      }
      throw err;
    }

    const hasPriorPfi = await this.hasPriorPfi(provider, customerChatId, conv.id);
    let catalog = null as ReturnType<typeof projectBotCatalog>;
    const skuHint =
      parseStartSku(input.text)
      || (conv.state === 'PRODUCT_LOOKUP' || conv.state === 'MENU'
        ? String(input.text || '').trim()
        : String(conv.statePayload?.sku || ''));
    if (skuHint && /^[A-Za-z0-9_-]{2,64}$/.test(skuHint)) {
      try {
        const product = await this.products.findBySku(skuHint);
        catalog = projectBotCatalog(product as never);
      } catch {
        catalog = null;
      }
    }

    const fsm = transitionBotOrderFsm(
      {
        state: conv.state,
        statePayload: (conv.statePayload || {}) as Record<string, unknown>,
        tags: Array.isArray(conv.tags) ? conv.tags : [],
        hasPriorPfi,
        catalog: catalog
          ? {
              productId: catalog.productId,
              sku: catalog.sku,
              name: catalog.name,
              minOrderQty: catalog.minOrderQty,
              stock: catalog.stock,
              unitPrice: catalog.unitPrice,
              variants: catalog.variants,
            }
          : null,
      },
      input.text || 'منو',
    );

    let reply = fsm.reply || BOT_MENU_COPY;
    conv.state = fsm.state;
    conv.statePayload = fsm.statePayload;
    conv.tags = fsm.tags;

    if (fsm.createPfi) {
      try {
        const pfi = await this.createProformaDraftFromConversation(conv);
        if (pfi.invoiceNumber) {
          reply = formatPfiCustomerMessage(pfi.invoiceNumber);
          conv.orderId = null;
          conv.invoiceId = pfi.invoiceId;
          conv.state = 'PFI_CREATED';
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'pfi_failed';
        this.logger.warn(`bot pfi draft failed conv=${conv.id}: ${msg}`);
        if (msg === 'customer_binding_required') {
          reply =
            'سفارش شما ثبت موقت شد. برای صدور پیش‌فاکتور، کارشناس هویت شما را تأیید می‌کند.';
          conv.state = 'SENSITIVE_HOLD';
        } else {
          reply = 'ثبت پیش‌فاکتور با خطا مواجه شد. کارشناس پیگیری می‌کند.';
        }
        fsm.forwardOwner = true;
      }
    }

    conv.autoRepliedAt = now;
    conv.lastOutboundAt = now;
    conv.lastStaffReplyAt = now;
    conv.unansweredSince = null;
    await this.conversations.save(conv);

    await this.messages.save(
      this.messages.create({
        conversationId: conv.id,
        direction: 'outbound',
        bodyPreview: this.safePreview(reply),
        body: maskIranianMobiles(reply).slice(0, 2000),
        provider,
        providerMessageId: null,
        meta: { step: conv.state },
      }),
    );

    await this.trySendCustomerReply(dest, input.connectionId, customerChatId, reply);

    if (fsm.forwardOwner) {
      await this.forwardToOwnerChat(dest, input.connectionId, {
        conversationId: conv.id,
        provider,
        customerChatId,
        state: conv.state,
        preview: this.safePreview(input.text, 120),
      });
    }

    return {
      ok: true,
      conversationId: conv.id,
      state: conv.state,
    };
  }

  private async persistSoftBlockNotice(input: {
    dest: ChannelDestinationEntity;
    connectionId: string;
    provider: string;
    customerChatId: string;
    notice: string;
  }): Promise<void> {
    let conv = await this.conversations.findOne({
      where: {
        destinationId: input.dest.id,
        customerChatId: input.customerChatId,
        status: 'open',
      },
    });
    const now = new Date();
    if (!conv) {
      conv = await this.conversations.save(
        this.conversations.create({
          destinationId: input.dest.id,
          connectionId: input.connectionId,
          provider: input.provider,
          customerChatId: input.customerChatId,
          externalChatId: input.customerChatId,
          state: 'MENU',
          statePayload: {},
          tags: ['spam_flag'],
          lastCustomerMessageAt: now,
          lastInboundAt: now,
          lastOutboundAt: now,
          lastStaffReplyAt: now,
          autoRepliedAt: now,
          status: 'open',
        }),
      );
    } else {
      const tags = Array.isArray(conv.tags) ? [...conv.tags] : [];
      if (!tags.includes('spam_flag')) tags.push('spam_flag');
      conv.tags = tags;
      conv.lastOutboundAt = now;
      conv.lastStaffReplyAt = now;
      await this.conversations.save(conv);
    }
    await this.messages.save(
      this.messages.create({
        conversationId: conv.id,
        direction: 'system',
        bodyPreview: this.safePreview(input.notice),
        body: input.notice.slice(0, 500),
        provider: input.provider,
        providerMessageId: null,
        meta: { softBlock: true },
      }),
    );
    await this.trySendCustomerReply(
      input.dest,
      input.connectionId,
      input.customerChatId,
      input.notice,
    );
  }

  private async hasPriorPfi(
    provider: string,
    customerChatId: string,
    excludeId: string,
  ): Promise<boolean> {
    const prior = await this.conversations
      .createQueryBuilder('c')
      .where('c.provider = :provider', { provider })
      .andWhere('c.customerChatId = :customerChatId', { customerChatId })
      .andWhere('c.id <> :excludeId', { excludeId })
      .andWhere('(c.orderId IS NOT NULL OR c.invoiceId IS NOT NULL OR c.state = :pfi)', {
        pfi: 'PFI_CREATED',
      })
      .take(1)
      .getOne();
    return !!prior;
  }

  /**
   * PROFORMA DRAFT only — never OrderService CREDIT.
   * Phone match links customerId for ops; verifiedCustomerBinding defaults false.
   * Full phone is not stored; last4 alone cannot re-lookup — require masked recovery via ops
   * or ephemeral hash lookup: we look up by reconstructing from inbound only when
   * statePayload still has last4 AND we have a one-shot env allowlist — instead:
   * require customerId already on statePayload from a prior verified path, else
   * look up by phoneLast4 is unsafe. So: use findByPhone only when verifiedCustomerBinding
   * is true AND customerPhoneHash matches; otherwise require customerId on payload.
   *
   * Practical default (security): look up ACTIVE customer only when
   * `statePayload.verifiedCustomerBinding === true` and `customerId` already set;
   * otherwise create draft against a dedicated bot-draft customer is not invented —
   * escalate to owner without invoice if no verified customerId.
   */
  private async createProformaDraftFromConversation(conv: OmnichannelBotConversationEntity): Promise<{
    orderId: string | null;
    invoiceId: string | null;
    invoiceNumber: string | null;
  }> {
    const verified = conv.statePayload?.verifiedCustomerBinding === true;
    const customerId = String(conv.statePayload?.customerId || '').trim();
    if (!verified || !customerId) {
      // Phone-only path: do not create CREDIT order; also skip auto invoice until binding.
      // Persist hold + forward instead of inventing customer.
      throw new Error('customer_binding_required');
    }
    const customer = await this.customers.findOne(customerId).catch(() => null);
    if (!customer || String((customer as { status?: string }).status || '') !== 'ACTIVE') {
      throw new Error('customer_not_active');
    }
    const productId = String(conv.statePayload?.productId || '');
    const sku = String(conv.statePayload?.sku || '');
    let resolvedProductId = productId;
    if (!resolvedProductId && sku) {
      const p = await this.products.findBySku(sku);
      resolvedProductId = String((p as { id?: string })?.id || '');
    }
    if (!resolvedProductId) throw new Error('product_missing');

    const draft = buildBotProformaDraft({
      customerId,
      productId: resolvedProductId,
      productVariantId: (conv.statePayload?.variantId as string) || null,
      qty: Number(conv.statePayload?.qty) || 0,
      minOrderQty: Number(conv.statePayload?.minOrderQty) || 1,
      unitPrice: Number(conv.statePayload?.unitPrice) || 0,
      sku,
      productName: String(conv.statePayload?.productName || sku),
      conversationId: conv.id,
      customerPhoneMasked: String(conv.statePayload?.customerPhoneMasked || ''),
      verifiedCustomerBinding: true,
    });
    const invoice = await this.invoices.create(draft as never);
    return {
      orderId: null,
      invoiceId: String((invoice as { id: string }).id),
      invoiceNumber: String((invoice as { invoiceNumber?: string }).invoiceNumber || ''),
    };
  }

  private async trySendCustomerReply(
    dest: ChannelDestinationEntity,
    connectionId: string,
    customerChatId: string,
    text: string,
  ): Promise<void> {
    const conn = await this.connections.findOne({ where: { id: connectionId } });
    const secretRef = String(conn?.secretRef || '').trim();
    if (!secretRef) return;
    const provider = String(conn?.provider || '').toUpperCase();
    if (provider === 'TELEGRAM') return;
    try {
      const adapter = this.adapters.for(provider);
      await adapter.create({
        secretRef,
        chatId: customerChatId,
        destinationKey: customerChatId,
        text: maskIranianMobiles(text),
        parseMode: 'PLAIN',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`bot outbound failed dest=${dest.id}: ${msg.slice(0, 80)}`);
    }
  }

  private async forwardToOwnerChat(
    dest: ChannelDestinationEntity,
    connectionId: string,
    summary: {
      conversationId: string;
      provider: string;
      customerChatId: string;
      state: string;
      preview: string;
    },
  ): Promise<void> {
    const ownerChatId = ownerChatIdForDestination(dest.publishSettings);
    if (!ownerChatId) {
      this.logger.log(
        `owner_chat_missing conv=${summary.conversationId} provider=${summary.provider}`,
      );
      return;
    }
    const conn = await this.connections.findOne({ where: { id: connectionId } });
    const secretRef = String(conn?.secretRef || '').trim();
    if (!secretRef) return;
    const provider = String(conn?.provider || '').toUpperCase();
    if (provider === 'TELEGRAM') return;
    const chatHint = createHash('sha256')
      .update(`${summary.provider}:${summary.customerChatId}`)
      .digest('hex')
      .slice(0, 8);
    const text =
      `صندوق ربات — ${summary.provider}\n`
      + `گفتگو: ${summary.conversationId}\n`
      + `چت: …${chatHint}\n`
      + `وضعیت: ${summary.state}\n`
      + `پیام: ${maskIranianMobiles(summary.preview)}`;
    try {
      const adapter = this.adapters.for(provider);
      await adapter.create({
        secretRef,
        chatId: ownerChatId,
        destinationKey: ownerChatId,
        text,
        parseMode: 'PLAIN',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`owner forward failed: ${msg.slice(0, 80)}`);
    }
  }
}

/**
 * Owner + goRef required for enable when RBAC on.
 * Live enable still needs OMNICHANNEL_RBAC_ENABLED=true (documented).
 */
export function assertOrderBotEnableAllowed(input: {
  role: string;
  goRef: unknown;
  rbacEnabled: boolean;
}): void {
  if (!String(input.goRef || '').trim()) {
    throw new ForbiddenException('goRef الزامی است');
  }
  if (!input.rbacEnabled) return;
  if (String(input.role || '').toUpperCase() !== 'OWNER') {
    throw new ForbiddenException('فقط Owner می‌تواند ربات سفارش را فعال کند');
  }
}
