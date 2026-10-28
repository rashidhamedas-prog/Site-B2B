import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OmnichannelPostBackupEntity } from '../entities/omnichannel-post-backup.entity';
import { PublicationDeliveryEntity } from '../entities/publication-delivery.entity';
import { PublicationEntity } from '../entities/publication.entity';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { contentHash } from '../delivery-idempotency';
import {
  DELETE_EDIT_DISABLED_MESSAGE,
  assertDeleteEditEnabled,
  assertPublisherForEdit,
  type DeleteEditActor,
} from '../omnichannel-delete-edit-rbac';
import { areOmnichannelConnectorsEnabled } from '../omnichannel.constants';
import { parseProviderMessageIds } from '../provider-message-ids';
import type { RenderedPublication } from '../publication-template';
import { OmnichannelService } from './omnichannel.service';

@Injectable()
export class OmnichannelEditService {
  constructor(
    @Inject(forwardRef(() => OmnichannelService))
    private readonly omni: OmnichannelService,
    @InjectRepository(PublicationDeliveryEntity)
    private readonly deliveries: Repository<PublicationDeliveryEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publications: Repository<PublicationEntity>,
    @InjectRepository(OmnichannelPostBackupEntity)
    private readonly backups: Repository<OmnichannelPostBackupEntity>,
    @InjectRepository(OutboxEventEntity)
    private readonly outboxEvents: Repository<OutboxEventEntity>,
  ) {}

  private guardMutating(actor: DeleteEditActor) {
    try {
      assertDeleteEditEnabled();
    } catch (err: unknown) {
      throw new HttpException(
        (err as Error).message || DELETE_EDIT_DISABLED_MESSAGE,
        (err as { statusCode?: number }).statusCode || 503,
      );
    }
    try {
      assertPublisherForEdit(actor);
    } catch (err: unknown) {
      throw new ForbiddenException((err as Error).message || 'دسترسی غیرمجاز');
    }
  }

  async edit(
    deliveryId: string,
    input: { caption: string; reason?: string },
    actor: DeleteEditActor,
  ) {
    this.guardMutating(actor);
    const delivery = await this.requireLiveCreate(deliveryId);
    const publication = await this.publications.findOne({ where: { id: delivery.publicationId } });
    if (!publication) throw new NotFoundException('انتشار یافت نشد');

    const previous = await this.readPayloadSnapshot(delivery);
    const newCaption = String(input.caption || '').trim();
    if (!newCaption) throw new BadRequestException('متن جدید خالی است');

    const backup = await this.backups.save(
      this.backups.create({
        deliveryId: delivery.id,
        publicationId: delivery.publicationId,
        destinationId: delivery.destinationId,
        kind: 'pre_edit',
        caption: previous.caption,
        mediaUrls: previous.mediaUrls,
        messageIds: parseProviderMessageIds(delivery.providerMessageId),
        contentHash: delivery.contentHash,
        reason: input.reason || null,
        actorId: actor.id,
        goRef: null,
      }),
    );

    const rendered: RenderedPublication = {
      text: newCaption,
      photoUrls: previous.mediaUrls,
      parseMode: previous.parseMode === 'PLAIN' ? 'PLAIN' : 'HTML',
      buttons: Array.isArray(previous.buttons)
        ? previous.buttons.filter((b): b is { label: string; url: string } =>
          Boolean(b && typeof b === 'object' && typeof (b as { label?: unknown }).label === 'string'
            && typeof (b as { url?: unknown }).url === 'string'))
        : [],
      silent: Boolean(previous.silent),
      protectContent: Boolean(previous.protectContent),
      captionAbove: Boolean(previous.captionAbove),
      linkPreview: Boolean(previous.linkPreview),
      mediaMode: previous.mediaUrls.length > 1 ? 'album' : previous.mediaUrls.length === 1 ? 'single' : 'text',
    };
    const hash = contentHash({
      text: rendered.text,
      photoUrls: rendered.photoUrls,
      buttons: rendered.buttons,
    });

    if (!areOmnichannelConnectorsEnabled()) {
      throw new BadRequestException('connectors_disabled');
    }

    const queued = await this.omni.enqueueRemoteUpdates({
      publicationId: delivery.publicationId,
      channel: publication.channel,
      sourceType: delivery.sourceType,
      rendered,
      targets: [{
        destinationId: delivery.destinationId,
        providerMessageId: delivery.providerMessageId || undefined,
        publicationId: delivery.publicationId,
      }],
    });

    await this.omni.recordOmnichannelAudit(
      actor,
      'delivery_edit',
      'DELIVERY',
      delivery.id,
      publication.channel,
      input.reason,
      {
        backupId: backup.id,
        contentHash: hash,
        diff: { before: previous.caption, after: newCaption },
        queued,
      },
    );

    return {
      backupId: backup.id,
      contentHash: hash,
      queued,
      diff: { before: previous.caption, after: newCaption },
    };
  }

