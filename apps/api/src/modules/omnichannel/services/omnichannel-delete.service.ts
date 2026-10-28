import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ProductEntity } from '../../product/entities/product.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';
import { OmnichannelDeliveryMessageEntity } from '../entities/omnichannel-delivery-message.entity';
import { OmnichannelPostBackupEntity } from '../entities/omnichannel-post-backup.entity';
import { PublicationDeliveryEntity } from '../entities/publication-delivery.entity';
import { PublicationEntity } from '../entities/publication.entity';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { FREE_POST_SOURCE_TYPE } from '../free-post';
import { areOmnichannelConnectorsEnabled } from '../omnichannel.constants';
import { assertNoPlaintextSecrets } from '../omnichannel-secrets';
import {
  DELETE_EDIT_DISABLED_MESSAGE,
  assertDeleteEditEnabled,
  assertOwnerGoRefForDelete,
  type DeleteEditActor,
} from '../omnichannel-delete-edit-rbac';
import {
  assertFullAlbumDelete,
  baleDeleteWindowExpired,
  joinProviderMessageIds,
  parseProviderMessageIds,
} from '../provider-message-ids';
import { buildIdempotencyKey as buildDeliveryIdempotencyKey } from '../delivery-idempotency';
import { OmnichannelService } from './omnichannel.service';

export type DeletePlanMessage = {
  messageId: string;
  idempotencyKey: string;
  warning?: string | null;
};

export type DeletePlanResult = {
  deliveryId: string;
  publicationId: string;
  destinationId: string;
  provider: string | null;
  messageIds: string[];
  captionPreview: string | null;
  mediaUrls: string[];
  contentHash: string | null;
  sentAt: string | null;
  confirmHint: string;
  warnings: string[];
  messages: DeletePlanMessage[];
  connectorsEnabled: boolean;
};

export type DeleteMessageResult = {
  messageId: string;
  ok: boolean;
  error?: string;
  queued?: boolean;
};

@Injectable()
export class OmnichannelDeleteService {
  constructor(
    @Inject(forwardRef(() => OmnichannelService))
    private readonly omni: OmnichannelService,
    @InjectRepository(PublicationDeliveryEntity)
    private readonly deliveries: Repository<PublicationDeliveryEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publications: Repository<PublicationEntity>,
    @InjectRepository(ChannelDestinationEntity)
    private readonly destinations: Repository<ChannelDestinationEntity>,
    @InjectRepository(ChannelConnectionEntity)
    private readonly connections: Repository<ChannelConnectionEntity>,
    @InjectRepository(OmnichannelPostBackupEntity)
    private readonly backups: Repository<OmnichannelPostBackupEntity>,
    @InjectRepository(OmnichannelDeliveryMessageEntity)
    private readonly deliveryMessages: Repository<OmnichannelDeliveryMessageEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(OutboxEventEntity)
    private readonly outboxEvents: Repository<OutboxEventEntity>,
  ) {}

  async deletePlan(deliveryId: string): Promise<DeletePlanResult> {
    const ctx = await this.loadCreateContext(deliveryId);
    const messageIds = ctx.messageIds;
    await this.ensureDeliveryMessages(ctx.delivery.id, messageIds);

    const warnings: string[] = [];
    const messages: DeletePlanMessage[] = messageIds.map((messageId) => {
      let warning: string | null = null;
      if (ctx.provider === 'BALE' && baleDeleteWindowExpired(ctx.delivery.sentAt)) {
        warning = 'delete_window_expired';
        if (!warnings.includes('delete_window_expired')) warnings.push('delete_window_expired');
      }
      return {
        messageId,
        idempotencyKey: buildDeliveryIdempotencyKey({
          action: 'DELETE',
          sourceType: ctx.delivery.sourceType,
          sourceId: ctx.delivery.sourceId,
          destinationId: ctx.delivery.destinationId,
          providerMessageId: messageId,
        }),
        warning,
      };
    });

    const snapshot = await this.snapshotCaption(ctx);
    return {
      deliveryId: ctx.delivery.id,
      publicationId: ctx.delivery.publicationId,
      destinationId: ctx.delivery.destinationId,
      provider: ctx.provider,
      messageIds,
      captionPreview: snapshot.caption,
      mediaUrls: snapshot.mediaUrls,
      contentHash: ctx.delivery.contentHash,
      sentAt: ctx.delivery.sentAt ? ctx.delivery.sentAt.toISOString() : null,
      confirmHint: ctx.confirmHint,
      warnings,
      messages,
      connectorsEnabled: areOmnichannelConnectorsEnabled(),
    };
  }

