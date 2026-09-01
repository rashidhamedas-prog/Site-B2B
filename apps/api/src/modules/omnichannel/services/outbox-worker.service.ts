import { writeFileSync } from 'fs';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hostname } from 'os';
import { Repository } from 'typeorm';
import { CustomerEntity } from '../../customer/entities/customer.entity';
import { OrderEntity } from '../../order/entities/order.entity';
import { ProductEntity } from '../../product/entities/product.entity';
import { SearchService } from '../../search/search.service';
import { NotificationService } from '../../notification/notification.service';
import { AffiliatePostbackService } from '../../affiliate/affiliate-postback.service';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { OUTBOX_EVENT_TYPES } from '../omnichannel.constants';
import { DeliveryDeferredError, shouldSkipPublicationDeliver } from './publication-deliver';
import { OutboxService } from './outbox.service';
import { TelegramAdapter } from '../adapters/telegram.adapter';
import { safeWorkerError } from '../adapters/telegram-errors';
import { OmnichannelService } from './omnichannel.service';
import { PHASE4_EVENT_TYPES } from './outbox-lease';
import { PublicationDeliveryEntity } from '../entities/publication-delivery.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';

export function isOmnichannelWorkerProcess(): boolean {
  return process.env.OMNICHANNEL_WORKER === 'true';
}

const HANDLE_TIMEOUT_MS = 15_000;

