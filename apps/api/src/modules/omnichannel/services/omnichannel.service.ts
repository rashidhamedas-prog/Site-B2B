import {
  BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { ChannelProjectionService } from './channel-projection.service';
import { canaryExceeded, canaryLimitFor } from '../../product/channel-projection';
import { normalizeSalesChannel } from '../../product/channel-product-projection';
import { ProductEntity } from '../../product/entities/product.entity';
import { PreviewDto, CreatePublicationDto, PatchDestinationDto, PatchOmnichannelSettingsDto, PutSecretDto } from '../dto/omnichannel.dto';
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
  evaluateAutomationGate,
  resolveRemoteIntent,
  selectAutomationDestinations,
  tehranDayStart,
} from '../publication-automation';
import { CANARY_PING_TEXT } from '../canary-ping';
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
    const body = productEvent && isLegacyProductTemplate(incoming)
      ? stringifyTemplateLayout(defaultLayoutFor(dto.channel))
      : incoming || (productEvent ? stringifyTemplateLayout(defaultLayoutFor(dto.channel)) : incoming);
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
      row.body = row.eventType === 'product.published' && isLegacyProductTemplate(dto.body)
        ? stringifyTemplateLayout(defaultLayoutFor(row.channel))
        : dto.body;
    }
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
    if (!dryRun && projection.sourceType === 'PRODUCT') {
      // The 10-live-products canary cap protects the test phase; once automation is LIVE the
      // daily cap and verified destinations govern volume instead.
      const automation = readAutomationSettings(await this.loadStoredSettings());
      const live = automation.mode === 'LIVE' ? 0 : await this.publications.count({
        where: { channel: projection.channel, sourceType: 'PRODUCT', status: In(['READY', 'PUBLISHED', 'PARTIAL']) },
      });
      const limit = canaryLimitFor(projection.channel);
      if (automation.mode !== 'LIVE' && canaryExceeded(live, limit)) {
        throw new BadRequestException(`سقف canary کانال ${projection.channel} برابر ${limit} محصول است؛ برای ارسال بیشتر حالت خودکار را «زنده» کنید`);
      }
      const available = 'available' in projection ? projection.available === true : true;
      const oos = await this.oosDecisionFor(projection.channel, available, 'PRODUCT', String(projection.sourceId || dto.preview.sourceId));
      const reject = liveOosRejectReason(oos, available);
      if (reject) {
        throw new BadRequestException(
          `کالای ناموجود با سیاست ${oos.policy} در این کانال منتشر نمی‌شود`,
        );
      }
    }
    const targets = dryRun ? [] : await this.manualPublishTargets(projection.channel, dto.destinationId);
    const saved = await this.publications.manager.transaction(async (manager) => {
      const row = await manager.getRepository(PublicationEntity).save(
        manager.getRepository(PublicationEntity).create({
          sourceType: projection.sourceType,
          sourceId: String(projection.sourceId || dto.preview.sourceId),
          channel: projection.channel,
          sourceUpdatedAt: new Date(),
          projection,
          status: dryRun ? 'DRAFT' : 'READY',
        }),
      );
      if (!dryRun && isOmnichannelAutoPublishEnabled() && areOmnichannelConnectorsEnabled()) {
        const rendered = await this.publicationPayloadFor(projection);
        await this.enqueueDeliveries(manager, {
          publicationId: row.id,
          channel: projection.channel,
          action: 'CREATE',
          rendered,
          targets: targets.map((dest) => ({ destinationId: dest.id })),
          auto: false,
        });
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
            sourceId: String(projection.sourceId || dto.preview.sourceId),
            destinationIds: targets.map((dest) => dest.id),
          },
        }),
      );
      return row;
    });
    return { dryRun, publication: saved, destinationIds: targets.map((dest) => dest.id) };
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
    let remoteDeletes = 0;
    if (areOmnichannelConnectorsEnabled()) {
      const live = (await this.liveRemoteMessages(row.sourceType, row.sourceId, row.channel))
        .filter((msg) => msg.publicationId === row.id);
      if (live.length) {
        remoteDeletes = await this.enqueueDeliveries(this.publications.manager, {
          publicationId: row.id,
          channel: row.channel,
          action: 'DELETE',
          rendered: null,
          targets: live.map((msg) => ({ destinationId: msg.destinationId, providerMessageId: msg.providerMessageId })),
          auto: false,
        });
      }
    }
    await this.audit(who, 'withdraw', 'PUBLICATION', saved.id, row.channel, reason, { remoteDeletes });
    return saved;
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
    const intent = resolveRemoteIntent({
      eventType: input.eventType,
      localAction: input.localAction,
      previousStatus: input.previousStatus,
      publishable: input.publishable,
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

  /**
   * Messages that currently exist in Telegram for this source/channel: a SUCCEEDED CREATE not
   * followed by a DELETE that succeeded or is still queued. Spans every publication row.
   */
  private async liveRemoteMessages(sourceType: string, sourceId: string, channel: string) {
    const pubs = await this.publications.find({ where: { sourceType, sourceId, channel }, select: ['id'] });
    if (!pubs.length) return [] as Array<{ publicationId: string; destinationId: string; providerMessageId: string }>;
    const rows = await this.deliveries.find({
      where: { publicationId: In(pubs.map((row) => row.id)) },
      order: { createdAt: 'ASC' },
    });
    const live = new Map<string, { publicationId: string; destinationId: string; providerMessageId: string }>();
    for (const row of rows) {
      const key = `${row.publicationId}:${row.destinationId}`;
      if (row.action === 'CREATE' && row.status === 'SUCCEEDED' && row.providerMessageId) {
        live.set(key, { publicationId: row.publicationId, destinationId: row.destinationId, providerMessageId: row.providerMessageId });
      } else if (row.action === 'DELETE' && ['SUCCEEDED', 'PENDING', 'PROCESSING', 'RETRY'].includes(row.status)) {
        live.delete(key);
      }
    }
    return [...live.values()];
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
