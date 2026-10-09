import {
  BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { ChannelProjectionService } from './channel-projection.service';
import { canaryExceeded, canaryLimitFor } from '../../product/channel-projection';
import { normalizeSalesChannel } from '../../product/channel-product-projection';
import { ProductEntity } from '../../product/entities/product.entity';
import { ProductCategoryMembershipEntity } from '../../product/entities/product-category-membership.entity';
import {
  PreviewDto,
  CreatePublicationDto,
  ClearWaitingOutboxDto,
  PatchDestinationDto,
  PatchOmnichannelSettingsDto,
  PutSecretDto,
  RequeueByCategoryDto,
} from '../dto/omnichannel.dto';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import { ChannelTemplateEntity } from '../entities/channel-template.entity';
import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { PublicationEntity } from '../entities/publication.entity';
import { PublicationDeliveryEntity } from '../entities/publication-delivery.entity';
import { OmnichannelAuditEntity } from '../entities/omnichannel-audit.entity';
import { OmnichannelMediaAssetEntity } from '../entities/omnichannel-media-asset.entity';
import { ChannelAdapterRegistry } from '../adapters/adapter-registry';
import { ConnectorDisabledError } from '../adapters/channel-adapter';
import {
  areOmnichannelConnectorsEnabled,
  isOmnichannelAutoPublishEnabled,
  isOmnichannelProvider,
  isOmnichannelProviderEnabled,
  OUTBOX_EVENT_TYPES,
} from '../omnichannel.constants';
import { capabilitiesFor } from '../provider-capabilities';
import { OutboxService } from './outbox.service';
import { applyReconcileIntents, reconcilePublicationIntents } from './reconcile';
import { applyOosLocalAction, nextPublicationAction, syncChannelsForEvent } from './publication-sync';
import { AppSettingEntity } from '../../settings/entities/app-setting.entity';
import {
  annotatePreviewOos,
  assertOmnichannelSettingsInput,
  destinationCanPost,
  findCanaryDestinationId,
  hasAutomationPatch,
  isCanarySettings,
  liveOosRejectReason,
  mergeDestinationSettings,
  mergeOmnichannelSettingsPatch,
  OMNICHANNEL_SETTINGS_KEY,
  parseStoredOmnichannelSettings,
  publicOmnichannelSettings,
  readAutomationSettings,
  readAutoPublishCategoryIds,
  readAutoPublishEventTypes,
  readChannelOos,
  resolveOosDecision,
  canaryDestinationIdsByProvider,
  sanitizeDestinationSettings,
  sanitizeDestinationVerification,
  selectCanaryDestinations,
  withDestinationVerification,
  withTestPostProof,
  type DestinationVerification,
} from '../oos-policy';
import {
  canEnqueueManualDelivery,
  evaluateAutomationGate,
  evaluateCategoryAllowlistGate,
  foldLiveRemoteMessages,
  latestPublicationsBySource,
  planManualDeliveries,
  resolveRemoteIntent,
  selectAutomationDestinations,
  tehranDayStart,
} from '../publication-automation';
import { CANARY_PING_TEXT } from '../canary-ping';
import { normalizeBulkPublicationIds } from '../bulk-publication-ids';
import {
  CLEAR_WAITING_ERROR,
  CLEAR_WAITING_STALE_ERROR,
  REQUEUE_BY_CATEGORY_MAX,
  normalizeClearWaitingInput,
  normalizeRequeueByCategoryInput,
  staggeredAvailableAt,
} from '../bulk-requeue-category';
import {
  defaultLayoutFor,
  emptyPublicationVars,
  extractProductLookupKey,
  formatChannelToman,
  imageCandidates,
  isLegacyProductTemplate,
  parseTemplateLayout,
  renderPublicationLayout,
  renderUnavailableNotice,
  sizesLine,
  storedProductTemplateBody,
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
import { OmnichannelTokenVaultService } from './omnichannel-token-vault.service';
import {
  assertNoVaultLeak,
  assertTokenShape,
  peekVaultMeta,
  peekVaultToken,
  providerFromSecretRef,
  setVaultOverlayEntry,
} from '../omnichannel-token-vault';
import { redactProviderError } from '../adapters/telegram-errors';
import { isMissingRelationError } from '../media-registry';

type Actor = { id: string };

const SECRET_WRITE_WINDOW_MS = 10 * 60 * 1000;
const SECRET_WRITE_MAX = 8;
const secretWriteHits = new Map<string, number[]>();

function assertSecretWriteRate(actorId: string) {
  const now = Date.now();
  const recent = (secretWriteHits.get(actorId) || []).filter((at) => now - at < SECRET_WRITE_WINDOW_MS);
  if (recent.length >= SECRET_WRITE_MAX) {
    throw new HttpException('تعداد ذخیره توکن زیاد بود؛ چند دقیقه دیگر دوباره تلاش کنید', HttpStatus.TOO_MANY_REQUESTS);
  }
  recent.push(now);
  secretWriteHits.set(actorId, recent);
}

function tokenInputError(code: string): never {
  const messages: Record<string, string> = {
    token_whitespace: 'توکن را بدون فاصله بچسبانید',
    token_length: 'طول توکن نامعتبر است',
    token_shape: 'شکل توکن این پیام‌رسان درست نیست',
    token_provider: 'پلتفرم این متغیر پشتیبانی نمی‌شود',
    vault_key_missing: 'کلید رمزنگاری سرور تنظیم نشده',
  };
  throw new BadRequestException(messages[code] || 'ذخیره توکن ناموفق بود');
}

/**
 * One master layout per sales channel feeds every platform; the adapters convert the canonical
 * HTML to Bale Markdown / Rubika metadata. The row keeps `provider = TELEGRAM` as its storage key
 * because that is where the layouts were born; per-provider overrides are a later phase.
 */
export const MASTER_TEMPLATE_PROVIDER = 'TELEGRAM';

function productTemplateBodyOrThrow(channel: string, raw: string): string {
  try {
    return storedProductTemplateBody(channel, raw);
  } catch (err) {
    throw new BadRequestException(err instanceof Error ? err.message : 'قالب نامعتبر است');
  }
}

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
    @InjectRepository(ProductCategoryMembershipEntity)
    private readonly productCategoryMemberships: Repository<ProductCategoryMembershipEntity>,
    @InjectRepository(CmsPageEntity)
    private readonly cmsPages: Repository<CmsPageEntity>,
    @InjectRepository(OmnichannelMediaAssetEntity)
    private readonly mediaAssets: Repository<OmnichannelMediaAssetEntity>,
    @InjectRepository(AppSettingEntity)
    private readonly appSettings: Repository<AppSettingEntity>,
    private readonly projection: ChannelProjectionService,
    private readonly adapters: ChannelAdapterRegistry,
    private readonly outbox: OutboxService,
    private readonly tokenVault: OmnichannelTokenVaultService,
  ) {}

  private requireActor(actor?: Actor) {
    if (!actor?.id) throw new ForbiddenException('دسترسی غیرمجاز');
    return actor;
  }

  /** Adapter for a stored connection, or ConnectorDisabledError when its provider is switched off. */
  private liveAdapter(provider: string) {
    if (!isOmnichannelProviderEnabled(provider)) throw new ConnectorDisabledError(provider);
    return this.adapters.for(provider);
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

  async listSecretStatuses() {
    const rows = await this.connections.find({ select: ['secretRef'] });
    const list = await this.tokenVault.statuses(rows.map((row) => row.secretRef));
    list.forEach((row) => assertNoVaultLeak(row));
    return list;
  }

  async putSecret(dto: PutSecretDto, actor?: Actor) {
    const who = this.requireActor(actor);
    assertNoPlaintextSecrets({ secretRef: dto.secretRef });
    assertSecretWriteRate(who.id);
    const secretRef = String(dto.secretRef || '').trim();
    const provider = providerFromSecretRef(secretRef);
    if (!provider) throw new BadRequestException('secretRef باید نام env پیام‌رسان باشد');
    const token = String(dto.token || '');
    if (dto.reason && (dto.reason === token || dto.reason.includes(token))) {
      throw new BadRequestException('دلیل نباید شامل توکن باشد');
    }
    try {
      assertTokenShape(provider, token);
    } catch (err) {
      tokenInputError(err instanceof Error ? err.message : 'token_shape');
    }
    const previous = peekVaultToken(secretRef);
    const previousMeta = peekVaultMeta(secretRef);
    setVaultOverlayEntry(secretRef, token);
    let saved = false;
    try {
      const result = await this.adapters.for(provider).probeCredential(secretRef);
      if (!result.ok) {
        throw new BadRequestException(
          result.error === 'invalid_credential'
            ? 'پیام‌رسان این توکن را رد کرد'
            : 'تست توکن ناموفق بود؛ ذخیره نشد',
        );
      }
      const status = await this.tokenVault.put(secretRef, token);
      saved = true;
      assertNoVaultLeak(status);
      await this.audit(who, 'secret_put', 'SECRET', secretRef, null, null, {
        provider,
        secretRef,
        source: status.source,
        fingerprint: status.fingerprint,
        rotated: Boolean(previous),
        liveCheck: 'getMe',
      });
      return status;
    } catch (err) {
      if (!saved) setVaultOverlayEntry(secretRef, previous, previousMeta);
      if (err instanceof Error && err.message === 'vault_key_missing') tokenInputError('vault_key_missing');
      throw err;
    }
  }

  async clearSecret(secretRef: string, actor?: Actor) {
    const who = this.requireActor(actor);
    const name = String(secretRef || '').trim();
    assertNoPlaintextSecrets({ secretRef: name });
    assertSecretWriteRate(who.id);
    if (!providerFromSecretRef(name)) throw new BadRequestException('secretRef نامعتبر است');
    const hadVault = Boolean(peekVaultToken(name));
    const status = await this.tokenVault.clear(name);
    assertNoVaultLeak(status);
    await this.audit(who, 'secret_clear', 'SECRET', name, null, null, {
      secretRef: name,
      hadVault,
      stillConfigured: status.configured,
    });
    return status;
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

  async deleteConnection(id: string, actor?: Actor) {
    const who = this.requireActor(actor);
    assertNoPlaintextSecrets({ id });
    const row = await this.connections.findOne({ where: { id } });
    if (!row) throw new NotFoundException('اتصال یافت نشد');
    const dests = await this.destinations.find({ where: { connectionId: id } });
    const destIds = dests.map((dest) => dest.id);
    await this.connections.manager.transaction(async (em) => {
      if (destIds.length) {
        await em.delete(PublicationDeliveryEntity, { destinationId: In(destIds) });
        await em.delete(ChannelDestinationEntity, { connectionId: id });
      }
      await em.delete(ChannelConnectionEntity, { id });
    });
    await this.audit(who, 'connection_delete', 'CONNECTION', id, row.channel, null, {
      provider: row.provider,
      name: row.name,
      destinationsRemoved: destIds.length,
    });
    return { ok: true };
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
      await this.assertUniqueCanary(connection.provider, connection.channel);
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
        await this.assertUniqueCanary(connection.provider, connection.channel, row.id);
      }
      row.settings = mergeDestinationSettings(row.settings, dto.isCanary);
    }
    return toPublicDestination(await this.destinations.save(row));
  }

  async deleteDestination(id: string, actor?: Actor) {
    const who = this.requireActor(actor);
    assertNoPlaintextSecrets({ id });
    const row = await this.destinations.findOne({ where: { id } });
    if (!row) throw new NotFoundException('مقصد یافت نشد');
    const deliveryCount = await this.deliveries.count({ where: { destinationId: id } });
    await this.destinations.manager.transaction(async (em) => {
      await em.delete(PublicationDeliveryEntity, { destinationId: id });
      await em.delete(ChannelDestinationEntity, { id });
    });
    await this.audit(who, 'destination_delete', 'DESTINATION', id, null, null, {
      destinationKey: row.destinationKey,
      displayName: row.displayName,
      hadDeliveries: deliveryCount > 0,
    });
    return { ok: true };
  }

  /**
   * Asks the provider who the bot is inside this chat (getChat + getChatMember where the API has
   * it) and stores a sanitized snapshot on the destination. LIVE automation only targets
   * destinations that passed this — or, for providers without a member API (Rubika), a test post.
   */
  async verifyDestination(id: string, actor?: Actor) {
    const who = this.requireActor(actor);
    const row = await this.destinations.findOne({ where: { id } });
    if (!row) throw new NotFoundException('مقصد یافت نشد');
    const connection = await this.connections.findOne({ where: { id: row.connectionId } });
    if (!connection) throw new NotFoundException('اتصال یافت نشد');
    const adapter = this.liveAdapter(connection.provider);
    const inspection = await adapter.inspectDestination(connection.secretRef, row.destinationKey);
    const verification = sanitizeDestinationVerification({
      checkedAt: new Date().toISOString(),
      ...inspection,
    }) as DestinationVerification;
    row.settings = withDestinationVerification(row.settings, verification);
    const saved = await this.destinations.save(row);
    await this.audit(who, 'verify_destination', 'DESTINATION', row.id, connection.channel, null, {
      provider: connection.provider,
      ok: verification.ok,
      error: verification.error || null,
      chatType: verification.chatType || null,
      botIsAdmin: verification.botIsAdmin ?? null,
      canPost: verification.canPost ?? null,
      permissionCheck: verification.permissionCheck || null,
    });
    return {
      ...toPublicDestination(saved),
      botUsername: inspection.botUsername || null,
      needsTestPost: verification.ok && verification.canPost !== true && verification.permissionCheck === 'test_post',
    };
  }

  /**
   * Sends one Persian test line to this destination through the official API and, when it lands,
   * records the proof on the destination (canPost=true, permissionCheck=test_post). This is the
   * only way to prove posting rights on Rubika; on Telegram/Bale it is a visible sanity check.
   */
  async testPostDestination(id: string, actor?: Actor, reason?: string) {
    const who = this.requireActor(actor);
    const row = await this.destinations.findOne({ where: { id } });
    if (!row) throw new NotFoundException('مقصد یافت نشد');
    const connection = await this.connections.findOne({ where: { id: row.connectionId } });
    if (!connection) throw new NotFoundException('اتصال یافت نشد');
    if (connection.status !== 'ACTIVE') throw new BadRequestException('ابتدا اتصال را روشن کنید');
    if (!row.enabled) throw new BadRequestException('این مقصد غیرفعال است');
    const adapter = this.liveAdapter(connection.provider);
    const label = capabilitiesFor(connection.provider).label;
    let sent: { providerMessageId: string };
    try {
      sent = await adapter.create({
        secretRef: connection.secretRef,
        destinationKey: row.destinationKey,
        chatId: row.destinationKey,
        channel: connection.channel,
        text: `${CANARY_PING_TEXT}\n(${label} · ${row.displayName || row.destinationKey})`,
      });
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : 'provider_unavailable';
      await this.audit(who, 'test_post', 'DESTINATION', row.id, connection.channel, reason || null, {
        provider: connection.provider,
        ok: false,
        error: redactProviderError(code).slice(0, 60),
      });
      throw new BadRequestException(`ارسال آزمایشی ناموفق بود: ${redactProviderError(code).slice(0, 80)}`);
    }
    row.settings = withTestPostProof(row.settings);
    const saved = await this.destinations.save(row);
    await this.audit(who, 'test_post', 'DESTINATION', row.id, connection.channel, reason || null, {
      provider: connection.provider,
      ok: true,
      providerMessageId: sent.providerMessageId,
    });
    return { ok: true, providerMessageId: sent.providerMessageId, destination: toPublicDestination(saved) };
  }

  /**
   * Lists chats the bot has recently seen (getUpdates, nothing acknowledged) so the admin can copy
   * an opaque id — Rubika's `c0…` ids and private Telegram/Bale channel ids are otherwise hard to find.
   */
  async discoverChats(connectionId: string, actor?: Actor) {
    const who = this.requireActor(actor);
    const row = await this.connections.findOne({ where: { id: connectionId } });
    if (!row) throw new NotFoundException('اتصال یافت نشد');
    const adapter = this.liveAdapter(row.provider);
    const result = await adapter.discoverChats(row.secretRef);
    await this.audit(who, 'discover_chats', 'CONNECTION', row.id, row.channel, null, {
      provider: row.provider,
      ok: result.ok,
      error: result.error || null,
      count: result.chats.length,
    });
    return { ok: result.ok, error: result.error || null, provider: row.provider, chats: result.chats.slice(0, 50) };
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
    if (!hasOos && !hasLeftovers && !hasAutomationPatch(dto)) {
      throw new BadRequestException('حداقل یک تنظیم کانال لازم است');
    }
    const previous = await this.loadStoredSettings();
    const next = mergeOmnichannelSettingsPatch(previous, dto);
    if (next.autoPublishMode && next.autoPublishMode !== 'OFF' && previous.autoPublishMode !== next.autoPublishMode) {
      await this.assertAutomationPrerequisites(next.autoPublishMode);
    }
    const saved = await this.appSettings.save(
      this.appSettings.create({ key: OMNICHANNEL_SETTINGS_KEY, value: next }),
    );
    const automation = readAutomationSettings(next);
    await this.audit(who, 'settings_patch', 'SETTINGS', OMNICHANNEL_SETTINGS_KEY, null, dto.reason || null, {
      retailOosPolicy: next.retailOosPolicy || null,
      wholesaleOosPolicy: next.wholesaleOosPolicy || null,
      retailOosChosen: next.retailOosChosen === true,
      wholesaleOosChosen: next.wholesaleOosChosen === true,
      autoPublishEventTypesChosen: next.autoPublishEventTypesChosen === true,
      retrySlaChosen: next.retrySlaChosen === true,
      outboxRetentionChosen: next.outboxRetentionChosen === true,
      autoPublishMode: automation.mode,
      autoDailyCap: automation.dailyCap,
      autoMinGapSeconds: automation.minGapSeconds,
      quietStartHour: automation.quietStartHour,
      quietEndHour: automation.quietEndHour,
      withdrawAction: automation.withdrawAction,
      autoPublishCategoryCount: readAutoPublishCategoryIds(next).length,
    });
    return publicOmnichannelSettings(parseStoredOmnichannelSettings(saved.value), await this.canaryDestinationIds());
  }

  async listTemplates() {
    await this.ensureProductTemplates();
    return this.templates.find({ order: { createdAt: 'DESC' } });
  }

  async ensureProductTemplates() {
    const upgraded: string[] = [];
    for (const channel of ['RETAIL', 'WHOLESALE'] as const) {
      const rows = await this.templates.find({
        where: { provider: MASTER_TEMPLATE_PROVIDER, channel, eventType: 'product.published' },
        order: { version: 'DESC' },
      });
      const latest = rows[0];
      const body = stringifyTemplateLayout(defaultLayoutFor(channel));
      if (!latest) {
        await this.templates.save(this.templates.create({
          provider: MASTER_TEMPLATE_PROVIDER,
          channel,
          eventType: 'product.published',
          locale: 'fa',
          body,
          version: 1,
          enabled: true,
        }));
        upgraded.push(channel);
        continue;
      }
      if (isLegacyProductTemplate(latest.body)) {
        latest.body = body;
        latest.enabled = true;
        await this.templates.save(latest);
        upgraded.push(channel);
      }
    }
    return { ok: true, upgraded };
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
    const incoming = String(dto.body || '').trim();
    const productEvent = dto.eventType === 'product.published';
    const body = productEvent ? productTemplateBodyOrThrow(dto.channel, incoming) : incoming;
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
    if (dto.body !== undefined) {
      row.body = row.eventType === 'product.published'
        ? productTemplateBodyOrThrow(row.channel, dto.body)
        : dto.body;
    }
    if (dto.enabled !== undefined) row.enabled = dto.enabled;
    return this.templates.save(row);
  }

  async listPublications() {
    const rows = await this.publications.find({ order: { createdAt: 'DESC' }, take: 300 });
    return latestPublicationsBySource(rows).slice(0, 100);
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
      // Active statuses only — DONE history must not crowd out pending/dead counters.
      const rows = await this.events.find({
        select: ['status', 'availableAt', 'lockedAt'],
        where: { status: In(['PENDING', 'PROCESSING', 'DEAD']) },
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

  /**
   * Soft-cancel the entire waiting queue. PENDING → DONE + cancelled marker; stale PROCESSING
   * locks only. Linked PENDING/RETRY/PROCESSING deliveries → DEAD. Never DELETE outbox rows.
   */
  async clearWaitingOutbox(dto: ClearWaitingOutboxDto, actor?: Actor) {
    const who = this.requireActor(actor);
    const normalized = normalizeClearWaitingInput(dto);
    if ('error' in normalized) throw new BadRequestException(normalized.error);
    assertNoPlaintextSecrets({ reason: normalized.reason });
    const { cancelledPendingIds, cancelledStaleIds } = await this.outbox.cancelWaiting({
      pendingError: CLEAR_WAITING_ERROR,
      staleError: CLEAR_WAITING_STALE_ERROR,
    });
    const cancelledIds = [...cancelledPendingIds, ...cancelledStaleIds];
    let cancelledDeliveries = 0;
    if (cancelledIds.length) {
      const result = await this.deliveries
        .createQueryBuilder()
        .update(PublicationDeliveryEntity)
        .set({ status: 'DEAD', lastError: CLEAR_WAITING_ERROR })
        .where('"eventId" IN (:...ids)', { ids: cancelledIds })
        .andWhere('status IN (:...st)', { st: ['PENDING', 'RETRY', 'PROCESSING'] })
        .execute();
      cancelledDeliveries = Number(result.affected || 0);
    }
    await this.audit(who, 'outbox_clear_waiting', 'OUTBOX', 'batch', null, normalized.reason, {
      cancelledEvents: cancelledIds.length,
      cancelledPending: cancelledPendingIds.length,
      cancelledStale: cancelledStaleIds.length,
      cancelledDeliveries,
    });
    return {
      cancelledEvents: cancelledIds.length,
      cancelledPending: cancelledPendingIds.length,
      cancelledStale: cancelledStaleIds.length,
      cancelledDeliveries,
      outbox: await this.outboxMetrics(),
    };
  }

  /**
   * Admin blast: enqueue CREATE/UPDATE for products in a category (primary or membership).
   * Bypasses automation daily_cap / quiet hours; still requires connectors + ready destinations.
   * Posts are staggered by autoMinGapSeconds so messengers are not flooded.
   */
  async requeueByCategory(dto: RequeueByCategoryDto, actor?: Actor) {
    const who = this.requireActor(actor);
    const normalized = normalizeRequeueByCategoryInput(dto);
    if ('error' in normalized) throw new BadRequestException(normalized.error);
    assertNoPlaintextSecrets({ reason: normalized.reason });
    const productIds = await this.productIdsForCategory(
      normalized.categoryId,
      normalized.channel,
      REQUEUE_BY_CATEGORY_MAX + 1,
      normalized.offset,
    );
    const hasMore = productIds.length > REQUEUE_BY_CATEGORY_MAX;
    const batch = productIds.slice(0, REQUEUE_BY_CATEGORY_MAX);
    if (normalized.dryRun) {
      return {
        dryRun: true,
        matched: batch.length,
        hasMore,
        offset: normalized.offset,
        nextOffset: hasMore ? normalized.offset + batch.length : null,
        queued: 0,
        skipped: [] as Array<{ productId: string; reason: string }>,
        errors: [] as Array<{ productId: string; error: string }>,
      };
    }
    if (!canEnqueueManualDelivery(areOmnichannelConnectorsEnabled())) {
      throw new BadRequestException(
        'ارسال به پیام‌رسان خاموش است (OMNICHANNEL_CONNECTORS_ENABLED).',
      );
    }
    const automation = readAutomationSettings(await this.loadStoredSettings());
    if (automation.mode !== 'LIVE') {
      const liveCount = await this.publications.count({
        where: {
          channel: normalized.channel,
          sourceType: 'PRODUCT',
          status: In(['READY', 'PUBLISHED', 'PARTIAL']),
        },
      });
      const limit = canaryLimitFor(normalized.channel);
      if (canaryExceeded(liveCount, limit)) {
        throw new BadRequestException(
          `سقف canary کانال ${normalized.channel} برابر ${limit} محصول است؛ برای ارسال دسته‌ای حالت خودکار را «زنده» کنید`,
        );
      }
      const room = Math.max(0, limit - liveCount);
      if (batch.length > room) {
        throw new BadRequestException(
          `در حالت آزمایشی فقط ${room} محصول دیگر جا دارد (سقف ${limit}). حالت را «زنده» کنید یا دستهٔ کوچک‌تری بفرستید`,
        );
      }
    }
    const targets = await this.manualPublishTargets(normalized.channel, normalized.destinationId);
    if (!targets.length) {
      throw new BadRequestException(
        'هیچ مقصد آماده‌ای برای این کانال نیست؛ یک مقصد canary یا مقصد تأییدشده لازم است',
      );
    }
    const gap = automation.minGapSeconds;
    const now = new Date();
    const skipped: Array<{ productId: string; reason: string }> = [];
    const errors: Array<{ productId: string; error: string }> = [];
    let queued = 0;
    let scheduleIndex = 0;
    for (const productId of batch) {
      try {
        const result = await this.enqueueCategoryProduct(productId, {
          channel: normalized.channel,
          destinationId: normalized.destinationId,
          reason: normalized.reason,
          actor: who,
          availableAt: staggeredAvailableAt(scheduleIndex, gap, now),
          targets,
        });
        if (result.queued > 0) {
          queued += result.queued;
          scheduleIndex += 1;
        } else if (result.skipReason) {
          skipped.push({ productId, reason: result.skipReason });
        }
      } catch (err: unknown) {
        errors.push({
          productId,
          error: err instanceof Error ? err.message : 'خطا در صف‌گذاری',
        });
      }
    }
    await this.audit(
      who,
      'publications_requeue_by_category',
      'PUBLICATION',
      'batch',
      normalized.channel,
      normalized.reason,
      {
        categoryId: normalized.categoryId,
        matched: batch.length,
        queued,
        skipped: skipped.length,
        errors: errors.length,
        hasMore,
        destinationId: normalized.destinationId || null,
      },
    );
    return {
      dryRun: false,
      matched: batch.length,
      hasMore,
      offset: normalized.offset,
      nextOffset: hasMore ? normalized.offset + batch.length : null,
      queued,
      skipped,
      errors,
      outbox: await this.outboxMetrics(),
    };
  }

  /** Worker gate: withdrawn publications must not CREATE/UPDATE on messengers. */
  async isPublicationWithdrawn(publicationId: string): Promise<boolean> {
    const id = String(publicationId || '').trim();
    if (!id) return false;
    const row = await this.publications.findOne({ where: { id }, select: ['id', 'status'] });
    return row?.status === 'WITHDRAWN';
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
    const sourceId = kind === 'PRODUCT'
      ? await this.resolveProductSourceId(dto.sourceId)
      : String(dto.sourceId || '').trim();
    const projection = await this.projection.previewSource(kind, sourceId, channel);
    const available = 'available' in projection ? projection.available === true : true;
    const oos = await this.oosDecisionFor(channel, available, kind, sourceId);
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
    const sourceId = String(projection.sourceId || dto.preview.sourceId);
    if (!dryRun && projection.sourceType === 'PRODUCT') {
      // The 10-live-products canary cap protects the test phase; once automation is LIVE the
      // daily cap and verified destinations govern volume instead.
      const automation = readAutomationSettings(await this.loadStoredSettings());
      const liveCount = automation.mode === 'LIVE' ? 0 : await this.publications.count({
        where: { channel: projection.channel, sourceType: 'PRODUCT', status: In(['READY', 'PUBLISHED', 'PARTIAL']) },
      });
      const limit = canaryLimitFor(projection.channel);
      if (automation.mode !== 'LIVE' && canaryExceeded(liveCount, limit)) {
        throw new BadRequestException(`سقف canary کانال ${projection.channel} برابر ${limit} محصول است؛ برای ارسال بیشتر حالت خودکار را «زنده» کنید`);
      }
      const available = 'available' in projection ? projection.available === true : true;
      const oos = await this.oosDecisionFor(projection.channel, available, 'PRODUCT', sourceId);
      const reject = liveOosRejectReason(oos, available);
      if (reject) {
        throw new BadRequestException(
          `کالای ناموجود با سیاست ${oos.policy} در این کانال منتشر نمی‌شود`,
        );
      }
    }
    // Manual send is gated by CONNECTORS only. AUTO_PUBLISH is catalog automation — conflating
    // them caused READY rows with zero deliveries while the UI claimed the post was queued.
    if (!dryRun && !canEnqueueManualDelivery(areOmnichannelConnectorsEnabled())) {
      throw new BadRequestException(
        'ارسال به پیام‌رسان خاموش است (OMNICHANNEL_CONNECTORS_ENABLED). ارسال دستی فقط به این پرچم نیاز دارد؛ انتشار خودکار جداست (OMNICHANNEL_AUTO_PUBLISH).',
      );
    }
    const targets = dryRun ? [] : await this.manualPublishTargets(projection.channel, dto.destinationId);
    if (!dryRun && targets.length === 0) {
      throw new BadRequestException(
        'هیچ مقصد آماده‌ای برای این کانال نیست؛ یک مقصد canary یا مقصد تأییدشده با اجازهٔ ارسال لازم است',
      );
    }
    const liveRemote = dryRun
      ? []
      : await this.liveRemoteMessages(String(projection.sourceType), sourceId, projection.channel);
    const pendingCreates = dryRun
      ? new Set<string>()
      : await this.pendingCreateDestinationsForSource(String(projection.sourceType), sourceId, projection.channel);
    const plan = planManualDeliveries(
      targets.map((dest) => dest.id),
      liveRemote,
      pendingCreates,
    );
    if (!dryRun && plan.creates.length === 0 && plan.updates.length === 0) {
      throw new BadRequestException('ارسال قبلی هنوز در صف است؛ چند ثانیه صبر کنید و دوباره تلاش کنید');
    }
    const saved = await this.publications.manager.transaction(async (manager) => {
      const repo = manager.getRepository(PublicationEntity);
      const sourceType = String(projection.sourceType);
      let row: PublicationEntity;
      if (dryRun) {
        // Drafts stay separate from live rows so «ثبت پیش‌نویس» projection زنده را خراب نکند.
        const draft = await repo.findOne({
          where: { sourceType, sourceId, channel: projection.channel, status: 'DRAFT' },
          order: { createdAt: 'DESC' },
        });
        row = draft
          ? await repo.save(Object.assign(draft, { projection, sourceUpdatedAt: new Date() }))
          : await repo.save(repo.create({
            sourceType,
            sourceId,
            channel: projection.channel,
            sourceUpdatedAt: new Date(),
            projection,
            status: 'DRAFT',
          }));
      } else {
        // One canonical live row per source×channel: prefer non-DRAFT so پیش‌نویس جدا بماند.
        const existing = await repo.findOne({
          where: {
            sourceType,
            sourceId,
            channel: projection.channel,
            status: In(['READY', 'PUBLISHED', 'PARTIAL', 'FAILED', 'WITHDRAWN']),
          },
          order: { createdAt: 'DESC' },
        }) || await repo.findOne({
          where: { sourceType, sourceId, channel: projection.channel },
          order: { createdAt: 'DESC' },
        });
        row = existing
          ? await repo.save(Object.assign(existing, {
            projection,
            sourceUpdatedAt: new Date(),
            status: 'READY',
          }))
          : await repo.save(repo.create({
            sourceType,
            sourceId,
            channel: projection.channel,
            sourceUpdatedAt: new Date(),
            projection,
            status: 'READY',
          }));
        const rendered = await this.publicationPayloadFor(projection);
        if (plan.creates.length) {
          await this.enqueueDeliveries(manager, {
            publicationId: row.id,
            channel: projection.channel,
            action: 'CREATE',
            rendered,
            targets: plan.creates,
            auto: false,
          });
        }
        if (plan.updates.length) {
          await this.enqueueDeliveries(manager, {
            publicationId: row.id,
            channel: projection.channel,
            action: 'UPDATE',
            rendered,
            targets: plan.updates,
            auto: false,
          });
        }
      }
      await manager.getRepository(OmnichannelAuditEntity).save(
        manager.getRepository(OmnichannelAuditEntity).create({
          actorId: who.id,
          action: dryRun ? 'preview_publish' : 'publish',
          entityType: 'PUBLICATION',
          entityId: row.id,
          channel: projection.channel,
          reason: dto.reason || null,
          payload: {
            dryRun,
            sourceId,
            destinationIds: targets.map((dest) => dest.id),
            createCount: plan.creates.length,
            updateCount: plan.updates.length,
          },
        }),
      );
      return row;
    });
    return {
      dryRun,
      publication: saved,
      destinationIds: targets.map((dest) => dest.id),
      createCount: plan.creates.length,
      updateCount: plan.updates.length,
    };
  }

  /**
   * Manual publish targets: an explicit destination (canary or verified), otherwise the same set
   * automation would use — canary only unless automation is LIVE.
   */
  private async manualPublishTargets(channel: string, destinationId?: string) {
    const dests = await this.destinations.find({ where: { enabled: true } });
    const conns = await this.connections.find();
    if (destinationId) {
      const dest = dests.find((row) => row.id === destinationId);
      if (!dest) throw new NotFoundException('مقصد یافت نشد یا غیرفعال است');
      const conn = conns.find((row) => row.id === dest.connectionId);
      if (!conn || !isOmnichannelProvider(conn.provider) || conn.channel !== channel) {
        throw new BadRequestException('این مقصد به کانال فروش انتخاب‌شده تعلق ندارد');
      }
      if (conn.status !== 'ACTIVE') throw new BadRequestException('ابتدا اتصال را روشن کنید');
      if (!isCanarySettings(dest.settings) && !destinationCanPost(dest.settings)) {
        throw new BadRequestException('این مقصد هنوز بررسی نشده؛ اول «بررسی دسترسی ربات» را بزنید');
      }
      return [dest];
    }
    const mode = readAutomationSettings(await this.loadStoredSettings()).mode;
    return selectAutomationDestinations(dests, conns, channel, mode === 'LIVE' ? 'LIVE' : 'CANARY');
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
    // Sibling rows for the same source×channel (legacy duplicates) also leave the channel.
    await this.publications.update(
      { sourceType: row.sourceType, sourceId: row.sourceId, channel: row.channel },
      { status: 'WITHDRAWN' },
    );
    let remoteDeletes = 0;
    if (areOmnichannelConnectorsEnabled()) {
      // Delete every live messenger post for this product/channel — not only this publication id.
      const live = await this.liveRemoteMessages(row.sourceType, row.sourceId, row.channel);
      if (live.length) {
        remoteDeletes = await this.enqueueDeliveries(this.publications.manager, {
          publicationId: row.id,
          channel: row.channel,
          action: 'DELETE',
          rendered: null,
          targets: live.map((msg) => ({
            destinationId: msg.destinationId,
            providerMessageId: msg.providerMessageId,
            publicationId: msg.publicationId,
          })),
          auto: false,
        });
      }
    }
    await this.audit(who, 'withdraw', 'PUBLICATION', saved.id, row.channel, reason, { remoteDeletes });
    return saved;
  }

  /**
   * Withdraw many publications independently. One failure does not roll back others.
   * Envelope matches admin order bulk void: { action, results: [{ id, ok, error? }] }.
   */
  async bulkWithdraw(
    ids: unknown,
    actor?: Actor,
    reason?: string,
  ): Promise<{ action: 'withdraw'; results: Array<{ id: string; ok: boolean; error?: string }> }> {
    const who = this.requireActor(actor);
    const normalized = normalizeBulkPublicationIds(ids);
    if ('error' in normalized) {
      throw new BadRequestException(normalized.error);
    }
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of normalized.ids) {
      try {
        // Per-id withdraw already writes omnichannel_audits.
        await this.withdraw(id, who, reason);
        results.push({ id, ok: true });
      } catch (err: unknown) {
        results.push({
          id,
          ok: false,
          error: err instanceof Error ? err.message : 'خطا در برداشت',
        });
      }
    }
    return { action: 'withdraw', results };
  }

  async testConnection(id: string, actor?: Actor) {
    const who = this.requireActor(actor);
    const row = await this.connections.findOne({ where: { id } });
    if (!row) throw new NotFoundException('اتصال یافت نشد');
    const adapter = this.liveAdapter(row.provider);
    const result = await adapter.validateConnection(row.secretRef);
    await this.audit(who, 'test_connection', 'CONNECTION', row.id, row.channel, null, {
      provider: row.provider,
      ok: result.ok,
      error: result.error || null,
    });
    return result;
  }

  /** Canary ping: one Persian line to this connection's canary destination via its official API. */
  async pingCanary(id: string, actor?: Actor, reason?: string) {
    const who = this.requireActor(actor);
    const row = await this.connections.findOne({ where: { id } });
    if (!row) throw new NotFoundException('اتصال یافت نشد');
    if (row.status !== 'ACTIVE') {
      throw new BadRequestException('ابتدا اتصال را روشن کنید');
    }
    const adapter = this.liveAdapter(row.provider);
    const dests = await this.destinations.find({ where: { connectionId: row.id, enabled: true } });
    const dest = selectCanaryDestinations(dests, [row], row.channel, row.provider)[0];
    if (!dest) {
      throw new BadRequestException('برای این اتصال مقصد canary انتخاب نشده');
    }
    const sent = await adapter.create({
      secretRef: row.secretRef,
      destinationKey: dest.destinationKey,
      chatId: dest.destinationKey,
      channel: row.channel,
      text: CANARY_PING_TEXT,
    });
    await this.audit(who, 'canary_ping', 'CONNECTION', row.id, row.channel, reason || null, {
      provider: row.provider,
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
    if (row.eventId) await this.outbox.requeue(row.eventId);
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
   * Worker/catalog sync: upsert or withdraw local publication rows, then let channel automation
   * (owner opt-in, default OFF) mirror the change to Telegram. Missing schema is skipped (pre-migrate).
   */
  async syncProductPublications(productId: string, channel?: string | null, eventType?: string | null) {
    return this.syncSourcePublications('PRODUCT', productId, channel, eventType);
  }

  async syncBlogPublications(postId: string, channel?: string | null) {
    return this.syncSourcePublications('BLOG_POST', postId, channel, OUTBOX_EVENT_TYPES.BLOG_PUBLISHED);
  }

  async syncCmsPublications(pageId: string, channel?: string | null) {
    return this.syncSourcePublications('CMS_PAGE', pageId, channel, OUTBOX_EVENT_TYPES.CMS_PUBLISHED);
  }

  private async syncSourcePublications(
    sourceType: 'PRODUCT' | 'BLOG_POST' | 'CMS_PAGE',
    sourceId: string,
    channel?: string | null,
    eventType?: string | null,
  ) {
    const id = String(sourceId || '').trim();
    if (!id) return [];
    const results: Array<{ channel: string; action: string; remote?: string }> = [];
    try {
      for (const ch of syncChannelsForEvent(channel)) {
        results.push(await this.syncOneSource(sourceType, id, ch, String(eventType || '')));
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
    eventType: string,
  ): Promise<{ channel: string; action: string; remote?: string }> {
    let projection: Awaited<ReturnType<ChannelProjectionService['previewSource']>>;
    try {
      projection = await this.projection.previewSource(sourceType, sourceId, channel);
    } catch (err) {
      if (err instanceof NotFoundException) {
        await this.publications.update(
          { sourceType, sourceId, channel },
          { status: 'WITHDRAWN' },
        );
        const remote = sourceType === 'PRODUCT'
          ? await this.autoSyncRemote({
            sourceId, channel, eventType, projection: null, publishable: false, available: false,
            localAction: 'withdraw', previousStatus: null,
          })
          : 'none';
        return { channel, action: 'withdraw', remote };
      }
      throw err;
    }
    const existing = await this.publications.findOne({
      where: { sourceType, sourceId, channel },
      order: { createdAt: 'DESC' },
    });
    const previousStatus = existing?.status ?? null;
    const available = 'available' in projection ? projection.available === true : true;
    let action = nextPublicationAction(existing, projection.publishable);
    if (sourceType === 'PRODUCT' && projection.publishable) {
      const oos = await this.oosDecisionFor(channel, available, sourceType, sourceId);
      action = applyOosLocalAction(action, oos.local);
    }
    if (action === 'withdraw' && existing) {
      existing.status = 'WITHDRAWN';
      await this.publications.save(existing);
    } else if (action === 'create') {
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
    } else if (action !== 'skip' && existing) {
      existing.projection = projection;
      existing.sourceUpdatedAt = new Date();
      if (action === 'reopen') existing.status = 'DRAFT';
      await this.publications.save(existing);
    } else if (action !== 'skip') {
      action = 'skip';
    }
    if (sourceType !== 'PRODUCT') return { channel, action };
    const remote = await this.autoSyncRemote({
      sourceId,
      channel,
      eventType,
      projection: projection as unknown as Record<string, unknown>,
      publishable: projection.publishable === true,
      available,
      localAction: action,
      previousStatus,
    });
    return { channel, action, remote };
  }

  /**
   * Channel automation for one product/channel. Reads the owner's mode, OOS policy, chosen events
   * and guardrails; enqueues CREATE/UPDATE/DELETE deliveries through the outbox. Returns a short
   * reason string for logs/tests. Never throws on "nothing to do".
   */
  private async autoSyncRemote(input: {
    sourceId: string;
    channel: 'RETAIL' | 'WHOLESALE';
    eventType: string;
    projection: Record<string, unknown> | null;
    publishable: boolean;
    available: boolean;
    localAction: string;
    previousStatus: string | null;
  }): Promise<string> {
    const stored = await this.loadStoredSettings();
    const automation = readAutomationSettings(stored);
    if (automation.mode === 'OFF') return 'mode_off';
    if (!areOmnichannelConnectorsEnabled() || !isOmnichannelAutoPublishEnabled()) return 'flags_off';
    const chosen = readAutoPublishEventTypes(stored).events;
    const oos = readChannelOos(stored, input.channel);
    const live = await this.liveRemoteMessages('PRODUCT', input.sourceId, input.channel);
    const allowlist = readAutoPublishCategoryIds(stored);
    let publishable = input.publishable;
    if (allowlist.length > 0) {
      const cats = await this.productCategoryIdsFor(input.sourceId);
      const categoryGate = evaluateCategoryAllowlistGate({
        allowlist,
        primaryCategoryId: cats.primaryCategoryId,
        membershipCategoryIds: cats.membershipCategoryIds,
      });
      if (!categoryGate.allow) {
        if (live.length === 0) return 'category_not_allowed';
        // Left the allowlist while a remote post exists → same path as unpublishable.
        publishable = false;
      }
    }
    const intent = resolveRemoteIntent({
      eventType: input.eventType,
      localAction: input.localAction,
      previousStatus: input.previousStatus,
      publishable,
      available: input.available,
      hasRemoteMessage: live.length > 0,
      oosPolicy: oos.policy,
      oosChosen: oos.chosen,
      withdrawAction: automation.withdrawAction,
      chosenEvents: chosen,
    });
    if (intent.action === 'none') return intent.reason;
    const publication = await this.publications.findOne({
      where: { sourceType: 'PRODUCT', sourceId: input.sourceId, channel: input.channel },
      order: { createdAt: 'DESC' },
    });
    if (!publication) return 'no_publication';
    if (intent.action === 'DELETE') {
      const count = await this.enqueueDeliveries(this.publications.manager, {
        publicationId: publication.id,
        channel: input.channel,
        action: 'DELETE',
        rendered: null,
        targets: live.map((msg) => ({ destinationId: msg.destinationId, providerMessageId: msg.providerMessageId, publicationId: msg.publicationId })),
        auto: true,
      });
      return count ? 'delete' : 'delete_deduped';
    }
    if (!input.projection) return 'no_projection';
    const rendered = await this.publicationPayloadFor(input.projection);
    if (intent.action === 'UPDATE') {
      const text = intent.notice
        ? renderUnavailableNotice(await this.publicationVarsFor(input.projection), rendered.parseMode)
        : rendered.text;
      const count = await this.enqueueDeliveries(this.publications.manager, {
        publicationId: publication.id,
        channel: input.channel,
        action: 'UPDATE',
        rendered: { ...rendered, text },
        targets: live.map((msg) => ({ destinationId: msg.destinationId, providerMessageId: msg.providerMessageId, publicationId: msg.publicationId })),
        auto: true,
      });
      return count ? (intent.notice ? 'update_notice' : 'update') : 'update_deduped';
    }
    const [dests, conns, counters] = await Promise.all([
      this.destinations.find({ where: { enabled: true } }),
      this.connections.find(),
      this.automationCounters(input.channel),
    ]);
    const gate = evaluateAutomationGate({
      mode: automation.mode,
      eventType: input.eventType,
      chosenEvents: chosen,
      connectorsEnabled: true,
      autoPublishFlag: true,
      sentToday: counters.sentToday,
      dailyCap: automation.dailyCap,
      lastScheduledAt: counters.lastScheduledAt,
      minGapSeconds: automation.minGapSeconds,
      quietStartHour: automation.quietStartHour,
      quietEndHour: automation.quietEndHour,
      now: new Date(),
      createTrigger: true,
    });
    if (gate.allow === false) return gate.reason;
    const withMessage = new Set(live.map((msg) => msg.destinationId));
    const pending = await this.pendingCreateDestinations(publication.id);
    const targets = selectAutomationDestinations(dests, conns, input.channel, automation.mode)
      .filter((dest) => !withMessage.has(dest.id) && !pending.has(dest.id))
      .map((dest) => ({ destinationId: dest.id }));
    if (!targets.length) return 'no_destination';
    const count = await this.enqueueDeliveries(this.publications.manager, {
      publicationId: publication.id,
      channel: input.channel,
      action: 'CREATE',
      rendered,
      targets,
      auto: true,
      availableAt: gate.sendAt,
    });
    if (count && publication.status === 'DRAFT') {
      publication.status = 'READY';
      await this.publications.save(publication);
    }
    return count ? (gate.deferred ? 'create_deferred' : 'create') : 'create_deduped';
  }

  /** Destinations with a CREATE still in flight for this publication (avoid double posts). */
  private async pendingCreateDestinations(publicationId: string): Promise<Set<string>> {
    const rows = await this.deliveries.find({
      where: { publicationId, action: 'CREATE', status: In(['PENDING', 'PROCESSING', 'RETRY']) },
      select: ['destinationId'],
    });
    return new Set(rows.map((row) => row.destinationId));
  }

  /** Pending CREATEs across every publication row for this source×channel. */
  private async pendingCreateDestinationsForSource(
    sourceType: string,
    sourceId: string,
    channel: string,
  ): Promise<Set<string>> {
    const pubs = await this.publications.find({ where: { sourceType, sourceId, channel }, select: ['id'] });
    if (!pubs.length) return new Set();
    const rows = await this.deliveries.find({
      where: {
        publicationId: In(pubs.map((row) => row.id)),
        action: 'CREATE',
        status: In(['PENDING', 'PROCESSING', 'RETRY']),
      },
      select: ['destinationId'],
    });
    return new Set(rows.map((row) => row.destinationId));
  }

  /**
   * Messages that currently exist in the messenger for this source/channel: a SUCCEEDED CREATE not
   * followed by a DELETE that succeeded or is still queued. One entry per destination (spans every
   * publication row so republish edits the same post).
   */
  private async liveRemoteMessages(sourceType: string, sourceId: string, channel: string) {
    const pubs = await this.publications.find({ where: { sourceType, sourceId, channel }, select: ['id'] });
    if (!pubs.length) return [] as Array<{ publicationId: string; destinationId: string; providerMessageId: string }>;
    const rows = await this.deliveries.find({
      where: { publicationId: In(pubs.map((row) => row.id)) },
      order: { createdAt: 'ASC' },
    });
    return foldLiveRemoteMessages(rows);
  }

  /** Primary categoryId + membership rows for category allowlist (auto publish only). */
  private async productCategoryIdsFor(productId: string): Promise<{
    primaryCategoryId: string | null;
    membershipCategoryIds: string[];
  }> {
    const [product, memberships] = await Promise.all([
      this.products.findOne({ where: { id: productId }, select: ['id', 'categoryId'] }),
      this.productCategoryMemberships.find({ where: { productId }, select: ['categoryId'] }),
    ]);
    return {
      primaryCategoryId: product?.categoryId ?? null,
      membershipCategoryIds: memberships.map((row) => row.categoryId),
    };
  }

  /** Auto CREATE counters for the gate: distinct posts today (Tehran day) and the latest scheduled send. */
  private async automationCounters(channel: string): Promise<{ sentToday: number; lastScheduledAt: Date | null }> {
    const dayStart = tehranDayStart(new Date());
    const base = () => this.events.createQueryBuilder('e')
      .where('e.eventType = :type', { type: OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED })
      .andWhere('e.channel = :channel', { channel })
      .andWhere("e.payload->>'action' = 'CREATE'")
      .andWhere("e.payload->>'auto' = 'true'");
    const [today, last] = await Promise.all([
      base().andWhere('e.createdAt >= :dayStart', { dayStart }).select("COUNT(DISTINCT e.payload->>'publicationId')", 'n').getRawOne<{ n: string }>(),
      base().select('MAX(e.availableAt)', 'last').getRawOne<{ last: Date | string | null }>(),
    ]);
    const lastRaw = last?.last ?? null;
    const lastScheduledAt = lastRaw ? new Date(lastRaw) : null;
    return {
      sentToday: Number(today?.n || 0),
      lastScheduledAt: lastScheduledAt && !Number.isNaN(lastScheduledAt.getTime()) ? lastScheduledAt : null,
    };
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
    if (eventType === 'product.published') await this.ensureProductTemplates();
    const rows = await this.templates.find({
      where: { provider: MASTER_TEMPLATE_PROVIDER, channel, eventType, enabled: true },
      order: { version: 'DESC' },
      take: 1,
    });
    const layout = parseTemplateLayout(rows[0]?.body, channel);
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
    vars.images = imageCandidates(product.images);
    return vars;
  }

  private async resolveProductSourceId(raw: string): Promise<string> {
    const key = extractProductLookupKey(raw);
    if (!key) throw new BadRequestException('شناسه، کد یا لینک محصول را بگذارید');
    const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
    if (looksUuid) {
      const byId = await this.products.findOne({ where: { id: key }, select: ['id'] });
      if (byId) return byId.id;
    }
    const bySlug = await this.products.findOne({ where: { slug: key }, select: ['id'] });
    if (bySlug) return bySlug.id;
    const bySku = await this.products.findOne({ where: { sku: key }, select: ['id'] });
    if (bySku) return bySku.id;
    throw new NotFoundException('محصول یافت نشد');
  }

  /** Active products in category (primary categoryId or membership), channel-visible. */
  private async productIdsForCategory(
    categoryId: string,
    channel: 'RETAIL' | 'WHOLESALE',
    limit: number,
    offset: number,
  ): Promise<string[]> {
    const visibility =
      channel === 'RETAIL'
        ? 'p."showOnRetail" IS NOT FALSE'
        : 'p."showOnWholesale" IS NOT FALSE';
    const rows: Array<{ id: string }> = await this.products.query(
      `
      SELECT DISTINCT p.id
      FROM products p
      LEFT JOIN product_category_membership m ON m."productId" = p.id
      WHERE UPPER(COALESCE(p.status, '')) = 'ACTIVE'
        AND ${visibility}
        AND (p."categoryId" = $1 OR m."categoryId" = $1)
      ORDER BY p.id
      LIMIT $2 OFFSET $3
      `,
      [categoryId, limit, offset],
    );
    return rows.map((row) => row.id);
  }

  /**
   * One product for category requeue — same CREATE/UPDATE plan as manual publish,
   * with an explicit availableAt for messenger spacing.
   */
  private async enqueueCategoryProduct(
    productId: string,
    opts: {
      channel: 'RETAIL' | 'WHOLESALE';
      destinationId?: string;
      reason: string;
      actor: Actor;
      availableAt: Date;
      targets: ChannelDestinationEntity[];
    },
  ): Promise<{ queued: number; skipReason?: string }> {
    const { projection } = await this.preview({
      channel: opts.channel,
      sourceType: 'PRODUCT',
      sourceId: productId,
    });
    if (!projection.publishable) {
      return { queued: 0, skipReason: projection.rejectReason || 'غیرقابل انتشار' };
    }
    const sourceId = String(projection.sourceId || productId);
    const available = 'available' in projection ? projection.available === true : true;
    const oos = await this.oosDecisionFor(opts.channel, available, 'PRODUCT', sourceId);
    const reject = liveOosRejectReason(oos, available);
    if (reject) {
      return { queued: 0, skipReason: `ناموجود (${oos.policy})` };
    }
    const liveRemote = await this.liveRemoteMessages('PRODUCT', sourceId, opts.channel);
    const pendingCreates = await this.pendingCreateDestinationsForSource(
      'PRODUCT',
      sourceId,
      opts.channel,
    );
    const plan = planManualDeliveries(
      opts.targets.map((dest) => dest.id),
      liveRemote,
      pendingCreates,
    );
    if (plan.creates.length === 0 && plan.updates.length === 0) {
      return { queued: 0, skipReason: 'ارسال قبلی هنوز در صف است' };
    }
    const rendered = await this.publicationPayloadFor(projection);
    let queued = 0;
    await this.publications.manager.transaction(async (manager) => {
      const repo = manager.getRepository(PublicationEntity);
      const withdrawn = await repo.findOne({
        where: {
          sourceType: 'PRODUCT',
          sourceId,
          channel: opts.channel,
          status: 'WITHDRAWN',
        },
        order: { createdAt: 'DESC' },
      });
      if (withdrawn) {
        return;
      }
      const existing = await repo.findOne({
        where: {
          sourceType: 'PRODUCT',
          sourceId,
          channel: opts.channel,
          status: In(['READY', 'PUBLISHED', 'PARTIAL', 'FAILED']),
        },
        order: { createdAt: 'DESC' },
      }) || await repo.findOne({
        where: {
          sourceType: 'PRODUCT',
          sourceId,
          channel: opts.channel,
          status: In(['DRAFT', 'READY', 'PUBLISHED', 'PARTIAL', 'FAILED']),
        },
        order: { createdAt: 'DESC' },
      });
      const row = existing
        ? await repo.save(Object.assign(existing, {
          projection,
          sourceUpdatedAt: new Date(),
          status: 'READY',
        }))
        : await repo.save(repo.create({
          sourceType: 'PRODUCT',
          sourceId,
          channel: opts.channel,
          sourceUpdatedAt: new Date(),
          projection,
          status: 'READY',
        }));
      if (plan.creates.length) {
        queued += await this.enqueueDeliveries(manager, {
          publicationId: row.id,
          channel: opts.channel,
          action: 'CREATE',
          rendered,
          targets: plan.creates,
          auto: false,
          availableAt: opts.availableAt,
        });
      }
      if (plan.updates.length) {
        queued += await this.enqueueDeliveries(manager, {
          publicationId: row.id,
          channel: opts.channel,
          action: 'UPDATE',
          rendered,
          targets: plan.updates,
          auto: false,
          availableAt: opts.availableAt,
        });
      }
      await manager.getRepository(OmnichannelAuditEntity).save(
        manager.getRepository(OmnichannelAuditEntity).create({
          actorId: opts.actor.id,
          action: 'publish_category_requeue',
          entityType: 'PUBLICATION',
          entityId: row.id,
          channel: opts.channel,
          reason: opts.reason,
          payload: {
            productId,
            createCount: plan.creates.length,
            updateCount: plan.updates.length,
            availableAt: opts.availableAt.toISOString(),
          },
        }),
      );
    });
    if (queued === 0) {
      const stillWithdrawn = await this.publications.findOne({
        where: {
          sourceType: 'PRODUCT',
          sourceId,
          channel: opts.channel,
          status: 'WITHDRAWN',
        },
        select: ['id'],
      });
      if (stillWithdrawn) {
        return { queued: 0, skipReason: 'از کانال برداشته شده؛ دوباره اضافه نشد' };
      }
    }
    return { queued };
  }

  /**
   * One outbox event + one delivery row per target. Payload carries the rendered post and its
   * Telegram options; the worker only maps them to Bot API parameters. Returns rows created.
   */
  private async enqueueDeliveries(
    manager: EntityManager,
    input: {
      publicationId: string;
      channel: string;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      rendered: RenderedPublication | null;
      targets: Array<{ destinationId: string; providerMessageId?: string; publicationId?: string }>;
      auto: boolean;
      availableAt?: Date;
    },
  ): Promise<number> {
    const deliveryRepo = manager.getRepository(PublicationDeliveryEntity);
    // Stamped so a post can be recreated after an OOS delete; in-flight/live checks stop double posts.
    const stamp = Date.now();
    let created = 0;
    for (const target of input.targets) {
      const publicationId = target.publicationId || input.publicationId;
      const queued = await this.outbox.enqueue({
        operationId: `pub:${publicationId}:${target.destinationId}:${input.action}:${stamp}`,
        eventType: OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED,
        aggregateType: 'PUBLICATION',
        aggregateId: publicationId,
        channel: input.channel,
        availableAt: input.availableAt,
        payload: {
          publicationId,
          destinationId: target.destinationId,
          action: input.action,
          channel: input.channel,
          auto: input.auto,
          ...(target.providerMessageId ? { providerMessageId: target.providerMessageId } : {}),
          ...(input.rendered ? this.deliveryPayload(input.rendered) : {}),
        },
      }, manager);
      if (!queued.id) continue;
      await deliveryRepo.save(
        deliveryRepo.create({
          publicationId,
          destinationId: target.destinationId,
          eventId: queued.id,
          action: input.action,
          status: 'PENDING',
          providerMessageId: target.providerMessageId || null,
          nextAttemptAt: input.availableAt || null,
        }),
      );
      created += 1;
    }
    return created;
  }

  private deliveryPayload(rendered: RenderedPublication): Record<string, unknown> {
    return {
      text: rendered.text,
      photoUrls: rendered.photoUrls,
      parseMode: rendered.parseMode,
      buttons: rendered.buttons,
      silent: rendered.silent,
      protectContent: rendered.protectContent,
      captionAbove: rendered.captionAbove,
      linkPreview: rendered.linkPreview,
    };
  }

  /** Turning automation on needs somewhere to post; LIVE additionally needs a verified channel or canary. */
  private async assertAutomationPrerequisites(mode: 'CANARY' | 'LIVE') {
    const dests = await this.destinations.find({ where: { enabled: true } });
    const conns = await this.connections.find();
    const any = ['RETAIL', 'WHOLESALE'].some(
      (channel) => selectAutomationDestinations(dests, conns, channel, mode).length > 0,
    );
    if (!any) {
      throw new BadRequestException(
        mode === 'CANARY'
          ? 'برای حالت آزمایشی، یک مقصد canary روی یک اتصال فعال (تلگرام، بله یا روبیکا) لازم است'
          : 'برای حالت زنده، دست‌کم یک مقصد فعال و بررسی‌شده (ربات ادمین با اجازه ارسال، یا ارسال آزمایشی موفق) لازم است',
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

  /** Legacy `retail`/`wholesale` keep the Telegram canary; `byProvider` carries every platform. */
  private async canaryDestinationIds() {
    try {
      const dests = await this.destinations.find();
      const conns = await this.connections.find();
      return {
        retail: findCanaryDestinationId(dests, conns, 'RETAIL'),
        wholesale: findCanaryDestinationId(dests, conns, 'WHOLESALE'),
        byProvider: {
          RETAIL: canaryDestinationIdsByProvider(dests, conns, 'RETAIL'),
          WHOLESALE: canaryDestinationIdsByProvider(dests, conns, 'WHOLESALE'),
        },
      };
    } catch (err) {
      if (isMissingRelationError(err)) return { retail: null, wholesale: null };
      throw err;
    }
  }

  /** One canary per (provider, sales channel); a second one is a conflict, not a silent replace. */
  private async assertUniqueCanary(provider: string, channel: string, exceptId?: string) {
    if (!isOmnichannelProvider(provider)) {
      throw new BadRequestException('پلتفرم این اتصال پشتیبانی نمی‌شود');
    }
    const dests = await this.destinations.find();
    const conns = await this.connections.find();
    const current = findCanaryDestinationId(dests, conns, channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL', provider);
    if (current && current !== exceptId) {
      throw new ConflictException(`برای این کانال ${capabilitiesFor(provider).label} قبلاً مقصد canary ثبت شده`);
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