@Injectable()
export class OutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private readonly workerId = `worker:${hostname()}:${process.pid}`;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

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
    @InjectRepository(PublicationDeliveryEntity)
    private readonly deliveries: Repository<PublicationDeliveryEntity>,
    @InjectRepository(ChannelDestinationEntity)
    private readonly destinations: Repository<ChannelDestinationEntity>,
    @InjectRepository(ChannelConnectionEntity)
    private readonly connections: Repository<ChannelConnectionEntity>,
    private readonly telegram: TelegramAdapter,
    private readonly omnichannel: OmnichannelService,
  ) {}

  onModuleInit() {
    if (!isOmnichannelWorkerProcess()) return;
    this.logger.log(`outbox worker started id=${this.workerId}`);
    this.beat();
    this.timer = setInterval(() => {
      void this.tick();
    }, 2000);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private beat() {
    try {
      writeFileSync(
        process.env.OMNICHANNEL_WORKER_HEARTBEAT || '/tmp/omnichannel-worker.heartbeat',
        String(Date.now()),
      );
    } catch {
      /* heartbeat is best-effort */
    }
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    this.beat();
    try {
      const batch = await this.outbox.leaseBatch(this.workerId, 20);
      for (const row of batch) {
        try {
          await this.withTimeout(
            this.handle(row),
            HANDLE_TIMEOUT_MS,
            `outbox ${row.eventType} ${row.id}`,
          );
          await this.outbox.markDone(row.id);
        } catch (err: unknown) {
          if (err instanceof DeliveryDeferredError) {
            await this.outbox.releaseDeferred(row.id);
          } else {
            const message = safeWorkerError(err);
            this.logger.warn(`outbox ${row.eventType} ${row.id} failed: ${message}`);
            await this.outbox.markFailure(row, message);
          }
        }
        this.beat();
      }
    } catch (err: unknown) {
      this.logger.warn(`outbox lease failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
      this.beat();
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

  async handle(row: OutboxEventEntity): Promise<void> {
    const payload = (row.payload || {}) as Record<string, unknown>;
    switch (row.eventType) {
      case OUTBOX_EVENT_TYPES.SEARCH_REINDEX_REQUESTED:
        await this.handleSearch(String(payload.productId || row.aggregateId));
        return;
      case OUTBOX_EVENT_TYPES.PRODUCT_STOCK_CHANGED:
        await this.omnichannel.syncProductPublications(String(payload.productId || row.aggregateId), row.channel);
        await this.handleSearch(String(payload.productId || row.aggregateId));
        return;
      case OUTBOX_EVENT_TYPES.ORDER_CREATED_NOTIFICATION:
        await this.handleOrderCreated(String(payload.orderId || row.aggregateId), row.channel);
        return;
      case OUTBOX_EVENT_TYPES.ORDER_STATUS_CHANGED_NOTIFICATION:
        await this.handleOrderStatus(String(payload.orderId || row.aggregateId), String(payload.status || ''));
        return;
      case OUTBOX_EVENT_TYPES.AFFILIATE_POSTBACK_REQUESTED:
        await this.affiliate.deliverForOrder(
          String(payload.orderId || row.aggregateId),
          (payload.status as 'paid' | 'pending' | 'cancelled') || 'paid',
        );
        return;
      case OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED:
        if (shouldSkipPublicationDeliver()) throw new DeliveryDeferredError();
        await this.handlePublicationDeliver(payload);
        return;
      default:
        if (row.eventType === OUTBOX_EVENT_TYPES.BLOG_PUBLISHED) {
          await this.omnichannel.syncBlogPublications(String(payload.postId || row.aggregateId), row.channel);
          return;
        }
        if (row.eventType === OUTBOX_EVENT_TYPES.CMS_PUBLISHED) {
          await this.omnichannel.syncCmsPublications(String(payload.pageId || row.aggregateId), row.channel);
          return;
        }
        if ((PHASE4_EVENT_TYPES as readonly string[]).includes(row.eventType)) {
          await this.omnichannel.syncProductPublications(String(payload.productId || row.aggregateId), row.channel);
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

  private async handleOrderCreated(orderId: string, channel: string | null) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) return;
    const customer = order.customerId
      ? await this.customers.findOne({ where: { id: order.customerId } })
      : null;
    const phone = customer && typeof (customer as { phone?: string }).phone === 'string'
      ? (customer as { phone: string }).phone
      : '';
    if (phone) {
      await this.notifications.orderRegistered(phone, order.orderNumber);
    }
    const ch = String(channel || '').toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    const label =
      (customer as { businessName?: string; ownerName?: string } | null)?.businessName ||
      (customer as { ownerName?: string } | null)?.ownerName ||
      undefined;
    await this.notifications.orderRegisteredAdmin(ch, order.orderNumber, label);
  }

  private async handleOrderStatus(orderId: string, status: string) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order?.customerId) return;
    const customer = await this.customers.findOne({ where: { id: order.customerId } });
    const phone = customer && typeof (customer as { phone?: string }).phone === 'string'
      ? (customer as { phone: string }).phone
      : '';
    if (!phone) return;
    if (status === 'CONFIRMED') {
      await this.notifications.orderConfirmed(phone, order.orderNumber);
    } else if (status === 'SHIPPED') {
      await this.notifications.orderShipped(phone, order.orderNumber, order.trackingCode);
    }
  }

  private async handlePublicationDeliver(payload: Record<string, unknown>) {
    const destinationId = String(payload.destinationId || '');
    const action = String(payload.action || 'CREATE').toUpperCase();
    const dest = await this.destinations.findOne({ where: { id: destinationId } });
    if (!dest) return;
    const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
    if (!conn || conn.provider !== 'TELEGRAM') return;
    const input = {
      secretRef: conn.secretRef,
      destinationKey: dest.destinationKey,
      chatId: dest.destinationKey,
      text: String(payload.text || ''),
      providerMessageId: String(payload.providerMessageId || ''),
    };
    let providerMessageId: string | undefined;
    if (action === 'UPDATE') {
      providerMessageId = (await this.telegram.update(input)).providerMessageId;
    } else if (action === 'DELETE') {
      await this.telegram.delete(input);
    } else {
      providerMessageId = (await this.telegram.create(input)).providerMessageId;
    }
    const deliveryId = String(payload.deliveryId || '');
    const row = deliveryId
      ? await this.deliveries.findOne({ where: { id: deliveryId } })
      : await this.deliveries.findOne({
          where: { destinationId, publicationId: String(payload.publicationId || ''), action },
        });
    if (!row) return;
    row.status = 'SUCCEEDED';
    row.providerMessageId = providerMessageId || row.providerMessageId;
    row.lastError = null;
    await this.deliveries.save(row);
  }
}
