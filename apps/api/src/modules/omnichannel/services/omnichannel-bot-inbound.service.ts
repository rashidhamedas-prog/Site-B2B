/**
 * PR-14 order-bot inbound: secret-validated ingest → idempotent persist → FSM → optional PFI.
 * Bots default OFF; never invent chat IDs; never DM Hamed personally (ownerChatId only).
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
  inboundIdempotencyKey,
} from '../bots/bot-inbound-idempotency';
import { checkBotRateLimit } from '../bots/bot-rate-limit';
import { transitionBotOrderFsm, BOT_MENU_COPY, parseStartSku } from '../bots/bot-order-fsm';
import { projectBotCatalog } from '../bots/bot-catalog';
import {
  buildBotOrderPayload,
  buildBotProformaPayload,
  formatPfiCustomerMessage,
} from '../bots/bot-pfi';
import { readOrderBotEnabled } from '../bots/bot-order-enabled';
import {
  isOmnichannelOrderBotBaleEnabled,
  isOmnichannelOrderBotRubikaEnabled,
  isOmnichannelOrderBotTelegramEnabled,
} from '../omnichannel.constants';
import { truncateBodyPreview, BODY_PREVIEW_MAX } from '../unanswered-alert-policy';
import { ProductService } from '../../product/product.service';
import { CustomerService } from '../../customer/customer.service';
import { OrderService } from '../../order/order.service';
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
    private readonly orders: OrderService,
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
    if (!got || got !== expected) {
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
    const nm = update.new_message as Record<string, unknown> | undefined;
    const text = String(nm?.text || update.text || '').trim();
    const providerMessageId = extractRubikaMessageId(update);
    return this.processInbound({
      provider: 'RUBIKA',
      connectionId: conn.id,
      customerChatId: chatId,
      text,
      providerMessageId,
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
    const conn = await this.findOrderBotConnection(provider);
    if (!conn) return { ok: true, ignored: 'no_enabled_connection' };
    if (!readOrderBotEnabled(conn.publishSettings)) {
      return { ok: true, ignored: 'order_bot_disabled' };
    }
    return this.processInbound({
      provider,
      connectionId: conn.id,
      customerChatId: parsed.customerChatId,
      text: parsed.text,
      providerMessageId: parsed.providerMessageId,
    });
  }

  private parseBaleUpdate(body: unknown): {
    customerChatId: string;
    text: string;
    providerMessageId: string | null;
  } | null {
    if (!body || typeof body !== 'object') return null;
    const u = body as Record<string, unknown>;
    const msg = (u.message || u.edited_message) as Record<string, unknown> | undefined;
    const chat = msg?.chat as Record<string, unknown> | undefined;
    const chatId = chat?.id != null ? String(chat.id) : '';
    if (!chatId) return null;
    return {
      customerChatId: chatId,
      text: String(msg?.text || '').trim(),
      providerMessageId: extractTelegramFamilyMessageId(body),
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
    // Prefer destination marked canary in settings; else first.
    return dests.find((d) => d.settings?.isCanary === true) || dests[0] || null;
  }

  async processInbound(input: {
    provider: string;
    connectionId: string;
    customerChatId: string;
    text: string;
    providerMessageId: string | null;
    destinationId?: string;
  }): Promise<InboundProcessResult> {
    const provider = String(input.provider || '').toUpperCase();
    const customerChatId = String(input.customerChatId || '').trim();
    if (!customerChatId) return { ok: false, ignored: 'missing_chat' };

    const rate = checkBotRateLimit({ provider, customerChatId });
    if (!rate.allowed) {
      // Persist soft notice without advancing when possible — still update timestamps lightly.
      return { ok: true, ignored: 'rate_limited' };
    }

    const key = inboundIdempotencyKey(provider, input.providerMessageId);
    if (key) {
      const existing = await this.messages.findOne({
        where: { provider: key.provider, providerMessageId: key.providerMessageId },
      });
      if (existing) {
        return { ok: true, duplicate: true, conversationId: existing.conversationId };
      }
    }

    const dest =
      (input.destinationId
        ? await this.destinations.findOne({ where: { id: input.destinationId } })
        : null)
      || (await this.findDestinationForConnection(input.connectionId));
    if (!dest) return { ok: false, ignored: 'destination_missing' };

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

    await this.messages.save(
      this.messages.create({
        conversationId: conv.id,
        direction: 'inbound',
        bodyPreview: truncateBodyPreview(input.text, BODY_PREVIEW_MAX),
        body: String(input.text || '').slice(0, 2000),
        provider,
        providerMessageId: key?.providerMessageId ?? null,
        meta: null,
      }),
    );

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
        const pfi = await this.createPfiFromConversation(conv);
        if (pfi.invoiceNumber) {
          reply = formatPfiCustomerMessage(pfi.invoiceNumber);
          conv.orderId = pfi.orderId;
          conv.invoiceId = pfi.invoiceId;
          conv.state = 'PFI_CREATED';
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'pfi_failed';
        this.logger.warn(`bot pfi failed conv=${conv.id}: ${msg}`);
        reply = 'ثبت پیش‌فاکتور با خطا مواجه شد. کارشناس پیگیری می‌کند.';
        fsm.forwardOwner = true;
      }
    }

    conv.autoRepliedAt = now;
    conv.lastOutboundAt = now;
    // Auto-reply counts as staff for unanswered scanner (SLA < 60s).
    conv.lastStaffReplyAt = now;
    conv.unansweredSince = null;
    await this.conversations.save(conv);

    await this.messages.save(
      this.messages.create({
        conversationId: conv.id,
        direction: 'outbound',
        bodyPreview: truncateBodyPreview(reply, BODY_PREVIEW_MAX),
        body: reply.slice(0, 2000),
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
        preview: truncateBodyPreview(input.text, 120),
      });
    }

    return {
      ok: true,
      conversationId: conv.id,
      state: conv.state,
    };
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

  private async createPfiFromConversation(conv: OmnichannelBotConversationEntity): Promise<{
    orderId: string | null;
    invoiceId: string | null;
    invoiceNumber: string | null;
  }> {
    const phone = String(conv.statePayload?.customerPhone || '').trim();
    if (!phone) throw new Error('customer_phone_missing');
    const customer = await this.customers.findByPhone(phone);
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

    const orderPayload = buildBotOrderPayload({
      customerId: String((customer as { id: string }).id),
      productId: resolvedProductId,
      productVariantId: (conv.statePayload?.variantId as string) || null,
      qty: Number(conv.statePayload?.qty) || 0,
      minOrderQty: Number(conv.statePayload?.minOrderQty) || 1,
      unitPrice: Number(conv.statePayload?.unitPrice) || 0,
      sku,
      productName: String(conv.statePayload?.productName || sku),
      conversationId: conv.id,
      customerPhoneMasked: String(conv.statePayload?.customerPhoneMasked || ''),
    });

    const order = await this.orders.create(orderPayload as never);
    const subtotal = Number((order as { total?: number; subtotal?: number }).subtotal
      ?? (order as { total?: number }).total
      ?? 0);
    const invPayload = buildBotProformaPayload({
      customerId: orderPayload.customerId,
      orderId: String((order as { id: string }).id),
      subtotal,
      conversationId: conv.id,
    });
    const invoice = await this.invoices.create(invPayload as never);
    return {
      orderId: String((order as { id: string }).id),
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
    if (provider === 'TELEGRAM') return; // no Telegram egress change / live send from stub
    try {
      const adapter = this.adapters.for(provider);
      await adapter.create({
        secretRef,
        chatId: customerChatId,
        destinationKey: customerChatId,
        text,
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
    const text =
      `صندوق ربات — ${summary.provider}\n`
      + `گفتگو: ${summary.conversationId}\n`
      + `وضعیت: ${summary.state}\n`
      + `پیام: ${summary.preview}`;
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

/** Thrown when PATCH order-bot lacks Owner goRef under RBAC. */
export function assertOrderBotEnableAllowed(input: {
  role: string;
  goRef: unknown;
  rbacEnabled: boolean;
}): void {
  if (!input.rbacEnabled) return;
  if (String(input.role || '').toUpperCase() !== 'OWNER') {
    throw new ForbiddenException('فقط Owner می‌تواند ربات سفارش را فعال کند');
  }
  if (!String(input.goRef || '').trim()) {
    throw new ForbiddenException('goRef الزامی است');
  }
}