  async deleteMessages(
    deliveryId: string,
    input: { messageIds: string[]; reason: string; confirmSku: string; goRef?: string },
    actor: DeleteEditActor,
  ): Promise<{ backupId: string; results: DeleteMessageResult[]; remoteQueued: number }> {
    this.guardDeleteEdit();
    const goRef = this.guardOwnerGoRef(actor, input.goRef);
    const ctx = await this.loadCreateContext(deliveryId);
    this.assertConfirmSku(ctx, input.confirmSku);

    const album = assertFullAlbumDelete(ctx.messageIds, input.messageIds);
    if (album.ok === false) throw new BadRequestException(album.error);
    const messageIds = album.messageIds;

    await this.ensureDeliveryMessages(ctx.delivery.id, messageIds);
    const snapshot = await this.snapshotCaption(ctx);

    const results: DeleteMessageResult[] = [];
    const enqueueIds: string[] = [];
    for (const messageId of messageIds) {
      if (ctx.provider === 'BALE' && baleDeleteWindowExpired(ctx.delivery.sentAt)) {
        results.push({ messageId, ok: false, error: 'delete_window_expired' });
        continue;
      }
      enqueueIds.push(messageId);
      results.push({ messageId, ok: true, queued: true });
    }

    if (!enqueueIds.length) {
      const backup = await this.insertBackup({
        delivery: ctx.delivery,
        kind: 'pre_delete',
        caption: snapshot.caption,
        mediaUrls: snapshot.mediaUrls,
        messageIds,
        reason: input.reason,
        actorId: actor.id,
        goRef,
      });
      await this.omni.recordOmnichannelAudit(actor, 'delivery_messages_delete', 'DELIVERY', ctx.delivery.id, ctx.publication.channel, input.reason, {
        backupId: backup.id,
        results,
        goRef,
        remoteQueued: 0,
      });
      return { backupId: backup.id, results, remoteQueued: 0 };
    }

    if (!areOmnichannelConnectorsEnabled()) {
      throw new ServiceUnavailableException('connectors_disabled');
    }

    const backup = await this.insertBackup({
      delivery: ctx.delivery,
      kind: 'pre_delete',
      caption: snapshot.caption,
      mediaUrls: snapshot.mediaUrls,
      messageIds,
      reason: input.reason,
      actorId: actor.id,
      goRef,
    });

    const joined = joinProviderMessageIds(enqueueIds);
    const remoteQueued = await this.omni.enqueueRemoteDeletes({
      publicationId: ctx.delivery.publicationId,
      channel: ctx.publication.channel,
      sourceType: ctx.delivery.sourceType,
      targets: [{
        destinationId: ctx.delivery.destinationId,
        providerMessageId: joined,
        publicationId: ctx.delivery.publicationId,
        createDeliveryId: ctx.delivery.id,
      }],
    });

    await this.omni.recordOmnichannelAudit(actor, 'delivery_messages_delete', 'DELIVERY', ctx.delivery.id, ctx.publication.channel, input.reason, {
      backupId: backup.id,
      results,
      goRef,
      remoteQueued,
      messageIds: enqueueIds,
    });

    return { backupId: backup.id, results, remoteQueued };
  }

  /**
   * Shared withdraw pipeline: publication WITHDRAWN + backup every live CREATE + DELETE enqueue.
   */
  async withdrawPublication(
    publicationId: string,
    actor: DeleteEditActor,
    reason?: string,
    goRef?: string | null,
  ) {
    const normalizedGoRef = this.guardOwnerGoRef(actor, goRef);
    const row = await this.publications.findOne({ where: { id: publicationId } });
    if (!row) throw new NotFoundException('انتشار یافت نشد');

    row.status = 'WITHDRAWN';
    const saved = await this.publications.save(row);
    await this.publications.update(
      { sourceType: row.sourceType, sourceId: row.sourceId, channel: row.channel },
      { status: 'WITHDRAWN' },
    );

    let remoteDeletes = 0;
    const backupIds: string[] = [];
    const live = await this.omni.listLiveRemoteMessages(row.sourceType, row.sourceId, row.channel);
    const deleteTargets: Array<{
      destinationId: string;
      providerMessageId?: string;
      publicationId?: string;
      createDeliveryId?: string;
    }> = [];

    for (const msg of live) {
      const createRow = await this.findSucceededCreate(msg.publicationId, msg.destinationId, msg.providerMessageId);
      if (!createRow) continue;
      const messageIds = parseProviderMessageIds(createRow.providerMessageId);
      await this.ensureDeliveryMessages(createRow.id, messageIds);
      const snapshot = await this.snapshotFromDelivery(createRow);
      const backup = await this.insertBackup({
        delivery: createRow,
        kind: 'pre_delete',
        caption: snapshot.caption,
        mediaUrls: snapshot.mediaUrls,
        messageIds,
        reason: reason || null,
        actorId: actor.id,
        goRef: normalizedGoRef || null,
      });
      backupIds.push(backup.id);
      deleteTargets.push({
        destinationId: msg.destinationId,
        providerMessageId: msg.providerMessageId,
        publicationId: msg.publicationId,
        createDeliveryId: createRow.id,
      });
    }

    if (areOmnichannelConnectorsEnabled() && deleteTargets.length) {
      remoteDeletes = await this.omni.enqueueRemoteDeletes({
        publicationId: row.id,
        channel: row.channel,
        sourceType: row.sourceType === FREE_POST_SOURCE_TYPE ? FREE_POST_SOURCE_TYPE : undefined,
        targets: deleteTargets,
      });
    }

    await this.omni.recordOmnichannelAudit(actor, 'withdraw', 'PUBLICATION', saved.id, row.channel, reason, {
      remoteDeletes,
      backupIds,
      goRef: normalizedGoRef || null,
    });
    return saved;
  }