  async revert(
    deliveryId: string,
    input: { backupId: string; reason?: string },
    actor: DeleteEditActor,
  ) {
    this.guardMutating(actor);
    const delivery = await this.requireLiveCreate(deliveryId);
    const publication = await this.publications.findOne({ where: { id: delivery.publicationId } });
    if (!publication) throw new NotFoundException('انتشار یافت نشد');

    const backup = await this.resolveBackup(delivery.id, input.backupId);
    const caption = String(backup.caption || '').trim();
    if (!caption) throw new BadRequestException('نسخه پشتیبان متن معتبری ندارد');

    return this.edit(
      deliveryId,
      { caption, reason: input.reason || `revert:${backup.id}` },
      actor,
    ).then(async (result) => {
      await this.omni.recordOmnichannelAudit(
        actor,
        'delivery_revert',
        'DELIVERY',
        delivery.id,
        publication.channel,
        input.reason,
        { backupId: backup.id, editBackupId: result.backupId, queued: result.queued },
      );
      return { ...result, revertedFromBackupId: backup.id };
    });
  }

  private async requireLiveCreate(deliveryId: string) {
    const delivery = await this.deliveries.findOne({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('ارسال یافت نشد');
    if (delivery.action !== 'CREATE' || delivery.status !== 'SUCCEEDED' || !delivery.providerMessageId) {
      throw new BadRequestException('ویرایش فقط روی ارسال CREATE موفق مجاز است');
    }
    return delivery;
  }

  private async resolveBackup(deliveryId: string, backupId: string) {
    const token = String(backupId || '').trim().toLowerCase();
    if (token === 'last' || token === 'latest') {
      const latest = await this.backups.findOne({
        where: { deliveryId, kind: 'pre_edit' },
        order: { createdAt: 'DESC' },
      });
      if (!latest) {
        const any = await this.backups.findOne({
          where: { deliveryId },
          order: { createdAt: 'DESC' },
        });
        if (!any) throw new NotFoundException('نسخه پشتیبان یافت نشد');
        return any;
      }
      return latest;
    }
    const row = await this.backups.findOne({ where: { id: backupId, deliveryId } });
    if (!row) throw new NotFoundException('نسخه پشتیبان یافت نشد');
    return row;
  }

  private async readPayloadSnapshot(delivery: PublicationDeliveryEntity) {
    const event = delivery.eventId
      ? await this.outboxEvents.findOne({ where: { id: delivery.eventId } })
      : null;
    const payload = (event?.payload || {}) as Record<string, unknown>;
    return {
      caption: typeof payload.text === 'string' ? payload.text : null,
      mediaUrls: Array.isArray(payload.photoUrls)
        ? payload.photoUrls.map((u) => String(u)).filter(Boolean)
        : [],
      parseMode: payload.parseMode as string | undefined,
      buttons: payload.buttons as Array<{ label: string; url: string }> | undefined,
      silent: payload.silent,
      protectContent: payload.protectContent,
      captionAbove: payload.captionAbove,
      linkPreview: payload.linkPreview,
    };
  }
}
