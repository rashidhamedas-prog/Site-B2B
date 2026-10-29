import { existsSync, unlinkSync } from 'fs';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hostname } from 'os';
import { Repository } from 'typeorm';
import { CustomerEntity } from '../../customer/entities/customer.entity';
import { OrderEntity } from '../../order/entities/order.entity';
import { ProductEntity } from '../../product/entities/product.entity';
import { VendorEntity } from '../../vendor/entities/vendor.entity';
import { SearchService } from '../../search/search.service';
import { NotificationService } from '../../notification/notification.service';
import { AffiliatePostbackService } from '../../affiliate/affiliate-postback.service';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { OUTBOX_EVENT_TYPES, SALES_PARTNER_OUTBOX_EVENT_TYPES } from '../omnichannel.constants';
import {
  DeliveryDeferredError,
  isConnectorDisabledError,
  isUnconfirmedSendError,
  shouldSkipPublicationDeliver,
} from './publication-deliver';
import { OutboxService } from './outbox.service';
import { ChannelAdapterRegistry } from '../adapters/adapter-registry';
import { isNonRetryableProviderError, safeWorkerError } from '../adapters/telegram-errors';
import { OmnichannelService } from './omnichannel.service';
import { OmnichannelAlertsService } from './omnichannel-alerts.service';
import { OmnichannelTokenVaultService } from './omnichannel-token-vault.service';
import { PHASE4_EVENT_TYPES, shouldDeadLetter } from './outbox-lease';
import {
  decideDrainTick,
  resumeDrainIfCleared,
  shouldKeepDrainPollTimer,
  type DrainOrigin,
} from './outbox-worker-drain';
import {
  heartbeatPath,
  writeProviderGateSnapshot,
  writeWorkerIpcFile,
} from './outbox-worker-provider-gate';
import { CustomerMarketingService } from '../../customer-marketing/customer-marketing.service';
import { MarketingSmsSender } from '../../customer-marketing/marketing-sms.sender';
import { PublicationDeliveryEntity } from '../entities/publication-delivery.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';

const SALES_PARTNER_ACK = new Set<string>(SALES_PARTNER_OUTBOX_EVENT_TYPES);

export function isOmnichannelWorkerProcess(): boolean {
  return process.env.OMNICHANNEL_WORKER === 'true';
}

export {
  decideDrainTick,
  resumeDrainIfCleared,
  shouldKeepDrainPollTimer,
} from './outbox-worker-drain';

/** Default handle budget for non-messenger work. */
const HANDLE_TIMEOUT_MS = 35_000;
/**
 * CREATE/UPDATE with media must outlive Rubika/Bale upload stacks (15s + 30s) so
 * withTimeout does not race a still-running adapter.create into a duplicate RETRY.
 * Ambiguous timeouts still HOLD via isUnconfirmedSendError — never auto-resend.
 */
const HANDLE_TIMEOUT_CREATE_MEDIA_MS = 50_000;

const DRAIN_FLAG = () => process.env.OMNICHANNEL_WORKER_DRAIN || '/tmp/omnichannel-worker.drain';
const DRAINED_FLAG = () => process.env.OMNICHANNEL_WORKER_DRAINED || '/tmp/omnichannel-worker.drained';
/** Soft-drain / SIGTERM wait for in-flight sends (Rubika ~45s; deploy aborts at 120s). */
const DRAIN_WAIT_MS = Number(process.env.OMNICHANNEL_WORKER_DRAIN_WAIT_MS || 120_000);

