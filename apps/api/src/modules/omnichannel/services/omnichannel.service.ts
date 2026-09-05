import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { ChannelProjectionService } from './channel-projection.service';
import { canaryExceeded, canaryLimitFor } from '../../product/channel-projection';
import { normalizeSalesChannel } from '../../product/channel-product-projection';
import { ProductEntity } from '../../product/entities/product.entity';
import { PreviewDto, CreatePublicationDto, PatchDestinationDto, PatchOmnichannelSettingsDto } from '../dto/omnichannel.dto';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import { ChannelTemplateEntity } from '../entities/channel-template.entity';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { PublicationEntity } from '../entities/publication.entity';
import { PublicationDeliveryEntity } from '../entities/publication-delivery.entity';
import { OmnichannelAuditEntity } from '../entities/omnichannel-audit.entity';
import { OmnichannelMediaAssetEntity } from '../entities/omnichannel-media-asset.entity';
import { TelegramAdapter } from '../adapters/telegram.adapter';
import { BaleAdapter } from '../adapters/bale.adapter';
import { RubikaAdapter } from '../adapters/rubika.adapter';
import { ConnectorDisabledError } from '../adapters/channel-adapter';
import {
  areOmnichannelConnectorsEnabled,
  isOmnichannelAutoPublishEnabled,
  OUTBOX_EVENT_TYPES,
} from '../omnichannel.constants';
import { OutboxService } from './outbox.service';
import { applyReconcileIntents, reconcilePublicationIntents } from './reconcile';
import { applyOosLocalAction, nextPublicationAction, syncChannelsForEvent } from './publication-sync';
import { AppSettingEntity } from '../../settings/entities/app-setting.entity';
import {
  annotatePreviewOos,
  assertOmnichannelSettingsInput,
  destinationSettingsForCanary,
  findCanaryDestinationId,
  liveOosRejectReason,
  mergeOmnichannelSettingsPatch,
  OMNICHANNEL_SETTINGS_KEY,
  parseStoredOmnichannelSettings,
  publicOmnichannelSettings,
  readChannelOos,
  resolveOosDecision,
  sanitizeDestinationSettings,
  selectCanaryTelegramDestinations,
} from '../oos-policy';
import { CANARY_PING_TEXT } from '../canary-ping';
import {
  defaultLayoutFor,
  emptyPublicationVars,
  formatChannelToman,
  parseTemplateLayout,
  renderPublicationLayout,
  sizesLine,
  stringifyTemplateLayout,
  type PublicationVars,
  type RenderedPublication,
} from '../publication-template';
import type { ProductSpecs } from '../../product/entities/product-specs';
import { summarizeOutbox } from './outbox-metrics';
import { canDeleteMediaAsset, countMediaReferences } from '../media-references';
import { CmsPageEntity } from '../../cms/entities/cms-page.entity';
import {
  CreateConnectionDto,
  CreateDestinationDto,
  CreateTemplateDto,
  PatchConnectionDto,
  PatchTemplateDto,
} from '../dto/omnichannel.dto';
import { assertNoPlaintextSecrets, toPublicConnection, toPublicDestination } from '../omnichannel-secrets';
import { redactProviderError } from '../adapters/telegram-errors';
import { isMissingRelationError } from '../media-registry';

type Actor = { id: string };

@Injectable()
export class OmnichannelService {
  constructor(
    @InjectRepository(ChannelConnectionEntity)
    private readonly connections: Repository<ChannelConnectionEntity>,
    @InjectRepository(ChannelDestinationEntity)
    private readonly destinations: Repository<ChannelDestinationEntity>,
    @InjectRepository(ChannelTemplateEntity)
    private readonly templates: Repository<ChannelTemplateEntity>,
    @InjectRepository(OutboxEventEntity)
    private readonly events: Repository<OutboxEventEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publications: Repository<PublicationEntity>,
    @InjectRepository(PublicationDeliveryEntity)
    private readonly deliveries: Repository<PublicationDeliveryEntity>,
    @InjectRepository(OmnichannelAuditEntity)
    private readonly audits: Repository<OmnichannelAuditEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(CmsPageEntity)
    private readonly cmsPages: Repository<CmsPageEntity>,
    @InjectRepository(OmnichannelMediaAssetEntity)
    private readonly mediaAssets: Repository<OmnichannelMediaAssetEntity>,
    @InjectRepository(AppSettingEntity)
    private readonly appSettings: Repository<AppSettingEntity>,
    private readonly projection: ChannelProjectionService,
    private readonly telegram: TelegramAdapter,
    private readonly bale: BaleAdapter,
    private readonly rubika: RubikaAdapter,
    private readonly outbox: OutboxService,
  ) {}