  async markMessagesDeletedAndWithdrawCreate(
    createDeliveryId: string | null | undefined,
    providerMessageIdCsv: string | null | undefined,
  ): Promise<void> {
    const ids = parseProviderMessageIds(providerMessageIdCsv);
    if (createDeliveryId && ids.length) {
      await this.deliveryMessages
        .createQueryBuilder()
        .update(OmnichannelDeliveryMessageEntity)
        .set({ deletedAt: new Date() })
        .where('deliveryId = :deliveryId', { deliveryId: createDeliveryId })
        .andWhere('providerMessageId IN (:...ids)', { ids })
        .andWhere('deletedAt IS NULL')
        .execute();
    }
  }

  async onDeleteSucceeded(opts: {
    publicationId: string;
    destinationId: string;
    providerMessageId?: string | null;
    createDeliveryId?: string | null;
  }): Promise<void> {
    await this.markMessagesDeletedAndWithdrawCreate(opts.createDeliveryId, opts.providerMessageId);
    await this.omni.supersedeCreatesAfterDelete(opts.publicationId, opts.destinationId);

    const pub = await this.publications.findOne({
      where: { id: opts.publicationId },
      select: ['id', 'sourceType', 'sourceId'],
    });
    if (pub) {
      const siblings = await this.publications.find({
        where: { sourceType: pub.sourceType, sourceId: pub.sourceId },
        select: ['id'],
      });
      if (siblings.length) {
        await this.deliveries.update(
          {
            publicationId: In(siblings.map((s) => s.id)),
            destinationId: opts.destinationId,
            action: 'CREATE',
            status: 'SUCCEEDED',
          },
          { status: 'WITHDRAWN' },
        );
      }
    }
    if (opts.createDeliveryId) {
      await this.deliveries.update(
        { id: opts.createDeliveryId, action: 'CREATE' },
        { status: 'WITHDRAWN' },
      );
    }
  }

  private guardDeleteEdit() {
    try {
      assertDeleteEditEnabled();
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode || 503;
      throw new HttpException((err as Error).message || DELETE_EDIT_DISABLED_MESSAGE, status);
    }
  }

  private guardOwnerGoRef(actor: DeleteEditActor, goRef: unknown): string {
    try {
      return assertOwnerGoRefForDelete(actor, goRef);
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode || 400;
      const message = (err as Error).message || 'دسترسی غیرمجاز';
      if (status === 403) throw new ForbiddenException(message);
      throw new BadRequestException(message);
    }
  }