@Injectable()
export class OutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private readonly workerId = `worker:${hostname()}:${process.pid}`;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  /** When true, do not lease new outbox batches; finish in-flight work then mark drained. */
  private stopping = false;
  /** `file` soft-drain is cancelable; `shutdown` is not. */
  private drainOrigin: DrainOrigin = 'none';

  constructor(
    private readonly outbox: OutboxService,
    private readonly search: SearchService,
    private readonly notifications: NotificationService,
    private readonly affiliate: AffiliatePostbackService,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customers: Repository<CustomerEntity>,
    @InjectRepository(VendorEntity)
    private readonly vendors: Repository<VendorEntity>,
    @InjectRepository(PublicationDeliveryEntity)
    private readonly deliveries: Repository<PublicationDeliveryEntity>,
    @InjectRepository(ChannelDestinationEntity)
    private readonly destinations: Repository<ChannelDestinationEntity>,
    @InjectRepository(ChannelConnectionEntity)
    private readonly connections: Repository<ChannelConnectionEntity>,
    private readonly adapters: ChannelAdapterRegistry,
    private readonly omnichannel: OmnichannelService,
    private readonly tokenVault: OmnichannelTokenVaultService,
    @Optional() private readonly alerts?: OmnichannelAlertsService,
    @Optional() private readonly marketing?: CustomerMarketingService,
    @Optional() private readonly marketingSms?: MarketingSmsSender,
  ) {}

  onModuleInit() {
    if (!isOmnichannelWorkerProcess()) return;
    this.logger.log(`outbox worker started id=${this.workerId}`);
    try {
      unlinkSync(DRAIN_FLAG());
    } catch {
      /* no stale drain request */
    }
    try {
      unlinkSync(DRAINED_FLAG());
    } catch {
      /* no stale drained marker */
    }
    this.beat();
    this.timer = setInterval(() => {
      void this.tick();
    }, 2000);
    void this.tick();
  }

  async onModuleDestroy() {
    this.beginDrain('shutdown');
    await this.waitForIdle(DRAIN_WAIT_MS);
  }

  private beginDrain(reason: 'file' | 'shutdown' | 'inflight-done') {
    const origin: DrainOrigin = reason === 'shutdown' ? 'shutdown' : 'file';
    if (this.drainOrigin === 'shutdown') return;
    if (this.stopping && this.drainOrigin === origin) return;
    this.stopping = true;
    this.drainOrigin = origin;
    // Keep the 2s poll during file soft-drain so cancel (remove drain file) can resume.
    // Shutdown clears the timer — process is exiting and must not resume.
    if (!shouldKeepDrainPollTimer(origin)) {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    } else {
      this.ensurePollTimer();
    }
    this.logger.log(`outbox worker drain start reason=${reason} id=${this.workerId}`);
  }

  /** Cancelable file drain → resume claiming when the drain flag is gone. */
  private applyResumeIfCleared(drainFilePresent: boolean): boolean {
    const decision = resumeDrainIfCleared({
      stopping: this.stopping,
      origin: this.drainOrigin,
      drainFilePresent,
    });
    if (!decision.resume) return false;
    this.stopping = false;
    this.drainOrigin = 'none';
    if (decision.clearDrained) this.clearDrainedMarker();
    this.ensurePollTimer();
    this.logger.log(`outbox worker drain canceled/resumed id=${this.workerId}`);
    return true;
  }

  private ensurePollTimer() {
    if (!isOmnichannelWorkerProcess()) return;
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 2000);
  }

  private drainRequested() {
    try {
      return existsSync(DRAIN_FLAG());
    } catch {
      return false;
    }
  }

  private clearDrainedMarker() {
    try {
      unlinkSync(DRAINED_FLAG());
    } catch {
      /* already absent */
    }
  }

  private markDrained() {
    try {
      writeWorkerIpcFile(DRAINED_FLAG(), String(Date.now()));
    } catch {
      /* best-effort marker for deploy script */
    }
  }

  private async waitForIdle(maxMs: number) {
    const deadline = Date.now() + maxMs;
    while (this.running && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!this.running) this.markDrained();
    else this.logger.warn(`outbox worker drain timeout after ${maxMs}ms id=${this.workerId}`);
  }

  private beat() {
    try {
      writeWorkerIpcFile(heartbeatPath(), String(Date.now()));
    } catch {
      /* heartbeat is best-effort */
    }
    writeProviderGateSnapshot(this.workerId);
  }

  async tick() {
    const drainFilePresent = this.drainRequested();
    const decision = decideDrainTick({
      stopping: this.stopping,
      origin: this.drainOrigin,
      drainFilePresent,
      running: this.running,
    });
    if (decision.resume) {
      this.applyResumeIfCleared(drainFilePresent);
    } else if (decision.beginFileDrain) {
      this.beginDrain('file');
    } else if (decision.nextOrigin === 'file' && this.drainOrigin !== 'file') {
      this.drainOrigin = 'file';
    }
    if (decision.skipClaim || this.stopping) {
      if (decision.markDrained || (this.stopping && !this.running)) this.markDrained();
      return;
    }
    if (this.running) return;
    this.running = true;
    this.beat();
    try {
      // PR-13 unanswered scan (rate-limited inside service; no-op when empty).
      try {
        await this.alerts?.maybeScanFromWorker();
      } catch (scanErr: unknown) {
        this.logger.warn(
          `unanswered alert scan failed: ${scanErr instanceof Error ? scanErr.message : String(scanErr)}`,
        );
      }
      await this.tokenVault.refreshIfStale();
      const batch = await this.outbox.leaseBatch(this.workerId, 20);
      for (const row of batch) {
        try {
          const handleMs = row.eventType === OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED
            ? HANDLE_TIMEOUT_CREATE_MEDIA_MS
            : HANDLE_TIMEOUT_MS;
          await this.withTimeout(
            this.handle(row),
            handleMs,
            `outbox ${row.eventType} ${row.id}`,
          );
          await this.outbox.markDone(row.id);
        } catch (err: unknown) {
          if (err instanceof DeliveryDeferredError) {
            // Gate defers before claim; if a row were PROCESSING, restore PENDING without burning attempts.
            await this.releaseProcessingDelivery(row.id);
            await this.outbox.releaseDeferred(row.id, err.availableAt);
          } else if (
            row.eventType === OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED
            && isUnconfirmedSendError(err)
          ) {
            await this.omnichannel.markCreateUnconfirmed(row.id);
            await this.outbox.markDone(row.id);
            this.logger.warn(`outbox ${row.eventType} ${row.id} unconfirmed send → HOLD`);
          } else {
            const message = safeWorkerError(err);
            const forceDead = isNonRetryableProviderError(err);
            this.logger.warn(
              `outbox ${row.eventType} ${row.id} failed: ${message}${forceDead ? ' (non-retryable → DEAD)' : ''}`,
            );
            await this.outbox.markFailure(row, message, { forceDead });
          }
        }
        this.beat();
      }
    } catch (err: unknown) {
      this.logger.warn(`outbox lease failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
      this.beat();
      if (this.drainRequested()) {
        this.beginDrain(this.stopping ? 'inflight-done' : 'file');
        this.markDrained();
      } else if (this.stopping && this.drainOrigin === 'file') {
        // Deploy aborted (drain flag removed) while this tick finished — resume.
        this.applyResumeIfCleared(false);
      } else if (this.stopping && this.drainOrigin === 'shutdown') {
        this.markDrained();
      }
    }
  }

  private async withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Leave PROCESSING after a soft defer so the next lease can reclaim without a duplicate create. */
  private async releaseProcessingDelivery(eventId: string): Promise<void> {
    if (!eventId) return;
    try {
      await this.deliveries.query(
        `UPDATE "omnichannel_publication_deliveries"
         SET status = 'PENDING', "updatedAt" = NOW()
         WHERE "eventId" = $1 AND action = 'CREATE' AND status = 'PROCESSING' AND "supersededAt" IS NULL`,
        [eventId],
      );
    } catch {
      /* bookkeeping best-effort */
    }
  }

  async handle(row: OutboxEventEntity): Promise<void> {
    const payload = (row.payload || {}) as Record<string, unknown>;
    switch (row.eventType) {
      case OUTBOX_EVENT_TYPES.SEARCH_REINDEX_REQUESTED:
        await this.handleSearch(String(payload.productId || row.aggregateId));
        return;
      case OUTBOX_EVENT_TYPES.PRODUCT_STOCK_CHANGED:
        await this.omnichannel.syncProductPublications(String(payload.productId || row.aggregateId), row.channel, row.eventType);
        await this.handleSearch(String(payload.productId || row.aggregateId));
        return;
      case OUTBOX_EVENT_TYPES.ORDER_CREATED_NOTIFICATION:
        await this.handleOrderCreated(String(payload.orderId || row.aggregateId), row.channel);
        return;
      case OUTBOX_EVENT_TYPES.ORDER_STATUS_CHANGED_NOTIFICATION:
        await this.handleOrderStatus(String(payload.orderId || row.aggregateId), String(payload.status || ''));
        return;
      case OUTBOX_EVENT_TYPES.FULFILLMENT_PENDING_ACCEPT_NOTIFICATION:
        await this.handleFulfillmentPendingAccept(payload, row.aggregateId);
        return;
      case OUTBOX_EVENT_TYPES.FULFILLMENT_SHIPPED_NOTIFICATION:
        await this.handleFulfillmentShipped(payload, row.aggregateId);
        return;
      case OUTBOX_EVENT_TYPES.CUSTOMER_REGISTERED_MARKETING:
        if (this.marketing) await this.marketing.handleRegisteredEvent(String(payload.customerId || row.aggregateId));
        return;
      case OUTBOX_EVENT_TYPES.CUSTOMER_APPROVED_MARKETING:
        if (this.marketing) await this.marketing.handleApprovedEvent(String(payload.customerId || row.aggregateId));
        return;
      case OUTBOX_EVENT_TYPES.MARKETING_SEND_REQUESTED:
        if (this.marketingSms) await this.marketingSms.deliverById(String(payload.sendId || row.aggregateId));
        return;
      case OUTBOX_EVENT_TYPES.MARKETING_CAMPAIGN_DISPATCH:
        if (this.marketing) await this.marketing.dispatchCampaign(String(payload.campaignId || row.aggregateId));
        return;
      case OUTBOX_EVENT_TYPES.AFFILIATE_POSTBACK_REQUESTED:
        await this.affiliate.deliverForOrder(
          String(payload.orderId || row.aggregateId),
          (payload.status as 'paid' | 'pending' | 'cancelled') || 'paid',
        );
        return;
      case OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED:
        if (shouldSkipPublicationDeliver()) throw new DeliveryDeferredError();
        try {
          await this.handlePublicationDeliver(payload, row.id);
        } catch (err: unknown) {
          if (err instanceof DeliveryDeferredError) throw err;
          if (isConnectorDisabledError(err)) throw new DeliveryDeferredError();
          await this.markDeliveryFailure(payload, row, err);
          throw err;
        }
        return;
      default:
        // Audit already persisted at emit time; ACK so rows do not sit PENDING forever
        // or appear as stuck «تکی» messenger work in the publish console.
        if (SALES_PARTNER_ACK.has(row.eventType) || row.eventType.startsWith('sales_partner.')) {
          return;
        }
        if (row.eventType === OUTBOX_EVENT_TYPES.BLOG_PUBLISHED) {
          await this.omnichannel.syncBlogPublications(String(payload.postId || row.aggregateId), row.channel);
          return;
        }
        if (row.eventType === OUTBOX_EVENT_TYPES.CMS_PUBLISHED) {
          await this.omnichannel.syncCmsPublications(String(payload.pageId || row.aggregateId), row.channel);
          return;
        }
        if ((PHASE4_EVENT_TYPES as readonly string[]).includes(row.eventType)) {
          await this.omnichannel.syncProductPublications(String(payload.productId || row.aggregateId), row.channel, row.eventType);
          return;
        }
        throw new Error(`unhandled eventType ${row.eventType}`);
    }
  }

  private async handleSearch(productId: string) {
    const product = await this.products.findOne({ where: { id: productId }, withDeleted: true });
    if (!product || product.deletedAt) {
      await this.search.removeProduct(productId);
      return;
    }
    await this.search.indexProduct({
      id: product.id,
      sku: product.sku,
      name: product.name,
      fabric: product.fabric || '',
      description: product.description || undefined,
      status: product.status,
      isFeatured: !!product.isDiscounted,
      isNew: false,
    });
  }

  private findOrderById(orderId: string) {
    return this.orders
      .createQueryBuilder('o')
      .where('o.id::text = :id', { id: String(orderId) })
      .getOne();
  }

  private findCustomerById(customerId: string) {
    return this.customers
      .createQueryBuilder('c')
      .where('c.id::text = :id', { id: String(customerId) })
      .getOne();
  }

  private async handleOrderCreated(orderId: string, channel: string | null) {
    const order = await this.findOrderById(orderId);
    if (!order) return;
    if (order.status === 'AWAITING_PAYMENT') return;
    const customer = order.customerId ? await this.findCustomerById(order.customerId) : null;
    const phone = customer && typeof (customer as { phone?: string }).phone === 'string'
      ? (customer as { phone: string }).phone
      : '';
    if (phone) {
      await this.notifications.orderRegistered(phone, order.orderNumber);
    }
    if (this.marketing && order.customerId) {
      // Marketing must not DEAD-letter transactional order SMS if a uuid bind slips.
      await this.marketing.completeCheckoutIntent(order.customerId, order.id).catch(() => undefined);
      await this.marketing.evaluateCustomer(order.customerId).catch(() => undefined);
    }
    const ch = String(channel || '').toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    const label =
      (customer as { businessName?: string; ownerName?: string } | null)?.businessName ||
      (customer as { ownerName?: string } | null)?.ownerName ||
      undefined;
    await this.notifications.orderRegisteredAdmin(ch, order.orderNumber, label);
  }

  private async handleOrderStatus(orderId: string, status: string) {
    // Cast uuid columns via findOrderById / findCustomerById — plain findOne(id: string)
    // raises Postgres `operator does not exist: uuid = character varying` and DEAD-letters SMS.
    const order = await this.findOrderById(orderId);
    if (!order?.customerId) return;
    const customer = await this.findCustomerById(order.customerId);
    const phone = customer && typeof (customer as { phone?: string }).phone === 'string'
      ? (customer as { phone: string }).phone
      : '';
    if (!phone) return;
    if (status === 'CONFIRMED') {
      await this.notifications.orderConfirmed(phone, order.orderNumber);
    } else if (status === 'SHIPPED') {
      await this.notifications.orderShipped(phone, order.orderNumber, order.trackingCode);
    }
    if (this.marketing && order.customerId) {
      await this.marketing.evaluateCustomer(order.customerId).catch(() => undefined);
    }
  }

  private async handleFulfillmentPendingAccept(
    payload: Record<string, unknown>,
    aggregateId: string,
  ) {
    const vendorId = String(payload.vendorId || '');
    if (!vendorId) return;
    const vendor = await this.vendors.findOne({ where: { id: vendorId } });
    const phone = vendor?.phone ? String(vendor.phone).trim() : '';
    if (!phone) {
      this.logger.warn(`fulfillment notify skipped — no phone vendorId=${vendorId}`);
      return;
    }
    const orderNumber = String(payload.orderNumber || '');
    if (!orderNumber) {
      this.logger.warn(`fulfillment notify skipped — missing orderNumber aggregate=${aggregateId}`);
      return;
    }
    const rawSla = payload.acceptSlaHours;
    const slaHours =
      rawSla != null && Number.isFinite(Number(rawSla)) ? Math.floor(Number(rawSla)) : null;
    await this.notifications.fulfillmentPendingAccept(phone, {
      orderNumber,
      slaHours,
      partnersUrl: 'poshaktaranom.com/partners',
    });
  }

  private async handleFulfillmentShipped(
    payload: Record<string, unknown>,
    aggregateId: string,
  ) {
    const orderId = String(payload.orderId || '');
    const orderNumber = String(payload.orderNumber || '');
    const trackingCode = String(payload.trackingCode || '').trim();
    const parcelLabel = String(payload.parcelLabel || 'مرسوله');
    if (!orderId || !orderNumber || !trackingCode) {
      this.logger.warn(`fulfillment shipped notify skipped aggregate=${aggregateId}`);
      return;
    }
    const order = await this.findOrderById(orderId);
    if (!order?.customerId) return;
    const customer = await this.findCustomerById(order.customerId);
    const phone =
      customer && typeof (customer as { phone?: string }).phone === 'string'
        ? (customer as { phone: string }).phone
        : '';
    if (!phone) return;
    await this.notifications.fulfillmentShipped(phone, {
      orderNumber,
      parcelLabel,
      trackingCode,
    });
  }

  private async findDelivery(payload: Record<string, unknown>, eventId: string) {
    const deliveryId = String(payload.deliveryId || '');
    if (deliveryId) return this.deliveries.findOne({ where: { id: deliveryId } });
    const byEvent = eventId ? await this.deliveries.findOne({ where: { eventId } }) : null;
    if (byEvent) return byEvent;
    return this.deliveries.findOne({
      where: {
        destinationId: String(payload.destinationId || ''),
        publicationId: String(payload.publicationId || ''),
        action: String(payload.action || 'CREATE').toUpperCase(),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** Mirror outbox failures onto the delivery row so the console shows why a post did not land. */
  private async markDeliveryFailure(payload: Record<string, unknown>, event: OutboxEventEntity, err: unknown) {
    try {
      const row = await this.findDelivery(payload, event.id);
      if (!row || row.status === 'SUCCEEDED' || row.status === 'HOLD') return;
      const dead = shouldDeadLetter(event.attempts, event.maxAttempts, {
        forceDead: isNonRetryableProviderError(err),
      });
      row.status = dead ? 'DEAD' : 'RETRY';
      row.attempts = Number(event.attempts || 0);
      row.lastError = safeWorkerError(err);
      await this.deliveries.save(row);
    } catch {
      /* delivery bookkeeping is best-effort; the outbox row still carries the error */
    }
  }

  private async handlePublicationDeliver(payload: Record<string, unknown>, eventId = '') {
    const destinationId = String(payload.destinationId || '');
    const action = String(payload.action || 'CREATE').toUpperCase();
    const dest = await this.destinations.findOne({ where: { id: destinationId } });
    if (!dest) {
      throw new Error(`publication deliver missing destination ${destinationId || '(empty)'}`);
    }
    const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
    if (!conn) {
      throw new Error(`publication deliver missing connection for destination ${destinationId}`);
    }
    if (!this.adapters.has(conn.provider)) {
      throw new Error(`publication deliver has no adapter for provider ${conn.provider}`);
    }
    const adapter = this.adapters.for(conn.provider);
    const input = {
      secretRef: conn.secretRef,
      destinationKey: dest.destinationKey,
      chatId: dest.destinationKey,
      channel: String(payload.channel || conn.channel || 'RETAIL'),
      text: String(payload.text || ''),
      photoUrls: payload.photoUrls,
      providerMessageId: String(payload.providerMessageId || ''),
      parseMode: payload.parseMode,
      buttons: payload.buttons,
      silent: payload.silent,
      protectContent: payload.protectContent,
      captionAbove: payload.captionAbove,
      linkPreview: payload.linkPreview,
    };
    const publicationIdEarly = String(payload.publicationId || '');
    if (
      (action === 'CREATE' || action === 'UPDATE')
      && publicationIdEarly
      && await this.omnichannel.isPublicationWithdrawn(publicationIdEarly)
    ) {
      const withdrawn = await this.findDelivery(payload, eventId);
      if (withdrawn && withdrawn.status !== 'SUCCEEDED') {
        withdrawn.status = 'DEAD';
        withdrawn.lastError = 'publication_withdrawn';
        await this.deliveries.save(withdrawn);
      }
      return;
    }
    if (action === 'CREATE') {
      const gate = await this.omnichannel.reserveCreateSend({
        eventId,
        destinationId,
        connectionId: conn.id,
        provider: conn.provider,
        channel: String(payload.channel || conn.channel || 'RETAIL'),
      });
      if (gate.kind === 'stop') return;
      if (gate.kind === 'defer') {
        throw new DeliveryDeferredError(gate.message, gate.availableAt, gate.reason);
      }
    }
    let providerMessageId: string | undefined;
    let deliveryWarnings: string[] = [];
    if (action === 'UPDATE') {
      try {
        providerMessageId = (await adapter.update(input)).providerMessageId;
      } catch (err: unknown) {
        // Telegram/Bale reject identical edits with "message is not modified"; that is a successful no-op.
        if (!(err instanceof Error && err.message === 'duplicate')) throw err;
        providerMessageId = input.providerMessageId || undefined;
      }
    } else if (action === 'DELETE') {
      await adapter.delete(input);
      const deletedPublicationId = String(payload.publicationId || '');
      if (deletedPublicationId) {
        // PR-7: supersede + mark CREATE WITHDRAWN + delivery_messages.deletedAt
        await this.omnichannel.onRemoteDeleteSucceeded({
          publicationId: deletedPublicationId,
          destinationId,
          providerMessageId: String(payload.providerMessageId || input.providerMessageId || ''),
          createDeliveryId: payload.createDeliveryId ? String(payload.createDeliveryId) : null,
        });
      }
    } else {
      try {
        const created = await adapter.create(input);
        providerMessageId = created.providerMessageId;
        deliveryWarnings = Array.isArray(created.warnings) ? created.warnings.map(String) : [];
      } catch (err: unknown) {
        if (isConnectorDisabledError(err)) throw err;
        if (isUnconfirmedSendError(err)) {
          await this.omnichannel.markCreateUnconfirmed(eventId);
          return;
        }
        throw err;
      }
    }
    const row = await this.findDelivery(payload, eventId);
    if (!row) {
      // Adapter already ran — must not throw/retry (duplicate messenger posts). ACK outbox.
      this.logger.error(
        `publication deliver missing delivery row after ${action} (event ${eventId || 'n/a'}, dest ${destinationId})`,
      );
      return;
    }
    if (deliveryWarnings.length) {
      this.logger.warn(
        `publication deliver ${row.id} warnings: ${deliveryWarnings.join(' | ')}`.slice(0, 500),
      );
    }
    if (action === 'CREATE') {
      const saved = await this.omnichannel.markCreateSucceeded(
        row.id,
        providerMessageId || row.providerMessageId,
        deliveryWarnings,
      );
      if (!saved) return;
    } else {
      row.status = 'SUCCEEDED';
      row.sentAt = new Date();
      row.providerMessageId = providerMessageId || row.providerMessageId;
      row.lastError = deliveryWarnings.length
        ? `warnings:${deliveryWarnings.join('|')}`.slice(0, 2000)
        : null;
      row.deferredReason = null;
      await this.deliveries.save(row);
    }
    const publicationId = String(payload.publicationId || row.publicationId || '');
    if (publicationId && action === 'CREATE') {
      await this.omnichannel.markPublicationDelivered(publicationId);
    }
    if (publicationId && String(payload.sourceType || '') === 'FREE_POST') {
      try {
        await this.omnichannel.recordFreePostDelivery({
          publicationId,
          destinationId,
          providerMessageId: providerMessageId || row.providerMessageId,
          action,
        });
      } catch {
        this.logger.warn(`free post delivery audit skipped publication=${publicationId}`);
      }
    }
  }
}