  private requireActor(actor?: Actor) {
    if (!actor?.id) throw new ForbiddenException('دسترسی غیرمجاز');
    return actor;
  }

  private async audit(actor: Actor, action: string, entityType: string, entityId: string, channel: string | null, reason?: string | null, payload: Record<string, unknown> = {}) {
    await this.audits.save(
      this.audits.create({
        actorId: actor.id,
        action,
        entityType,
        entityId,
        channel,
        reason: reason || null,
        payload,
      }),
    );
  }

  async listConnections() {
    const rows = await this.connections.find({ order: { createdAt: 'DESC' } });
    return rows.map((row) => toPublicConnection(row));
  }

  async createConnection(dto: CreateConnectionDto) {
    assertNoPlaintextSecrets(dto);
    const exists = await this.connections.findOne({
      where: { provider: dto.provider, channel: dto.channel, name: dto.name },
    });
    if (exists) throw new ConflictException('اتصال تکراری است');
    const saved = await this.connections.save(
      this.connections.create({
        ...dto,
        status: 'DISABLED',
      }),
    );
    return toPublicConnection(saved);
  }

  async patchConnection(id: string, dto: PatchConnectionDto) {
    assertNoPlaintextSecrets(dto);
    const row = await this.connections.findOne({ where: { id } });
    if (!row) throw new NotFoundException('اتصال یافت نشد');
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.secretRef !== undefined) row.secretRef = dto.secretRef;
    if (dto.status !== undefined) row.status = dto.status;
    return toPublicConnection(await this.connections.save(row));
  }

  async listDestinations() {
    const rows = await this.destinations.find({ order: { createdAt: 'DESC' } });
    return rows.map((row) => toPublicDestination(row));
  }

  async createDestination(dto: CreateDestinationDto) {
    assertNoPlaintextSecrets(dto);
    const connection = await this.connections.findOne({ where: { id: dto.connectionId } });
    if (!connection) throw new NotFoundException('اتصال یافت نشد');
    const exists = await this.destinations.findOne({
      where: { connectionId: dto.connectionId, destinationKey: dto.destinationKey },
    });
    if (exists) throw new ConflictException('مقصد تکراری است');
    const settings = sanitizeDestinationSettings(dto.settings);
    if (settings.isCanary === true) {
      await this.assertUniqueTelegramCanary(connection.provider, connection.channel);
    }
    const saved = await this.destinations.save(
      this.destinations.create({
        connectionId: dto.connectionId,
        destinationKey: dto.destinationKey,
        displayName: dto.displayName,
        enabled: dto.enabled ?? true,
        settings,
      }),
    );
    return toPublicDestination(saved);
  }

  async patchDestination(id: string, dto: PatchDestinationDto) {
    assertNoPlaintextSecrets(dto);
    const row = await this.destinations.findOne({ where: { id } });
    if (!row) throw new NotFoundException('مقصد یافت نشد');
    const connection = await this.connections.findOne({ where: { id: row.connectionId } });
    if (!connection) throw new NotFoundException('اتصال یافت نشد');
    if (dto.displayName !== undefined) row.displayName = dto.displayName;
    if (dto.enabled !== undefined) row.enabled = dto.enabled;
    if (dto.isCanary !== undefined) {
      if (dto.isCanary === true) {
        if (connection.provider !== 'TELEGRAM') {
          throw new BadRequestException('canary فقط برای تلگرام است');
        }
        await this.assertUniqueTelegramCanary(connection.provider, connection.channel, row.id);
      }
      row.settings = destinationSettingsForCanary(dto.isCanary);
    }
    return toPublicDestination(await this.destinations.save(row));
  }

  async getSettings() {
    const stored = await this.loadStoredSettings();
    return publicOmnichannelSettings(stored, await this.canaryDestinationIds());
  }

  async patchSettings(dto: PatchOmnichannelSettingsDto, actor?: Actor) {
    const who = this.requireActor(actor);
    assertOmnichannelSettingsInput(dto);
    const hasOos = !!(dto.retailOosPolicy || dto.wholesaleOosPolicy);
    const hasLeftovers = !!(
      dto.autoPublishEventTypes
      || dto.retrySlaSeconds != null
      || dto.outboxRetentionDays != null
    );
    if (!hasOos && !hasLeftovers) {
      throw new BadRequestException('حداقل یک تنظیم کانال لازم است');
    }
    const previous = await this.loadStoredSettings();
    const next = mergeOmnichannelSettingsPatch(previous, dto);
    const saved = await this.appSettings.save(
      this.appSettings.create({ key: OMNICHANNEL_SETTINGS_KEY, value: next }),
    );
    await this.audit(who, 'settings_patch', 'SETTINGS', OMNICHANNEL_SETTINGS_KEY, null, dto.reason || null, {
      retailOosPolicy: next.retailOosPolicy || null,
      wholesaleOosPolicy: next.wholesaleOosPolicy || null,
      retailOosChosen: next.retailOosChosen === true,
      wholesaleOosChosen: next.wholesaleOosChosen === true,
      autoPublishEventTypesChosen: next.autoPublishEventTypesChosen === true,
      retrySlaChosen: next.retrySlaChosen === true,
      outboxRetentionChosen: next.outboxRetentionChosen === true,
    });
    return publicOmnichannelSettings(parseStoredOmnichannelSettings(saved.value), await this.canaryDestinationIds());
  }

  async listTemplates() {
    return this.templates.find({ order: { createdAt: 'DESC' } });
  }

  async createTemplate(dto: CreateTemplateDto) {
    assertNoPlaintextSecrets(dto);
    const version = dto.version ?? 1;
    const exists = await this.templates.findOne({
      where: {
        provider: dto.provider,
        channel: dto.channel,
        eventType: dto.eventType,
        version,
      },
    });
    if (exists) throw new ConflictException('قالب تکراری است');
    const body = String(dto.body || '').trim() || stringifyTemplateLayout(defaultLayoutFor(dto.channel));
    return this.templates.save(
      this.templates.create({
        provider: dto.provider,
        channel: dto.channel,
        eventType: dto.eventType,
        locale: dto.locale ?? 'fa',
        body,
        version,
        enabled: dto.enabled ?? true,
      }),
    );
  }

  async patchTemplate(id: string, dto: PatchTemplateDto) {
    assertNoPlaintextSecrets(dto);
    const row = await this.templates.findOne({ where: { id } });
    if (!row) throw new NotFoundException('قالب یافت نشد');
    if (dto.body !== undefined) row.body = dto.body;
    if (dto.enabled !== undefined) row.enabled = dto.enabled;
    return this.templates.save(row);
  }

  async listPublications() {
    return this.publications.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  async listDeliveries() {
    const rows = await this.deliveries.find({ order: { createdAt: 'DESC' }, take: 100 });
    return rows.map((row) => ({
      ...row,
      lastError: row.lastError ? redactProviderError(row.lastError) : row.lastError,
    }));
  }

  async outboxMetrics() {
    try {
      const rows = await this.events.find({
        select: ['status', 'availableAt', 'lockedAt'],
        take: 2000,
      });
      return summarizeOutbox(rows);
    } catch (err) {
      if (isMissingRelationError(err)) {
        return summarizeOutbox([]);
      }
      throw err;
    }
  }

  async listOutbox() {
    const rows = await this.events.find({ order: { createdAt: 'DESC' }, take: 100 });
    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      aggregateId: row.aggregateId,
      channel: row.channel,
      status: row.status,
      attempts: row.attempts,
      availableAt: row.availableAt,
        lastError: row.lastError ? redactProviderError(row.lastError) : row.lastError,
      createdAt: row.createdAt,
    }));
  }

  async listAudits() {
    return this.audits.find({
      order: { createdAt: 'DESC' },
      take: 100,
      select: ['id', 'actorId', 'action', 'entityType', 'entityId', 'channel', 'reason', 'createdAt'],
    });
  }

  async preview(dto: PreviewDto) {
    const kind = String(dto.sourceType || 'PRODUCT').toUpperCase();
    if (kind !== 'PRODUCT' && kind !== 'BLOG_POST' && kind !== 'CMS_PAGE') {
      throw new BadRequestException('sourceType باید PRODUCT یا BLOG_POST یا CMS_PAGE باشد');
    }
    const channel = normalizeSalesChannel(dto.channel);
    const projection = await this.projection.previewSource(kind, dto.sourceId, channel);
    const available = 'available' in projection ? projection.available === true : true;
    const oos = await this.oosDecisionFor(channel, available, kind, dto.sourceId);
    const annotated = {
      ...projection,
      ...annotatePreviewOos(
        { available, stock: 'stock' in projection ? projection.stock : undefined },
        oos,
      ),
    };
    return {
      dryRun: true,
      projection: annotated,
      rendered: await this.publicationPayloadFor(annotated),
    };
  }

  async createPublication(dto: CreatePublicationDto, actor?: Actor) {
    const who = this.requireActor(actor);
    const dryRun = dto.dryRun !== false;
    const { projection } = await this.preview(dto.preview);
    if (!projection.publishable) {
      throw new BadRequestException(projection.rejectReason || 'این منبع برای این کانال قابل انتشار نیست');
    }
    if (!dryRun && projection.sourceType === 'PRODUCT') {
      const live = await this.publications.count({
        where: { channel: projection.channel, sourceType: 'PRODUCT', status: In(['READY', 'PUBLISHED', 'PARTIAL']) },
      });
      const limit = canaryLimitFor(projection.channel);
      if (canaryExceeded(live, limit)) {
        throw new BadRequestException(`سقف canary کانال ${projection.channel} برابر ${limit} محصول است`);
      }
      const available = 'available' in projection ? projection.available === true : true;
      const oos = await this.oosDecisionFor(projection.channel, available, 'PRODUCT', dto.preview.sourceId);
      const reject = liveOosRejectReason(oos, available);
      if (reject) {
        throw new BadRequestException(
          `کالای ناموجود با سیاست ${oos.policy} در این کانال منتشر نمی‌شود`,
        );
      }
    }
    const saved = await this.publications.manager.transaction(async (manager) => {
      const row = await manager.getRepository(PublicationEntity).save(
        manager.getRepository(PublicationEntity).create({
          sourceType: projection.sourceType,
          sourceId: dto.preview.sourceId,
          channel: projection.channel,
          sourceUpdatedAt: new Date(),
          projection,
          status: dryRun ? 'DRAFT' : 'READY',
        }),
      );
      if (!dryRun && isOmnichannelAutoPublishEnabled() && areOmnichannelConnectorsEnabled()) {
        const rendered = await this.publicationPayloadFor(projection);
        await this.enqueueTelegramDeliveries(row.id, projection.channel, rendered, manager);
      }
      await manager.getRepository(OmnichannelAuditEntity).save(
        manager.getRepository(OmnichannelAuditEntity).create({
          actorId: who.id,
          action: dryRun ? 'preview_publish' : 'publish',
          entityType: 'PUBLICATION',
          entityId: row.id,
          channel: projection.channel,
          reason: dto.reason || null,
          payload: { dryRun, sourceId: dto.preview.sourceId },
        }),
      );
      return row;
    });
    return { dryRun, publication: saved };
  }

  async markPublicationDelivered(publicationId: string) {
    const row = await this.publications.findOne({ where: { id: publicationId } });
    if (!row || row.status === 'WITHDRAWN') return;
    const pending = await this.deliveries.count({
      where: { publicationId, status: In(['PENDING', 'PROCESSING', 'RETRY']) },
    });
    if (pending > 0) return;
    const failed = await this.deliveries.count({
      where: { publicationId, status: In(['DEAD', 'FAILED']) },
    });
    row.status = failed > 0 ? 'PARTIAL' : 'PUBLISHED';
    await this.publications.save(row);
  }

  async withdraw(id: string, actor?: Actor, reason?: string) {
    const who = this.requireActor(actor);
    const row = await this.publications.findOne({ where: { id } });
    if (!row) throw new NotFoundException('انتشار یافت نشد');
    row.status = 'WITHDRAWN';
    const saved = await this.publications.save(row);
    await this.audit(who, 'withdraw', 'PUBLICATION', saved.id, row.channel, reason);
    return saved;
  }

  async testConnection(id: string, actor?: Actor) {
    const who = this.requireActor(actor);
    const row = await this.connections.findOne({ where: { id } });
    if (!row) throw new NotFoundException('اتصال یافت نشد');
    if (row.provider === 'BALE') await this.bale.validateConnection();
    if (row.provider === 'RUBIKA') await this.rubika.validateConnection();
    if (!areOmnichannelConnectorsEnabled() || row.provider !== 'TELEGRAM') {
      throw new ConnectorDisabledError(row.provider);
    }
    const result = await this.telegram.validateConnection(row.secretRef);
    await this.audit(who, 'test_connection', 'CONNECTION', row.id, row.channel, null, { ok: result.ok, error: result.error || null });
    return result;
  }

  async pingCanary(id: string, actor?: Actor, reason?: string) {
    const who = this.requireActor(actor);
    const row = await this.connections.findOne({ where: { id } });
    if (!row) throw new NotFoundException('اتصال یافت نشد');
    if (row.provider !== 'TELEGRAM') {
      throw new BadRequestException('پیام آزمایشی فقط برای تلگرام است');
    }
    if (row.status !== 'ACTIVE') {
      throw new BadRequestException('ابتدا اتصال را روشن کنید');
    }
    if (!areOmnichannelConnectorsEnabled()) {
      throw new ConnectorDisabledError(row.provider);
    }
    const dests = await this.destinations.find({ where: { connectionId: row.id, enabled: true } });
    const dest = selectCanaryTelegramDestinations(dests, [row], row.channel)[0];
    if (!dest) {
      throw new BadRequestException('برای این اتصال مقصد canary انتخاب نشده');
    }
    const sent = await this.telegram.create({
      secretRef: row.secretRef,
      destinationKey: dest.destinationKey,
      chatId: dest.destinationKey,
      text: CANARY_PING_TEXT,
    });
    await this.audit(who, 'canary_ping', 'CONNECTION', row.id, row.channel, reason || null, {
      destinationId: dest.id,
      providerMessageId: sent.providerMessageId,
    });
    return { ok: true, providerMessageId: sent.providerMessageId };
  }

  async retryDelivery(id: string, actor?: Actor, reason?: string) {
    const who = this.requireActor(actor);
    if (!reason) throw new BadRequestException('reason الزامی است');
    const row = await this.deliveries.findOne({ where: { id } });
    if (!row) throw new NotFoundException('تحویل یافت نشد');
    if (row.status === 'SUCCEEDED') return { retried: false, delivery: row };
    row.status = 'PENDING';
    row.nextAttemptAt = new Date();
    row.lastError = null;
    const saved = await this.deliveries.save(row);
    await this.audit(who, 'retry', 'DELIVERY', saved.id, null, reason, { publicationId: saved.publicationId });
    return { retried: true, delivery: saved };
  }

  async reconcile(actor?: Actor, reason?: string) {
    const who = this.requireActor(actor);
    const products = await this.products.find({
      select: ['id', 'status', 'showOnRetail', 'showOnWholesale', 'updatedAt'],
    });
    const visible = products.flatMap((product) => {
      const rows: Array<{ id: string; channel: 'RETAIL' | 'WHOLESALE'; updatedAt: Date }> = [];
      if (String(product.status || '').toUpperCase() === 'ACTIVE' && product.showOnRetail !== false) {
        rows.push({ id: product.id, channel: 'RETAIL', updatedAt: product.updatedAt });
      }
      if (String(product.status || '').toUpperCase() === 'ACTIVE' && product.showOnWholesale !== false) {
        rows.push({ id: product.id, channel: 'WHOLESALE', updatedAt: product.updatedAt });
      }
      return rows;
    });
    const existing = await this.publications.find({
      select: ['sourceId', 'channel', 'status', 'sourceUpdatedAt'],
    });
    const intents = reconcilePublicationIntents(visible, existing);
    const next = applyReconcileIntents(visible, existing);
    for (const intent of intents) {
      if (intent.action === 'withdraw') {
        await this.publications.update(
          { sourceId: intent.sourceId, channel: intent.channel },
          { status: 'WITHDRAWN' },
        );
      } else {
        const already = existing.find((row) => row.sourceId === intent.sourceId && row.channel === intent.channel && row.status === 'DRAFT');
        if (already) continue;
        const { projection } = await this.preview({
          channel: intent.channel as 'RETAIL' | 'WHOLESALE',
          sourceType: 'PRODUCT',
          sourceId: intent.sourceId,
        });
        if (!projection.publishable) continue;
        await this.publications.save(
          this.publications.create({
            sourceType: 'PRODUCT',
            sourceId: intent.sourceId,
            channel: intent.channel,
            sourceUpdatedAt: new Date(),
            projection,
            status: 'DRAFT',
          }),
        );
      }
    }
    await this.audit(who, 'reconcile', 'PUBLICATION', 'batch', null, reason || 'reconcile', {
      intentCount: intents.length,
      replayEmpty: reconcilePublicationIntents(visible, next).length === 0,
    });
    return { intents, deliveriesCreated: 0 };
  }

  /**
   * Worker/catalog sync: upsert or withdraw local publication rows.
   * Never enqueues deliveries. Missing schema is skipped (pre-migrate).
   */
  async syncProductPublications(productId: string, channel?: string | null) {
    return this.syncSourcePublications('PRODUCT', productId, channel);
  }

  async syncBlogPublications(postId: string, channel?: string | null) {
    return this.syncSourcePublications('BLOG_POST', postId, channel);
  }

  async syncCmsPublications(pageId: string, channel?: string | null) {
    return this.syncSourcePublications('CMS_PAGE', pageId, channel);
  }

  private async syncSourcePublications(
    sourceType: 'PRODUCT' | 'BLOG_POST' | 'CMS_PAGE',
    sourceId: string,
    channel?: string | null,
  ) {
    const id = String(sourceId || '').trim();
    if (!id) return [];
    const results: Array<{ channel: string; action: string }> = [];
    try {
      for (const ch of syncChannelsForEvent(channel)) {
        results.push(await this.syncOneSource(sourceType, id, ch));
      }
    } catch (err) {
      if (isMissingRelationError(err)) return [{ channel: String(channel || ''), action: 'skip' }];
      throw err;
    }
    return results;
  }

  private async syncOneSource(
    sourceType: 'PRODUCT' | 'BLOG_POST' | 'CMS_PAGE',
    sourceId: string,
    channel: 'RETAIL' | 'WHOLESALE',
  ) {
    let projection: Awaited<ReturnType<ChannelProjectionService['previewSource']>>;
    try {
      projection = await this.projection.previewSource(sourceType, sourceId, channel);
    } catch (err) {
      if (err instanceof NotFoundException) {
        await this.publications.update(
          { sourceType, sourceId, channel },
          { status: 'WITHDRAWN' },
        );
        return { channel, action: 'withdraw' };
      }
      throw err;
    }
    const existing = await this.publications.findOne({
      where: { sourceType, sourceId, channel },
      order: { createdAt: 'DESC' },
    });
    let action = nextPublicationAction(existing, projection.publishable);
    if (sourceType === 'PRODUCT' && projection.publishable) {
      const available = 'available' in projection ? projection.available === true : true;
      const oos = await this.oosDecisionFor(channel, available, sourceType, sourceId);
      action = applyOosLocalAction(action, oos.local);
    }
    if (action === 'skip') return { channel, action };
    if (action === 'withdraw' && existing) {
      existing.status = 'WITHDRAWN';
      await this.publications.save(existing);
      return { channel, action };
    }
    if (action === 'create') {
      await this.publications.save(
        this.publications.create({
          sourceType,
          sourceId,
          channel,
          sourceUpdatedAt: new Date(),
          projection,
          status: 'DRAFT',
        }),
      );
      return { channel, action };
    }
    if (!existing) return { channel, action: 'skip' };
    existing.projection = projection;
    existing.sourceUpdatedAt = new Date();
    if (action === 'reopen') existing.status = 'DRAFT';
    await this.publications.save(existing);
    return { channel, action };
  }

  async assertMediaDeletable(url: string) {
    const products = await this.products.find({ select: ['id', 'images', 'videoUrl'] });
    const pages = await this.cmsPages.find({ select: ['id', 'content', 'blocks'] });
    const count = countMediaReferences(url, [
      ...products.map((p) => ({ images: p.images, videoUrl: p.videoUrl })),
      ...pages.map((page) => ({ html: `${page.content}\n${JSON.stringify(page.blocks || [])}` })),
    ]);
    if (!canDeleteMediaAsset(count)) {
      throw new ConflictException('این فایل هنوز در محصول یا CMS استفاده می‌شود');
    }
    return { deletable: true, references: count };
  }

  async listMedia() {
    try {
      return await this.mediaAssets.find({
        order: { createdAt: 'DESC' },
        take: 100,
        select: ['id', 'publicUrl', 'storageKey', 'altText', 'ownerType', 'ownerId', 'createdAt'],
      });
    } catch (err) {
      if (isMissingRelationError(err)) return [];
      throw err;
    }
  }

  async patchMediaAlt(id: string, altText: string) {
    const row = await this.mediaAssets.findOne({ where: { id } });
    if (!row) throw new NotFoundException('فایل یافت نشد');
    row.altText = String(altText || '').trim().slice(0, 200);
    return this.mediaAssets.save(row);
  }

  private async publicationPayloadFor(projection: Record<string, unknown>): Promise<RenderedPublication> {
    const eventType = projection.sourceType === 'BLOG_POST'
      ? 'blog.published'
      : projection.sourceType === 'CMS_PAGE'
        ? 'cms.published'
        : 'product.published';
    const channel = projection.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    const tpl = await this.templates.findOne({
      where: { provider: 'TELEGRAM', channel, eventType, enabled: true },
      order: { version: 'DESC' },
    });
    const layout = parseTemplateLayout(tpl?.body, channel);
    return renderPublicationLayout(layout, await this.publicationVarsFor(projection), channel);
  }

  private async publicationVarsFor(projection: Record<string, unknown>): Promise<PublicationVars> {
    const payable = Number(projection.payable ?? projection.listPrice ?? projection.price ?? 0);
    const vars = emptyPublicationVars();
    vars.name = String(projection.name || projection.title || '').trim();
    vars.sku = String(projection.sku || '').trim();
    vars.price = formatChannelToman(payable);
    vars.url = String(projection.url || '').trim();
    if (projection.sourceType !== 'PRODUCT' || !projection.sourceId) return vars;
    const product = await this.products.findOne({
      where: { id: String(projection.sourceId) },
      relations: ['variants'],
    });
    if (!product) return vars;
    const specs = (product.specs || {}) as ProductSpecs;
    vars.fabric = String(specs.fabricType || product.fabric || '').trim();
    vars.length = String(specs.length || '').trim();
    vars.sizes = sizesLine(product.sizeType);
    const colors = [...new Set((product.variants || []).map((row) => String(row.color || '').trim()).filter(Boolean))];
    vars.colors = colors.join('، ');
    vars.colorCount = colors.length ? `${colors.length} رنگ` : '';
    const pack = Number(specs.packQty || product.minOrderQty || 0);
    vars.packQty = pack > 0 ? `${pack} عدد` : String(specs.packQty || '').trim();
    if (pack > 0 && payable > 0) vars.packPrice = formatChannelToman(payable * pack);
    vars.images = Array.isArray(product.images) ? product.images.map(String) : [];
    return vars;
  }

  private async enqueueTelegramDeliveries(
    publicationId: string,
    channel: string,
    rendered: RenderedPublication,
    manager: EntityManager,
  ) {
    const dests = await manager.getRepository(ChannelDestinationEntity).find({ where: { enabled: true } });
    const conns = await manager.getRepository(ChannelConnectionEntity).find();
    const canaries = selectCanaryTelegramDestinations(dests, conns, channel);
    const deliveryRepo = manager.getRepository(PublicationDeliveryEntity);
    for (const dest of canaries) {
      const queued = await this.outbox.enqueue({
        operationId: `pub:${publicationId}:${dest.id}:CREATE`,
        eventType: OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED,
        aggregateType: 'PUBLICATION',
        aggregateId: publicationId,
        channel,
        payload: {
          publicationId,
          destinationId: dest.id,
          action: 'CREATE',
          channel,
          text: rendered.text,
          photoUrls: rendered.photoUrls,
        },
      }, manager);
      if (!queued.id) continue;
      await deliveryRepo.save(
        deliveryRepo.create({
          publicationId,
          destinationId: dest.id,
          eventId: queued.id,
          action: 'CREATE',
          status: 'PENDING',
        }),
      );
    }
  }

  private async loadStoredSettings() {
    try {
      const row = await this.appSettings.findOne({ where: { key: OMNICHANNEL_SETTINGS_KEY } });
      return parseStoredOmnichannelSettings(row?.value);
    } catch (err) {
      if (isMissingRelationError(err)) return {};
      throw err;
    }
  }

  private async canaryDestinationIds() {
    try {
      const dests = await this.destinations.find();
      const conns = await this.connections.find();
      return {
        retail: findCanaryDestinationId(dests, conns, 'RETAIL'),
        wholesale: findCanaryDestinationId(dests, conns, 'WHOLESALE'),
      };
    } catch (err) {
      if (isMissingRelationError(err)) return { retail: null, wholesale: null };
      throw err;
    }
  }

  private async assertUniqueTelegramCanary(provider: string, channel: string, exceptId?: string) {
    if (provider !== 'TELEGRAM') {
      throw new BadRequestException('canary فقط برای تلگرام است');
    }
    const dests = await this.destinations.find();
    const conns = await this.connections.find();
    const current = findCanaryDestinationId(dests, conns, channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL');
    if (current && current !== exceptId) {
      throw new ConflictException('برای این کانال تلگرام قبلاً مقصد canary ثبت شده');
    }
  }

  private async sourceHasRemoteMessage(sourceType: string, sourceId: string, channel: string) {
    const pub = await this.publications.findOne({
      where: { sourceType, sourceId, channel },
      order: { createdAt: 'DESC' },
    });
    if (!pub) return false;
    const row = await this.deliveries.findOne({
      where: { publicationId: pub.id, status: 'SUCCEEDED' },
    });
    return Boolean(row?.providerMessageId);
  }

  private async oosDecisionFor(
    channel: 'RETAIL' | 'WHOLESALE',
    available: boolean,
    sourceType: string,
    sourceId: string,
  ) {
    const stored = await this.loadStoredSettings();
    const { policy, chosen } = readChannelOos(stored, channel);
    const hasRemoteMessage = sourceType === 'PRODUCT'
      ? await this.sourceHasRemoteMessage(sourceType, sourceId, channel)
      : false;
    return resolveOosDecision({
      channel,
      available: sourceType === 'PRODUCT' ? available : true,
      hasRemoteMessage,
      policy,
      chosen,
    });
  }
}