  private async loadCreateContext(deliveryId: string) {
    const delivery = await this.deliveries.findOne({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('ارسال یافت نشد');
    if (delivery.action !== 'CREATE') {
      throw new BadRequestException('حذف فقط روی ارسال CREATE موفق مجاز است');
    }
    if (delivery.status === 'WITHDRAWN') {
      throw new BadRequestException('این ارسال قبلاً حذف شده است');
    }
    if (delivery.status !== 'SUCCEEDED' || !delivery.providerMessageId) {
      throw new BadRequestException('ارسال هنوز پیام زنده‌ای در کانال ندارد');
    }
    const publication = await this.publications.findOne({ where: { id: delivery.publicationId } });
    if (!publication) throw new NotFoundException('انتشار یافت نشد');

    const dest = await this.destinations.findOne({ where: { id: delivery.destinationId } });
    let provider: string | null = null;
    if (dest) {
      const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
      provider = conn?.provider || null;
    }

    const messageIds = parseProviderMessageIds(delivery.providerMessageId);
    const confirmHint = await this.confirmHintFor(publication);
    return { delivery, publication, provider, messageIds, confirmHint, dest };
  }

  private async confirmHintFor(publication: PublicationEntity): Promise<string> {
    if (publication.sourceType === FREE_POST_SOURCE_TYPE) return 'FREE_POST';
    if (publication.sourceType === 'PRODUCT') {
      const product = await this.products.findOne({
        where: { id: publication.sourceId },
        select: ['id', 'sku'],
      });
      return product?.sku || publication.sourceId;
    }
    return publication.sourceId;
  }

  private assertConfirmSku(
    ctx: Awaited<ReturnType<OmnichannelDeleteService['loadCreateContext']>>,
    confirmSku: string,
  ) {
    const expected = String(ctx.confirmHint || '').trim();
    const got = String(confirmSku || '').trim();
    if (!got || got !== expected) {
      throw new BadRequestException(
        ctx.publication.sourceType === FREE_POST_SOURCE_TYPE
          ? 'برای تأیید حذف، عبارت FREE_POST را تایپ کنید'
          : 'برای تأیید حذف، کد SKU محصول را دقیق تایپ کنید',
      );
    }
  }

  private async snapshotCaption(ctx: Awaited<ReturnType<OmnichannelDeleteService['loadCreateContext']>>) {
    return this.snapshotFromDelivery(ctx.delivery);
  }

  private async snapshotFromDelivery(delivery: PublicationDeliveryEntity): Promise<{
    caption: string | null;
    mediaUrls: string[];
  }> {
    if (!delivery.eventId) {
      return { caption: null, mediaUrls: [] };
    }
    const event = await this.outboxEvents.findOne({ where: { id: delivery.eventId } });
    const payload = (event?.payload || {}) as Record<string, unknown>;
    const caption = typeof payload.text === 'string' ? payload.text.slice(0, 8000) : null;
    const mediaUrls = Array.isArray(payload.photoUrls)
      ? payload.photoUrls.map((u) => String(u)).filter(Boolean).slice(0, 20)
      : [];
    return { caption, mediaUrls };
  }

  private async insertBackup(input: {
    delivery: PublicationDeliveryEntity;
    kind: 'pre_delete' | 'pre_edit' | 'post_edit';
    caption: string | null;
    mediaUrls: string[];
    messageIds: string[];
    reason: string | null;
    actorId: string;
    goRef: string | null;
  }) {
    // Never persist bot tokens / query secrets in backup snapshots.
    assertNoPlaintextSecrets({
      caption: input.caption,
      mediaUrls: input.mediaUrls,
      reason: input.reason,
      goRef: input.goRef,
    });
    return this.backups.save(
      this.backups.create({
        deliveryId: input.delivery.id,
        publicationId: input.delivery.publicationId,
        destinationId: input.delivery.destinationId,
        kind: input.kind,
        caption: input.caption,
        mediaUrls: input.mediaUrls,
        messageIds: input.messageIds,
        contentHash: input.delivery.contentHash,
        reason: input.reason,
        actorId: input.actorId,
        goRef: input.goRef,
      }),
    );
  }

  async ensureDeliveryMessages(deliveryId: string, messageIds: string[]): Promise<void> {
    if (!messageIds.length) return;
    const existing = await this.deliveryMessages.find({
      where: { deliveryId },
      select: ['providerMessageId'],
    });
    const have = new Set(existing.map((r) => r.providerMessageId));
    const rows = messageIds
      .map((providerMessageId, albumIndex) => ({ deliveryId, providerMessageId, albumIndex }))
      .filter((r) => !have.has(r.providerMessageId));
    if (!rows.length) return;
    await this.deliveryMessages
      .createQueryBuilder()
      .insert()
      .into(OmnichannelDeliveryMessageEntity)
      .values(rows)
      .orIgnore()
      .execute();
  }

  private async findSucceededCreate(
    publicationId: string,
    destinationId: string,
    providerMessageId: string,
  ) {
    const rows = await this.deliveries.find({
      where: {
        publicationId,
        destinationId,
        action: 'CREATE',
        status: 'SUCCEEDED',
        supersededAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
      take: 5,
    });
    return rows.find((r) => r.providerMessageId === providerMessageId) || rows[0] || null;
  }
}
