import {
  BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { ChannelProjectionService } from './channel-projection.service';
import { canaryExceeded, canaryLimitFor } from '../../product/channel-projection';
import { normalizeSalesChannel } from '../../product/channel-product-projection';
import { ProductEntity } from '../../product/entities/product.entity';
import { ProductCategoryMembershipEntity } from '../../product/entities/product-category-membership.entity';
import {
  PreviewDto,
  CreatePublicationDto,
  ClearWaitingOutboxDto,
  ReviveConnectorDisabledDto,
  PatchDestinationDto,
  PatchConnectionPublishSettingsDto,
  PatchDestinationPublishSettingsDto,
  PatchOmnichannelSettingsDto,
  PutSecretDto,
  RequeueByCategoryDto,
  CreateTemplateDto,
  PatchTemplateDto,
  CreateDestinationDto,
  CreateConnectionDto,
  PatchConnectionDto,
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
  DEFER_CREATE_SQL,
  MARK_CREATE_HOLD_SQL,
  MARK_CREATE_SUCCEEDED_SQL,
  MARK_CREATE_UNCONFIRMED_SQL,
  REACTIVATE_CREATE_SQL,
  RESERVE_CREATE_COUNTS_SQL,
  RESERVE_CREATE_LOCK_ROW_SQL,
} from './reserve-create-send-sql';
import {
  areOmnichannelConnectorsEnabled,
  DELIVERY_DEFERRED_REASONS,
  isOmnichannelAutoPublishEnabled,
  isOmnichannelProvider,
  isOmnichannelProviderEnabled,
  OUTBOX_EVENT_TYPES,
} from '../omnichannel.constants';
import {
  FREE_POST_SOURCE_TYPE,
  assertFreePostEnabled,
  assertFreePostReason,
  buildFreePostProjection,
  catalogPublicationsForReconcile,
  freePostQuietBlock,
  parseFreePostInput,
  renderFreePost,
} from '../free-post';
import { capabilitiesFor } from '../provider-capabilities';
import { buildDedupeKey, OutboxService, sanitizeOutboxPayload } from './outbox.service';

/** Postgres unique_violation (23505), raw driver error or TypeORM QueryFailedError. */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; driverError?: { code?: string } } | null;
  return e?.code === '23505' || e?.driverError?.code === '23505';
}

function insertedId(raw: unknown): string | null {
  const rows = Array.isArray(raw) && raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number'
    ? raw[0]
    : raw;
  if (!Array.isArray(rows) || !rows.length) return null;
  const id = (rows[0] as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}
import { applyReconcileIntents, reconcilePublicationIntents } from './reconcile';
import { applyOosLocalAction, nextPublicationAction, syncChannelsForEvent } from './publication-sync';
import { AppSettingEntity } from '../../settings/entities/app-setting.entity';
import {
  annotatePreviewOos,
  assertOmnichannelSettingsInput,
  destinationCanPost,
  findCanaryDestinationId,
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
  remainingDailyCreates,
  evaluateCategoryAllowlistGate,
  foldLiveRemoteMessages,
  latestPublicationsBySource,
  planManualDeliveries,
  resolveRemoteIntent,
  selectAutomationDestinations,
  selectAutomationDestinationsForConnection,
  tehranDayStart,
} from '../publication-automation';
import {
  buildIdempotencyKey,
  capJitterMs,
  contentHash,
  dailyCapForProvider,
  decideCreateEnqueue,
  decideDailyCap,
  decideMinGap,
  decideRetryAgainstSibling,
  decideSendWinner,
  effectiveMinGapSeconds,
  maxSendsPerMinute,
  planCreateSend,
  publicationToReuse,
  staleDeliveryHours,
  type ExistingCreateRow,
} from '../delivery-idempotency';
import { effectiveReviveLimit, isBulkReviveEnabled } from '../delivery-hold-policy';
import { ACTIVE_CREATE_INDEX_PREDICATE, ACTIVE_MUTATION_INDEX_PREDICATE } from '../delivery-dedupe-sql';
import {
  publicConnectionPublishSettings,
  resolveConnectionPublishSettings,
  seedConnectionPublishFromGlobal,
} from '../connection-publish-settings';
import {
  assertDestinationPublishSettingsInput,
  hasDestinationPublishPatch,
  mergeDestinationPublishSettingsPatch,
  parseDestinationPublishSettings,
  publicDestinationPublishSettings,
  resolveDestinationPublishSettings,
  seedDestinationPublishFromConnection,
} from '../destination-publish-settings';
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
  resolveGateBlockReason,
  summarizeDeadByEventType,
  type GateBlockReason,
} from '../gate-block-reason';
import { tehranHour } from '../../../lib/tehran-time';
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
import { assertNoPlaintextSecrets, looksLikeSecretValue, toPublicConnection, toPublicDestination } from '../omnichannel-secrets';
import { OmnichannelTokenVaultService } from './omnichannel-token-vault.service';
import {
  assertNoVaultLeak,
  assertTokenShape,
  peekVaultMeta,
  peekVaultToken,
  providerFromSecretRef,
  setVaultOverlayEntry,
} from '../omnichannel-token-vault';
import { isNonRetryableProviderError, redactProviderError } from '../adapters/telegram-errors';
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
 * Channel-wide fallback template (connectionId null) still uses TELEGRAM as storage key.
 * Per-bot templates bind connectionId and override the fallback for that connection only.
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
    const [rows, global] = await Promise.all([
      this.connections.find({ order: { createdAt: 'DESC' } }),
      this.loadStoredSettings(),
    ]);
    return rows.map((row) => this.toPublicConnectionWithPublish(row, global));
  }

  private toPublicConnectionWithPublish(
    row: ChannelConnectionEntity,
    global: Awaited<ReturnType<OmnichannelService['loadStoredSettings']>>,
  ) {
    const channel = row.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    const resolved = resolveConnectionPublishSettings(row.publishSettings, global, channel);
    return {
      ...toPublicConnection(row),
      publishSettings: publicConnectionPublishSettings(resolved),
    };
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
    const global = await this.loadStoredSettings();
    const channel = dto.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    const saved = await this.connections.save(
      this.connections.create({
        ...dto,
        status: 'DISABLED',
        publishSettings: seedConnectionPublishFromGlobal(global, channel) as Record<string, unknown>,
      }),
    );
    return this.toPublicConnectionWithPublish(saved, global);
  }

  async patchConnection(id: string, dto: PatchConnectionDto) {
    assertNoPlaintextSecrets(dto);
    const row = await this.connections.findOne({ where: { id } });
    if (!row) throw new NotFoundException('اتصال یافت نشد');
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.secretRef !== undefined) row.secretRef = dto.secretRef;
    if (dto.status !== undefined) row.status = dto.status;
    const saved = await this.connections.save(row);
    return this.toPublicConnectionWithPublish(saved, await this.loadStoredSettings());
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
    const [rows, conns, global] = await Promise.all([
      this.destinations.find({ order: { createdAt: 'DESC' } }),
      this.connections.find(),
      this.loadStoredSettings(),
    ]);
    const connById = new Map(conns.map((row) => [row.id, row]));
    return rows.map((row) => {
      const conn = connById.get(row.connectionId);
      const channel = conn?.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
      const resolved = resolveDestinationPublishSettings(
        row.publishSettings,
        conn?.publishSettings,
        global,
        channel,
      );
      return {
        ...toPublicDestination(row),
        publishSettings: publicDestinationPublishSettings(resolved),
      };
    });
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
      await this.assertUniqueCanary(connection.id);
    }
    const global = await this.loadStoredSettings();
    const channel = connection.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    const publishSettings = seedDestinationPublishFromConnection(
      connection.publishSettings,
      global,
      channel,
    ) as Record<string, unknown>;
    const saved = await this.destinations.save(
      this.destinations.create({
        connectionId: dto.connectionId,
        destinationKey: dto.destinationKey,
        displayName: dto.displayName,
        enabled: dto.enabled ?? true,
        settings,
        publishSettings,
      }),
    );
    return {
      ...toPublicDestination(saved),
      publishSettings: publicDestinationPublishSettings(
        resolveDestinationPublishSettings(saved.publishSettings, connection.publishSettings, global, channel),
      ),
    };
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
        await this.assertUniqueCanary(connection.id, row.id);
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

  /**
   * Global blob: retry SLA + retention only.
   * Automation / OOS / categories require destinationId (preferred) or connectionId compat.
   */
  async patchSettings(dto: PatchOmnichannelSettingsDto, actor?: Actor) {
    const who = this.requireActor(actor);
    assertOmnichannelSettingsInput(dto);
    const publishPatch = hasDestinationPublishPatch({
      oosPolicy: dto.oosPolicy,
      autoPublishEventTypes: dto.autoPublishEventTypes,
      autoPublishMode: dto.autoPublishMode,
      autoDailyCap: dto.autoDailyCap,
      autoMinGapSeconds: dto.autoMinGapSeconds,
      quietStartHour: dto.quietStartHour,
      quietEndHour: dto.quietEndHour,
      withdrawAction: dto.withdrawAction,
      autoPublishCategoryIds: dto.autoPublishCategoryIds,
    }) || !!(dto.retailOosPolicy || dto.wholesaleOosPolicy);
    if (publishPatch) {
      const oosForDest = dto.oosPolicy
        || dto.wholesaleOosPolicy
        || dto.retailOosPolicy;
      const patchBody = {
        oosPolicy: oosForDest,
        autoPublishEventTypes: dto.autoPublishEventTypes,
        autoPublishMode: dto.autoPublishMode,
        autoDailyCap: dto.autoDailyCap,
        autoMinGapSeconds: dto.autoMinGapSeconds,
        quietStartHour: dto.quietStartHour,
        quietEndHour: dto.quietEndHour,
        withdrawAction: dto.withdrawAction,
        autoPublishCategoryIds: dto.autoPublishCategoryIds,
        reason: dto.reason,
      };
      if (dto.destinationId) {
        return this.patchDestinationPublishSettings(dto.destinationId, patchBody, actor);
      }
      throw new BadRequestException(
        'قواعد انتشار باید برای هر مقصد جدا ذخیره شود؛ destinationId لازم است (نه connectionId)',
      );
    }
    const hasLeftovers = dto.retrySlaSeconds != null || dto.outboxRetentionDays != null;
    if (!hasLeftovers) {
      throw new BadRequestException('حداقل یک تنظیم سراسری (بازه تلاش / نگهداری outbox) لازم است');
    }
    const previous = await this.loadStoredSettings();
    const next = mergeOmnichannelSettingsPatch(previous, {
      retrySlaSeconds: dto.retrySlaSeconds,
      outboxRetentionDays: dto.outboxRetentionDays,
    });
    const saved = await this.appSettings.save(
      this.appSettings.create({ key: OMNICHANNEL_SETTINGS_KEY, value: next }),
    );
    await this.audit(who, 'settings_patch', 'SETTINGS', OMNICHANNEL_SETTINGS_KEY, null, dto.reason || null, {
      retrySlaChosen: next.retrySlaChosen === true,
      outboxRetentionChosen: next.outboxRetentionChosen === true,
    });
    return publicOmnichannelSettings(parseStoredOmnichannelSettings(saved.value), await this.canaryDestinationIds());
  }

  async getConnectionPublishSettings(connectionId: string) {
    const row = await this.connections.findOne({ where: { id: connectionId } });
    if (!row) throw new NotFoundException('اتصال یافت نشد');
    const global = await this.loadStoredSettings();
    const channel = row.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    return {
      connectionId: row.id,
      provider: row.provider,
      channel,
      name: row.name,
      ...publicConnectionPublishSettings(resolveConnectionPublishSettings(row.publishSettings, global, channel)),
    };
  }

  /**
   * Operator writes moved to destinations/:id/publish-settings.
   * Connection blob stays read-only seed/compat for dual-read.
   */
  async patchConnectionPublishSettings(
    _connectionId: string,
    _dto: PatchConnectionPublishSettingsDto,
    _actor?: Actor,
  ) {
    throw new BadRequestException(
      'قواعد انتشار دیگر روی ربات ذخیره نمی‌شود؛ برای هر کانال از destinations/:id/publish-settings استفاده کنید',
    );
  }

  async getDestinationPublishSettings(destinationId: string) {
    const dest = await this.destinations.findOne({ where: { id: destinationId } });
    if (!dest) throw new NotFoundException('مقصد یافت نشد');
    const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
    if (!conn) throw new NotFoundException('اتصال یافت نشد');
    const global = await this.loadStoredSettings();
    const channel = conn.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    const resolved = resolveDestinationPublishSettings(
      dest.publishSettings,
      conn.publishSettings,
      global,
      channel,
    );
    return {
      destinationId: dest.id,
      connectionId: conn.id,
      provider: conn.provider,
      channel,
      displayName: dest.displayName,
      ...publicDestinationPublishSettings(resolved),
    };
  }

  async patchDestinationPublishSettings(
    destinationId: string,
    dto: PatchDestinationPublishSettingsDto,
    actor?: Actor,
  ) {
    const who = this.requireActor(actor);
    try {
      assertDestinationPublishSettingsInput(dto);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'تنظیمات نامعتبر');
    }
    if (!hasDestinationPublishPatch(dto)) {
      throw new BadRequestException('حداقل یک قاعده انتشار لازم است');
    }
    const dest = await this.destinations.findOne({ where: { id: destinationId } });
    if (!dest) throw new NotFoundException('مقصد یافت نشد');
    const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
    if (!conn) throw new NotFoundException('اتصال یافت نشد');
    const channel = conn.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    const previous = parseDestinationPublishSettings(dest.publishSettings);
    const next = mergeDestinationPublishSettingsPatch(previous, dto);
    if (next.autoPublishMode && next.autoPublishMode !== 'OFF' && previous.autoPublishMode !== next.autoPublishMode) {
      await this.assertAutomationPrerequisitesForDestination(dest, conn, next.autoPublishMode);
    }
    dest.publishSettings = next as Record<string, unknown>;
    const saved = await this.destinations.save(dest);
    const resolved = resolveDestinationPublishSettings(
      saved.publishSettings,
      conn.publishSettings,
      await this.loadStoredSettings(),
      channel,
    );
    await this.audit(who, 'destination_publish_settings_patch', 'DESTINATION', saved.id, channel, dto.reason || null, {
      connectionId: conn.id,
      provider: conn.provider,
      autoPublishMode: resolved.automation.mode,
      autoDailyCap: resolved.automation.dailyCap,
      autoMinGapSeconds: resolved.automation.minGapSeconds,
      quietStartHour: resolved.automation.quietStartHour,
      quietEndHour: resolved.automation.quietEndHour,
      withdrawAction: resolved.automation.withdrawAction,
      oosPolicy: resolved.oosPolicy,
      oosChosen: resolved.oosChosen,
      autoPublishCategoryCount: resolved.categoryIds.length,
      eventsChosen: resolved.eventsChosen,
    });
    return {
      destinationId: saved.id,
      connectionId: conn.id,
      provider: conn.provider,
      channel,
      displayName: saved.displayName,
      ...publicDestinationPublishSettings(resolved),
    };
  }

  async listTemplates(destinationId?: string) {
    await this.ensureProductTemplates();
    if (destinationId) {
      return this.templates.find({
        where: [{ destinationId }, { destinationId: IsNull() }],
        order: { createdAt: 'DESC' },
      });
    }
    return this.templates.find({ order: { createdAt: 'DESC' } });
  }

  async ensureProductTemplates() {
    const upgraded: string[] = [];
    for (const channel of ['RETAIL', 'WHOLESALE'] as const) {
      const rows = await this.templates.find({
        where: { provider: MASTER_TEMPLATE_PROVIDER, channel, eventType: 'product.published', connectionId: IsNull() },
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
    const productEvent = dto.eventType === 'product.published';
    let destinationId = dto.destinationId || null;
    let connectionId = dto.connectionId || null;
    if (productEvent && !destinationId) {
      throw new BadRequestException('برای قالب محصول destinationId لازم است');
    }
    if (destinationId) {
      const dest = await this.destinations.findOne({ where: { id: destinationId } });
      if (!dest) throw new NotFoundException('مقصد یافت نشد');
      const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
      if (!conn) throw new NotFoundException('اتصال یافت نشد');
      if (conn.channel !== dto.channel) {
        throw new BadRequestException('کانال قالب با کانال مقصد یکی نیست');
      }
      connectionId = conn.id;
      const exists = await this.templates.findOne({
        where: { destinationId, eventType: dto.eventType, version },
      });
      if (exists) throw new ConflictException('قالب تکراری است');
    } else if (connectionId) {
      const conn = await this.connections.findOne({ where: { id: connectionId } });
      if (!conn) throw new NotFoundException('اتصال یافت نشد');
      if (conn.channel !== dto.channel) {
        throw new BadRequestException('کانال قالب با کانال ربات یکی نیست');
      }
      const exists = await this.templates.findOne({
        where: { connectionId, eventType: dto.eventType, version, destinationId: IsNull() },
      });
      if (exists) throw new ConflictException('قالب تکراری است');
    } else {
      const exists = await this.templates.findOne({
        where: {
          provider: dto.provider,
          channel: dto.channel,
          eventType: dto.eventType,
          version,
          connectionId: IsNull(),
          destinationId: IsNull(),
        },
      });
      if (exists) throw new ConflictException('قالب تکراری است');
    }
    const incoming = String(dto.body || '').trim();
    const body = productEvent ? productTemplateBodyOrThrow(dto.channel, incoming) : incoming;
    return this.templates.save(
      this.templates.create({
        provider: dto.provider,
        channel: dto.channel,
        connectionId,
        destinationId,
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

  async listPublications(destinationId?: string) {
    if (destinationId) {
      const deliveryRows = await this.deliveries.find({
        where: { destinationId },
        select: ['publicationId'],
        take: 500,
      });
      const ids = [...new Set(deliveryRows.map((row) => row.publicationId))];
      if (!ids.length) return [];
      const rows = await this.publications.find({
        where: { id: In(ids) },
        order: { createdAt: 'DESC' },
        take: 300,
      });
      return latestPublicationsBySource(rows).slice(0, 100);
    }
    const rows = await this.publications.find({ order: { createdAt: 'DESC' }, take: 300 });
    return latestPublicationsBySource(rows).slice(0, 100);
  }

  async listDeliveries(destinationId?: string) {
    const rows = await this.deliveries.find({
      where: destinationId ? { destinationId } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.map((row) => ({
      ...row,
      lastError: row.lastError ? redactProviderError(row.lastError) : row.lastError,
    }));
  }

  async outboxMetrics(destinationId?: string) {
    try {
      // Active statuses only — DONE history must not crowd out pending/dead counters.
      if (destinationId) {
        const rows = await this.events
          .createQueryBuilder('e')
          .select(['e.status', 'e.availableAt', 'e.lockedAt'])
          .where('e.status IN (:...st)', { st: ['PENDING', 'PROCESSING', 'DEAD'] })
          .andWhere("e.payload->>'destinationId' = :destinationId", { destinationId })
          .getMany();
        return summarizeOutbox(rows);
      }
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

  /** DEAD outbox grouped by eventType for operator diagnosis (channel-only + all). */
  async outboxDeadByEventType() {
    try {
      const rows = await this.events.find({
        select: ['eventType', 'status'],
        where: { status: 'DEAD' },
        take: 2000,
      });
      const all = summarizeDeadByEventType(rows, { channelOnly: false });
      const channel = summarizeDeadByEventType(rows, { channelOnly: true });
      const deadChannel = channel.reduce((sum, row) => sum + row.count, 0);
      const deadOther = all.reduce((sum, row) => sum + row.count, 0) - deadChannel;
      return { all, channel, deadChannel, deadOther };
    } catch (err) {
      if (isMissingRelationError(err)) {
        return { all: [], channel: [], deadChannel: 0, deadOther: 0 };
      }
      throw err;
    }
  }

  /**
   * CREATE slots used today (Tehran day): landed SUCCEEDED + in-flight PENDING/PROCESSING/RETRY.
   * Counts distinct publications so multi-destination albums still use one slot. Aligns with the
   * automation gate — manual/category blasts are included (not only auto=true).
   */
  async sentTodayCount(channel?: string, destinationId?: string): Promise<number> {
    try {
      return await this.countCreatesTowardDailyCap(channel, undefined, destinationId);
    } catch (err) {
      if (isMissingRelationError(err)) return 0;
      throw err;
    }
  }

  /** Why auto posts may be idle — for admin AttentionStrip. */
  async diagnoseGateBlock(destinationId?: string): Promise<{
    gateBlockReason: GateBlockReason;
    sentToday: number;
    outboxDeadByEventType: Awaited<ReturnType<OmnichannelService['outboxDeadByEventType']>>;
    /** When destinationId set: operator-facing rules for that destination (not global leftovers). */
    scopedPublish?: {
      autoPublishMode: string;
      autoDailyCap: number;
      autoMinGapSeconds: number;
      quietStartHour: number | null;
      quietEndHour: number | null;
      withdrawAction: string;
      settingsSource: string;
    };
  }> {
    const [stored, dests, conns, deadBreakdown] = await Promise.all([
      this.loadStoredSettings(),
      this.destinations.find({ where: { enabled: true } }),
      this.connections.find(),
      this.outboxDeadByEventType(),
    ]);
    const activeConnIds = new Set(conns.filter((c) => c.status === 'ACTIVE').map((c) => c.id));
    let automation = readAutomationSettings(stored);
    let scopeDests = dests;
    let sentToday = await this.sentTodayCount();
    let scopedPublish: {
      autoPublishMode: string;
      autoDailyCap: number;
      autoMinGapSeconds: number;
      quietStartHour: number | null;
      quietEndHour: number | null;
      withdrawAction: string;
      settingsSource: string;
    } | undefined;
    if (destinationId) {
      const dest = dests.find((d) => d.id === destinationId)
        || await this.destinations.findOne({ where: { id: destinationId } });
      if (dest) {
        const conn = conns.find((c) => c.id === dest.connectionId)
          || await this.connections.findOne({ where: { id: dest.connectionId } });
        if (conn) {
          const channel = conn.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
          const resolved = resolveDestinationPublishSettings(
            dest.publishSettings,
            conn.publishSettings,
            stored,
            channel,
          );
          automation = resolved.automation;
          scopeDests = [dest];
          sentToday = await this.sentTodayCount(channel, destinationId);
          scopedPublish = {
            autoPublishMode: resolved.automation.mode,
            autoDailyCap: resolved.automation.dailyCap,
            autoMinGapSeconds: resolved.automation.minGapSeconds,
            quietStartHour: resolved.automation.quietStartHour ?? null,
            quietEndHour: resolved.automation.quietEndHour ?? null,
            withdrawAction: resolved.automation.withdrawAction,
            settingsSource: resolved.source,
          };
        }
      }
    }
    const hasCanary = scopeDests.some((d) => isCanarySettings(d.settings) && activeConnIds.has(d.connectionId));
    const hasReadyDestination = scopeDests.some((d) => {
      if (!activeConnIds.has(d.connectionId)) return false;
      if (isCanarySettings(d.settings)) return true;
      return destinationCanPost(d.settings as Record<string, unknown> | null | undefined);
    });
    const gateBlockReason = resolveGateBlockReason({
      mode: automation.mode,
      connectorsEnabled: areOmnichannelConnectorsEnabled(),
      autoPublishFlag: isOmnichannelAutoPublishEnabled(),
      hasCanary,
      hasReadyDestination,
      sentToday,
      dailyCap: automation.dailyCap,
      quietStartHour: automation.quietStartHour,
      quietEndHour: automation.quietEndHour,
      tehranHourNow: tehranHour(new Date()),
    });
    return { gateBlockReason, sentToday, outboxDeadByEventType: deadBreakdown, scopedPublish };
  }

  async listOutbox(destinationId?: string) {
    let rows: OutboxEventEntity[];
    if (destinationId) {
      rows = await this.events
        .createQueryBuilder('e')
        .where("e.payload->>'destinationId' = :destinationId", { destinationId })
        .orderBy('e.createdAt', 'DESC')
        .take(100)
        .getMany();
    } else {
      rows = await this.events.find({ order: { createdAt: 'DESC' }, take: 100 });
    }
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
      scope: normalized.scope,
      channels: normalized.scope === 'channel' ? normalized.channels : undefined,
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
   * Soft-revive DEAD messenger delivers that only failed while connectors/provider kill-switch
   * was off. Requires OMNICHANNEL_CONNECTORS_ENABLED=true. Never DELETE.
   * PR-4: one row per call (oldest first) unless OMNICHANNEL_BULK_REVIVE_ENABLED=true (rollback).
   */
  async reviveConnectorDisabledDead(dto: ReviveConnectorDisabledDto, actor?: Actor) {
    const who = this.requireActor(actor);
    if (!dto?.confirm) throw new BadRequestException('confirm لازم است');
    const reason = String(dto.reason || '').trim();
    if (!reason) throw new BadRequestException('دلیل الزامی است');
    assertNoPlaintextSecrets({ reason });
    if (!areOmnichannelConnectorsEnabled()) {
      throw new BadRequestException(
        'اول OMNICHANNEL_CONNECTORS_ENABLED را روی سرور روشن کنید؛ بدون آن بازتلاش بی‌فایده است',
      );
    }
    const bulk = isBulkReviveEnabled();
    const limit = effectiveReviveLimit(dto.limit);
    const rows = await this.deliveries
      .createQueryBuilder('d')
      .where('d.status = :status', { status: 'DEAD' })
      .andWhere('d.action = :action', { action: 'CREATE' })
      .andWhere('d.supersededAt IS NULL')
      .andWhere(`d."lastError" ILIKE :marker`, { marker: '%connector is disabled%' })
      .orderBy('d.createdAt', 'ASC')
      .take(limit)
      .getMany();
    let reactivated = 0;
    let superseded = 0;
    for (const row of rows) {
      const result = await this.reactivateDelivery(row, who, reason, 'revive_connector_disabled');
      if (result.superseded) superseded += 1;
      else if (result.retried) reactivated += 1;
    }
    await this.audit(who, 'outbox_revive_connector_disabled', 'OUTBOX', 'batch', null, reason, {
      revivedEvents: reactivated,
      revivedDeliveries: reactivated,
      superseded,
      limit,
      bulk,
    });
    return {
      revivedEvents: reactivated,
      revivedDeliveries: reactivated,
      superseded,
      limitApplied: limit,
      bulk,
      outbox: await this.outboxMetrics(),
    };
  }

  /**
   * Admin blast: enqueue CREATE/UPDATE for products in a category (primary or membership).
   * Respects the daily CREATE cap (same counter as automation); still requires connectors + ready
   * destinations. Posts are staggered by autoMinGapSeconds so messengers are not flooded.
   * Quiet hours are not applied — admins may blast outside the auto window, within the daily room.
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
    const targetsPreview = await this.manualPublishTargets(normalized.channel, normalized.destinationId);
    const publishScope = await this.resolvePublishScopeForTargets(normalized.channel, targetsPreview);
    const automation = publishScope.automation;
    const counters = { sentToday: publishScope.sentToday };
    const dailyRoom = publishScope.dailyRoom;
    if (normalized.dryRun) {
      return {
        dryRun: true,
        matched: batch.length,
        hasMore,
        offset: normalized.offset,
        nextOffset: hasMore ? normalized.offset + batch.length : null,
        queued: 0,
        dailyCap: automation.dailyCap,
        sentToday: counters.sentToday,
        dailyRoom,
        connectionId: publishScope.connectionId || null,
        skipped: [] as Array<{ productId: string; reason: string }>,
        errors: [] as Array<{ productId: string; error: string }>,
      };
    }
    if (!canEnqueueManualDelivery(areOmnichannelConnectorsEnabled())) {
      throw new BadRequestException(
        'ارسال به پیام‌رسان خاموش است (OMNICHANNEL_CONNECTORS_ENABLED).',
      );
    }
    if (dailyRoom <= 0) {
      throw new BadRequestException(
        `سقف پست جدید امروز پر است (${counters.sentToday} از ${automation.dailyCap}). فردا دوباره تلاش کنید یا سقف را در تنظیمات همین ربات بالا ببرید.`,
      );
    }
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
    const targets = targetsPreview;
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
    let createRoom = dailyRoom;
    for (const productId of batch) {
      if (createRoom <= 0) {
        skipped.push({ productId, reason: 'سقف پست روزانه پر شد' });
        continue;
      }
      try {
        const result = await this.enqueueCategoryProduct(productId, {
          channel: normalized.channel,
          destinationId: normalized.destinationId,
          reason: normalized.reason,
          actor: who,
          availableAt: staggeredAvailableAt(scheduleIndex, gap, now),
          targets,
          allowCreate: createRoom > 0,
        });
        if (result.queued > 0) {
          queued += result.queued;
          scheduleIndex += 1;
          if (result.created > 0) createRoom = Math.max(0, createRoom - result.created);
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

  async listAudits(destinationId?: string) {
    if (destinationId) {
      return this.audits
        .createQueryBuilder('a')
        .select([
          'a.id', 'a.actorId', 'a.action', 'a.entityType', 'a.entityId',
          'a.channel', 'a.reason', 'a.createdAt',
        ])
        .where(
          "(a.entityId = :destinationId OR a.payload->>'destinationId' = :destinationId OR jsonb_exists(COALESCE(a.payload->'destinationIds', '[]'::jsonb), :destinationId))",
          { destinationId },
        )
        .orderBy('a.createdAt', 'DESC')
        .take(100)
        .getMany();
    }
    return this.audits.find({
      order: { createdAt: 'DESC' },
      take: 100,
      select: ['id', 'actorId', 'action', 'entityType', 'entityId', 'channel', 'reason', 'createdAt'],
    });
  }

  async preview(dto: PreviewDto) {
    const kind = String(dto.sourceType || 'PRODUCT').toUpperCase();
    if (kind === FREE_POST_SOURCE_TYPE) return this.previewFreePost(dto);
    if (kind !== 'PRODUCT' && kind !== 'BLOG_POST' && kind !== 'CMS_PAGE') {
      throw new BadRequestException('sourceType باید PRODUCT یا BLOG_POST یا CMS_PAGE باشد');
    }
    const channel = normalizeSalesChannel(dto.channel);
    const sourceId = kind === 'PRODUCT'
      ? await this.resolveProductSourceId(dto.sourceId)
      : String(dto.sourceId || '').trim();
    const projection = await this.projection.previewSource(kind, sourceId, channel);
    const available = 'available' in projection ? projection.available === true : true;
    let connectionId = dto.connectionId || undefined;
    let destinationId = dto.destinationId || undefined;
    if (destinationId && !connectionId) {
      const dest = await this.destinations.findOne({ where: { id: destinationId } });
      if (dest) connectionId = dest.connectionId;
    }
    const oos = await this.oosDecisionFor(channel, available, kind, sourceId, connectionId, destinationId);
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
      rendered: await this.publicationPayloadFor(annotated, connectionId, destinationId),
    };
  }

  /**
   * Free caption stays on the publication gateway: validate, then the same
   * createPublication → outbox `publication.deliver.requested` path as catalog posts.
   * This method does not perform a provider send.
   */
  private previewFreePost(dto: PreviewDto) {
    assertFreePostEnabled();
    const channel = normalizeSalesChannel(dto.channel);
    const draft = parseFreePostInput({
      channel,
      caption: dto.caption,
      mediaUrl: dto.mediaUrl,
      sourceId: dto.sourceId,
    });
    const projection = buildFreePostProjection(draft);
    return {
      dryRun: true,
      projection,
      rendered: renderFreePost(projection),
    };
  }

  async createPublication(dto: CreatePublicationDto, actor?: Actor) {
    const who = this.requireActor(actor);
    const requestedKind = String(dto.preview?.sourceType || '').toUpperCase();
    if (requestedKind === FREE_POST_SOURCE_TYPE) {
      assertFreePostEnabled();
      assertFreePostReason(dto.reason);
    }
    const dryRun = dto.dryRun !== false;
    const { projection } = await this.preview(dto.preview);
    if (!projection.publishable) {
      throw new BadRequestException(projection.rejectReason || 'این منبع برای این کانال قابل انتشار نیست');
    }
    const sourceId = String(projection.sourceId || dto.preview.sourceId);
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
    if (!dryRun && projection.sourceType === 'PRODUCT') {
      const channel = projection.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
      const scope = await this.resolvePublishScopeForTargets(channel, targets);
      // The 10-live-products canary cap protects the test phase; once this bot is LIVE the
      // daily cap and verified destinations govern volume instead.
      const liveCount = scope.automation.mode === 'LIVE' ? 0 : await this.publications.count({
        where: { channel: projection.channel, sourceType: 'PRODUCT', status: In(['READY', 'PUBLISHED', 'PARTIAL']) },
      });
      const limit = canaryLimitFor(projection.channel);
      if (scope.automation.mode !== 'LIVE' && canaryExceeded(liveCount, limit)) {
        throw new BadRequestException(`سقف canary کانال ${projection.channel} برابر ${limit} محصول است؛ برای ارسال بیشتر حالت خودکار همین ربات را «زنده» کنید`);
      }
      const available = 'available' in projection ? projection.available === true : true;
      const scopeDestId = targets[0]?.id;
      const oos = await this.oosDecisionFor(
        channel,
        available,
        'PRODUCT',
        sourceId,
        scope.connectionId,
        scopeDestId,
      );
      const reject = liveOosRejectReason(oos, available);
      if (reject) {
        throw new BadRequestException(
          `کالای ناموجود با سیاست ${oos.policy} در این کانال منتشر نمی‌شود`,
        );
      }
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
    if (!dryRun && plan.creates.length) {
      const scope = await this.resolvePublishScopeForTargets(
        projection.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
        targets,
      );
      if (scope.dailyRoom <= 0) {
        throw new BadRequestException(
          `سقف پست جدید امروز پر است (${scope.sentToday} از ${scope.automation.dailyCap}). ویرایش پست‌های موجود هنوز مجاز است.`,
        );
      }
    }
    if (!dryRun && String(projection.sourceType) === FREE_POST_SOURCE_TYPE && plan.creates.length > 0) {
      await this.assertFreePostNotInLiveQuietHours(
        projection.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
        targets,
      );
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
        // Newest row (DRAFT / WITHDRAWN / READY / …). Reopen withdrawn orphans instead of
        // inserting another parallel publication that never reaches the messenger.
        const existing = (await repo.find({
          where: { sourceType, sourceId, channel: projection.channel },
          order: { updatedAt: 'DESC', createdAt: 'DESC' },
          take: 1,
        }))[0] ?? null;
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
        // Live FREE_POST uses this same outbox enqueue as PRODUCT / BLOG_POST / CMS_PAGE.
        // The worker adapter is the only Telegram hop. Do not call the Bot API here.
        const gatewaySource = String(projection.sourceType) === FREE_POST_SOURCE_TYPE
          ? FREE_POST_SOURCE_TYPE
          : undefined;
        const destById = new Map(targets.map((dest) => [dest.id, dest]));
        const enqueuePerTarget = async (
          action: 'CREATE' | 'UPDATE',
          planTargets: Array<{ destinationId: string; providerMessageId?: string; publicationId?: string }>,
        ) => {
          for (const target of planTargets) {
            const dest = destById.get(target.destinationId);
            const rendered = await this.publicationPayloadFor(
              projection,
              dest?.connectionId,
              target.destinationId,
            );
            await this.enqueueDeliveries(manager, {
              publicationId: row.id,
              channel: projection.channel,
              action,
              rendered,
              targets: [target],
              auto: false,
              sourceType: gatewaySource,
            });
          }
        };
        if (plan.creates.length) await enqueuePerTarget('CREATE', plan.creates);
        if (plan.updates.length) await enqueuePerTarget('UPDATE', plan.updates);
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
            sourceType: String(projection.sourceType || ''),
            sourceId,
            destinationIds: targets.map((dest) => dest.id),
            createCount: plan.creates.length,
            updateCount: plan.updates.length,
            ...(String(projection.sourceType) === FREE_POST_SOURCE_TYPE
              ? { hasMedia: Boolean((projection as { mediaUrl?: string | null }).mediaUrl), gateway: 'publication.deliver.requested' }
              : {}),
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
  /**
   * Manual targets: one destination if requested; otherwise every canary or verified destination
   * on ACTIVE bots (independent of each bot's autoPublishMode).
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
    return selectAutomationDestinations(dests, conns, channel, 'LIVE');
  }

  /** Cap / gap / mode for destinations (tightest daily room if several). */
  private async resolvePublishScopeForTargets(
    channel: 'RETAIL' | 'WHOLESALE',
    targets: Array<{ id: string; connectionId: string; publishSettings?: Record<string, unknown> }>,
  ) {
    const global = await this.loadStoredSettings();
    if (!targets.length) {
      const automation = readAutomationSettings(global);
      const counters = await this.automationCounters(channel);
      return {
        automation,
        sentToday: counters.sentToday,
        dailyRoom: remainingDailyCreates(counters.sentToday, automation.dailyCap),
        connectionId: undefined as string | undefined,
        destinationId: undefined as string | undefined,
      };
    }
    let best: {
      automation: ReturnType<typeof readAutomationSettings>;
      sentToday: number;
      dailyRoom: number;
      connectionId: string;
      destinationId: string;
    } | null = null;
    for (const target of targets) {
      const conn = await this.connections.findOne({ where: { id: target.connectionId } });
      if (!conn) continue;
      const dest = target.publishSettings != null
        ? target
        : await this.destinations.findOne({ where: { id: target.id } });
      if (!dest) continue;
      const resolved = resolveDestinationPublishSettings(
        dest.publishSettings,
        conn.publishSettings,
        global,
        channel,
      );
      const counters = await this.automationCountersForDestination(dest.id, channel);
      const dailyRoom = remainingDailyCreates(counters.sentToday, resolved.automation.dailyCap);
      const candidate = {
        automation: resolved.automation,
        sentToday: counters.sentToday,
        dailyRoom,
        connectionId: conn.id,
        destinationId: dest.id,
      };
      if (!best || candidate.dailyRoom < best.dailyRoom) best = candidate;
    }
    if (!best) {
      const automation = readAutomationSettings(global);
      const counters = await this.automationCounters(channel);
      return {
        automation,
        sentToday: counters.sentToday,
        dailyRoom: remainingDailyCreates(counters.sentToday, automation.dailyCap),
        connectionId: undefined as string | undefined,
        destinationId: undefined as string | undefined,
      };
    }
    return best;
  }

  /** LIVE quiet hours apply to a new free-caption create. Catalog manual send is unchanged. */
  private async assertFreePostNotInLiveQuietHours(
    channel: 'RETAIL' | 'WHOLESALE',
    targets: Array<{ connectionId: string }>,
  ) {
    const global = await this.loadStoredSettings();
    const hour = tehranHour(new Date());
    for (const target of targets) {
      const conn = await this.connections.findOne({ where: { id: target.connectionId } });
      if (!conn) continue;
      const resolved = resolveConnectionPublishSettings(conn.publishSettings, global, channel);
      const block = freePostQuietBlock({
        mode: resolved.automation.mode,
        quietStartHour: resolved.automation.quietStartHour,
        quietEndHour: resolved.automation.quietEndHour,
        tehranHourNow: hour,
        creating: true,
      });
      if (block) throw new BadRequestException(block);
    }
  }

  /**
   * After the shared publication worker has already sent via the channel adapter.
   * Stores actor, reason, destination, and provider message id. No caption, token, or credential.
   */
  async recordFreePostDelivery(input: {
    publicationId: string;
    destinationId: string;
    providerMessageId?: string | null;
    action: string;
  }) {
    const publicationId = String(input.publicationId || '').trim();
    if (!publicationId) return;
    const row = await this.publications.findOne({
      where: { id: publicationId },
      select: ['id', 'sourceType', 'sourceId', 'channel'],
    });
    if (!row || row.sourceType !== FREE_POST_SOURCE_TYPE) return;
    const prior = await this.audits.findOne({
      where: { entityType: 'PUBLICATION', entityId: row.id },
      order: { createdAt: 'DESC' },
    });
    const rawMessageId = String(input.providerMessageId || '').trim();
    const providerMessageId = rawMessageId && !looksLikeSecretValue(rawMessageId) ? rawMessageId : null;
    await this.audits.save(this.audits.create({
      actorId: prior?.actorId || 'system',
      action: 'free_post_delivered',
      entityType: 'PUBLICATION',
      entityId: row.id,
      channel: row.channel,
      reason: prior?.reason || null,
      payload: {
        sourceType: FREE_POST_SOURCE_TYPE,
        sourceId: row.sourceId,
        destinationId: String(input.destinationId || ''),
        providerMessageId: providerMessageId || null,
        deliveryAction: String(input.action || ''),
        gateway: 'publication.deliver.requested',
      },
    }));
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
          sourceType: row.sourceType === FREE_POST_SOURCE_TYPE ? FREE_POST_SOURCE_TYPE : undefined,
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
    if (isNonRetryableProviderError(new Error(String(row.lastError || '')))) {
      throw new BadRequestException(
        'unsupported_media: تصویر را اصلاح کنید؛ تلاش دوباره با همان فایل بی‌فایده است',
      );
    }
    return this.reactivateDelivery(row, who, reason, 'retry');
  }

  /** Human approval for a HOLD row. Refreshes the stale clock and queues through the daily cap. */
  async reapproveDelivery(id: string, actor?: Actor, reason?: string) {
    const who = this.requireActor(actor);
    if (!reason) throw new BadRequestException('reason الزامی است');
    const row = await this.deliveries.findOne({ where: { id } });
    if (!row) throw new NotFoundException('تحویل یافت نشد');
    if (row.status !== 'HOLD') throw new BadRequestException('فقط ردیف متوقف‌شده برای تأیید مجدد قابل صف است');
    row.reapprovedAt = new Date();
    return this.reactivateDelivery(row, who, reason, 'reapprove');
  }

  private async reactivateDelivery(
    row: PublicationDeliveryEntity,
    who: Actor,
    reason: string,
    auditAction: string,
  ) {
    if (row.status === 'SUCCEEDED' && !row.supersededAt) {
      return { retried: false, superseded: false, delivery: row };
    }
    const sibling = row.idempotencyKey
      ? await this.deliveries.findOne({
        where: {
          idempotencyKey: row.idempotencyKey,
          action: 'CREATE',
          status: 'SUCCEEDED',
          supersededAt: IsNull(),
        },
      })
      : null;
    if (decideRetryAgainstSibling({
      deliveryId: row.id,
      hasLiveSucceededSibling: Boolean(sibling && sibling.id !== row.id),
    }) === 'supersede') {
      row.status = 'DEAD';
      row.lastError = 'superseded_duplicate';
      row.supersededAt = new Date();
      const saved = await this.deliveries.save(row);
      await this.audit(who, auditAction, 'DELIVERY', saved.id, null, reason, { superseded: true });
      return { retried: false, superseded: true, delivery: saved };
    }
    const slot = await this.nextCreateAvailableAt(row.destinationId);
    let reactivated: unknown;
    try {
      reactivated = await this.deliveries.query(
        REACTIVATE_CREATE_SQL,
        [row.id, slot.reason, slot.availableAt, row.reapprovedAt || null],
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // A live sibling already holds the active slot for this key (partial UNIQUE). Never surface 23505.
      const stale = await this.deliveries.findOne({ where: { id: row.id } }) || row;
      if (stale.supersededAt) {
        return { retried: false, superseded: true, delivery: stale };
      }
      stale.status = 'DEAD';
      stale.lastError = 'superseded_duplicate';
      stale.supersededAt = new Date();
      const saved = await this.deliveries.save(stale);
      await this.audit(who, auditAction, 'DELIVERY', saved.id, null, reason, {
        superseded: true,
        conflict: 'active_slot_taken',
      });
      return { retried: false, superseded: true, delivery: saved };
    }
    if (!insertedId(reactivated)) {
      return { retried: false, superseded: false, delivery: row };
    }
    const saved = await this.deliveries.findOne({ where: { id: row.id } }) || row;
    const event = row.eventId ? await this.events.findOne({ where: { id: row.eventId } }) : null;
    const payload = {
      ...(event?.payload || {}),
      publicationId: row.publicationId,
      destinationId: row.destinationId,
      action: row.action,
      deliveryId: row.id,
    };
    if (event) {
      const dedupeKey = buildDedupeKey({
        operationId: row.idempotencyKey || row.id,
        eventType: OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED,
        aggregateType: 'PUBLICATION',
        aggregateId: row.sourceId || row.publicationId,
        channel: event.channel,
      });
      await this.outbox.reopen(event.id, slot.availableAt, dedupeKey, payload);
    }
    await this.audit(who, auditAction, 'DELIVERY', saved.id, null, reason, {
      publicationId: saved.publicationId,
      availableAt: slot.availableAt.toISOString(),
      deferredReason: slot.reason,
    });
    return { retried: true, superseded: false, delivery: saved };
  }

  private async nextCreateAvailableAt(destinationId: string): Promise<{ availableAt: Date; reason: string | null }> {
    const dest = await this.destinations.findOne({ where: { id: destinationId } });
    const conn = dest ? await this.connections.findOne({ where: { id: dest.connectionId } }) : null;
    const global = await this.loadStoredSettings();
    const resolved = dest && conn
      ? resolveDestinationPublishSettings(dest.publishSettings, conn.publishSettings, global, conn.channel as 'RETAIL' | 'WHOLESALE')
      : null;
    const now = new Date();
    const cap = dailyCapForProvider(conn?.provider || '', resolved?.automation.dailyCap ?? 0);
    const sentToday = await this.countCreatesTowardDailyCap(conn?.channel, undefined, destinationId);
    const gap = decideMinGap(now, await this.lastSentAt(destinationId), effectiveMinGapSeconds(resolved?.automation.minGapSeconds ?? 0));
    let availableAt = gap.allow ? now : (gap.availableAt || now);
    let reason: string | null = gap.allow ? null : 'min_gap';
    const capped = decideDailyCap({
      sentToday,
      inFlight: 0,
      cap,
      now,
      quietEndHour: resolved?.automation.quietEndHour ?? null,
      jitterMs: capJitterMs(destinationId, tehranDayStart(now)),
    });
    if (!capped.allow && capped.availableAt) {
      availableAt = capped.availableAt;
      reason = 'daily_cap';
    }
    return { availableAt, reason };
  }

  private async lastSentAt(destinationId: string): Promise<Date | null> {
    const raw = await this.deliveries
      .createQueryBuilder('d')
      .select('MAX(d.sentAt)', 'last')
      .where('d.destinationId = :destinationId', { destinationId })
      .andWhere('d.action = :action', { action: 'CREATE' })
      .andWhere('d.status = :status', { status: 'SUCCEEDED' })
      .getRawOne<{ last: Date | string | null }>();
    if (!raw?.last) return null;
    const at = new Date(raw.last);
    return Number.isNaN(at.getTime()) ? null : at;
  }

  /** Worker gate: one CREATE send, or defer/hold/supersede without calling the adapter. */
  async reserveCreateSend(input: {
    eventId: string;
    destinationId: string;
    connectionId: string;
    provider: string;
    channel: string;
  }): Promise<
    | { kind: 'send' }
    | { kind: 'stop' }
    | { kind: 'defer'; availableAt: Date; reason: 'daily_cap' | 'min_gap' | 'rate_limit'; message: string }
  > {
    const row = input.eventId
      ? await this.deliveries.findOne({ where: { eventId: input.eventId } })
      : null;
    if (!row) return { kind: 'stop' };
    if (row.action !== 'CREATE') return { kind: 'send' };
    if (row.supersededAt || row.status === 'SUCCEEDED' || row.status === 'HOLD') return { kind: 'stop' };
    if (row.status === 'PROCESSING') {
      await this.markCreateUnconfirmed(input.eventId);
      return { kind: 'stop' };
    }
    const dest = await this.destinations.findOne({ where: { id: input.destinationId } });
    const conn = await this.connections.findOne({ where: { id: input.connectionId } });
    const global = await this.loadStoredSettings();
    const resolved = dest && conn
      ? resolveDestinationPublishSettings(dest.publishSettings, conn.publishSettings, global, (input.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL'))
      : null;
    const cap = dailyCapForProvider(input.provider, resolved?.automation.dailyCap ?? 0);
    const quietEndHour = resolved?.automation.quietEndHour ?? null;
    const minGapSeconds = effectiveMinGapSeconds(resolved?.automation.minGapSeconds ?? 0);
    return this.deliveries.manager.transaction(async (tx) => {
      const now = new Date();
      const day = tehranDayStart(now);
      const key = row.idempotencyKey || row.id;
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [key]);
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`cap:${input.destinationId}:${day.toISOString()}`]);
      // The pre-read above is unlocked. Re-read under FOR UPDATE: if another worker, supersede or
      // HOLD committed meanwhile, stop. A fresh PROCESSING here is a live sibling worker, not a crash.
      const lockedRows = await tx.query(RESERVE_CREATE_LOCK_ROW_SQL, [row.id]) as Array<{
        id: string;
        status: string;
        action: string;
        supersededAt: Date | string | null;
        createdAt: Date | string;
        reapprovedAt: Date | string | null;
      }>;
      const fresh = lockedRows[0];
      if (!fresh || fresh.supersededAt || !['PENDING', 'RETRY'].includes(fresh.status)) {
        return { kind: 'stop' as const };
      }
      row.status = fresh.status;
      row.createdAt = new Date(fresh.createdAt);
      row.reapprovedAt = fresh.reapprovedAt ? new Date(fresh.reapprovedAt) : null;
      const others = await tx.query(
        `SELECT id, status, "createdAt"
         FROM "omnichannel_publication_deliveries"
         WHERE "idempotencyKey" = $1::text AND action = 'CREATE' AND "supersededAt" IS NULL AND id <> $2::uuid`,
        [key, row.id],
      ) as Array<{ id: string; status: string; createdAt: Date | string }>;
      // Explicit casts: PG 42P08 "inconsistent types deduced for parameter $2"
      // when the same $N is bound across uuid/timestamptz/text contexts (or dual columns).
      const counts = await tx.query(
        RESERVE_CREATE_COUNTS_SQL,
        [
          input.destinationId,
          day,
          row.id,
          new Date(now.getTime() - 10 * 60_000),
          input.connectionId,
          new Date(now.getTime() - 60_000),
        ],
      ) as Array<{ sent: number; inflight: number; last_sent: Date | string | null; per_minute: number }>;
      const count = counts[0] || { sent: 0, inflight: 0, last_sent: null, per_minute: 0 };
      const lastSentAt = count.last_sent ? new Date(count.last_sent) : null;
      const plan = planCreateSend({
        now,
        createdAt: new Date(row.createdAt),
        reapprovedAt: row.reapprovedAt ? new Date(row.reapprovedAt) : null,
        staleHours: staleDeliveryHours(),
        sentToday: Number(count.sent || 0),
        inFlight: Number(count.inflight || 0),
        cap,
        lastSentAt: lastSentAt && !Number.isNaN(lastSentAt.getTime()) ? lastSentAt : null,
        minGapSeconds,
        sendsLastMinute: Number(count.per_minute || 0),
        maxPerMinute: maxSendsPerMinute(),
        quietEndHour,
        jitterMs: capJitterMs(input.destinationId, day),
        winner: decideSendWinner(
          { id: row.id, createdAt: new Date(row.createdAt) },
          others.map((other) => ({
            id: other.id,
            status: other.status,
            createdAt: new Date(other.createdAt),
          })),
        ),
      });
      if (plan.kind === 'supersede') {
        await tx.query(
          `UPDATE "omnichannel_publication_deliveries"
           SET status = 'DEAD', "lastError" = 'superseded_duplicate', "supersededAt" = NOW(), "updatedAt" = NOW()
           WHERE id = $1`,
          [row.id],
        );
        return { kind: 'stop' as const };
      }
      if (plan.kind === 'hold') {
        const holdReason: (typeof DELIVERY_DEFERRED_REASONS)[number] = 'stale_needs_reapproval';
        await tx.query(MARK_CREATE_HOLD_SQL, [row.id, holdReason]);
        return { kind: 'stop' as const };
      }
      if (plan.kind === 'defer') {
        await tx.query(DEFER_CREATE_SQL, [row.id, plan.reason, plan.availableAt]);
        return { kind: 'defer' as const, availableAt: plan.availableAt, reason: plan.reason, message: plan.reason };
      }
      const claimed = await tx.query(
        `UPDATE "omnichannel_publication_deliveries"
         SET status = 'PROCESSING', "deferredReason" = NULL, "updatedAt" = NOW()
         WHERE id = $1 AND status IN ('PENDING', 'RETRY')
         RETURNING id`,
        [row.id],
      );
      if (!insertedId(claimed)) return { kind: 'stop' as const };
      return { kind: 'send' as const };
    });
  }

  async markCreateUnconfirmed(eventId: string): Promise<void> {
    if (!eventId) return;
    const reason: (typeof DELIVERY_DEFERRED_REASONS)[number] = 'uncertain_after_timeout';
    await this.deliveries.query(MARK_CREATE_UNCONFIRMED_SQL, [eventId, reason]);
  }

  /** Late success may finish after HOLD uncertain_after_timeout; never overwrite a different SUCCEEDED. */
  async markCreateSucceeded(
    deliveryId: string,
    providerMessageId?: string | null,
    warnings: string[] = [],
  ): Promise<boolean> {
    const warningNote = warnings.length
      ? `warnings:${warnings.join('|')}`.slice(0, 2000)
      : null;
    const raw = await this.deliveries.query(
      MARK_CREATE_SUCCEEDED_SQL,
      [deliveryId, providerMessageId || null, warningNote],
    );
    return Boolean(insertedId(raw));
  }

  async supersedeCreatesAfterDelete(publicationId: string, destinationId: string): Promise<void> {
    const pub = await this.publications.findOne({
      where: { id: publicationId },
      select: ['id', 'sourceType', 'sourceId'],
    });
    if (!pub) return;
    await this.deliveries
      .createQueryBuilder()
      .update(PublicationDeliveryEntity)
      .set({ supersededAt: new Date() })
      .where('sourceType = :sourceType', { sourceType: pub.sourceType })
      .andWhere('sourceId = :sourceId', { sourceId: pub.sourceId })
      .andWhere('destinationId = :destinationId', { destinationId })
      .andWhere('action = :action', { action: 'CREATE' })
      .andWhere('supersededAt IS NULL')
      .execute();
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
      select: ['sourceType', 'sourceId', 'channel', 'status', 'sourceUpdatedAt'],
    });
    const catalogExisting = catalogPublicationsForReconcile(existing);
    const intents = reconcilePublicationIntents(visible, catalogExisting);
    const next = applyReconcileIntents(visible, catalogExisting);
    for (const intent of intents) {
      if (intent.action === 'withdraw') {
        await this.publications.update(
          { sourceId: intent.sourceId, channel: intent.channel },
          { status: 'WITHDRAWN' },
        );
      } else {
        const { projection } = await this.preview({
          channel: intent.channel as 'RETAIL' | 'WHOLESALE',
          sourceType: 'PRODUCT',
          sourceId: intent.sourceId,
        });
        if (!projection.publishable) continue;
        // One live row per source×channel — reopen WITHDRAWN/FAILED; never insert a parallel DRAFT.
        const candidates = await this.publications.find({
          where: {
            sourceType: 'PRODUCT',
            sourceId: intent.sourceId,
            channel: intent.channel,
          },
          order: { updatedAt: 'DESC', createdAt: 'DESC' },
        });
        const reuse = publicationToReuse(candidates);
        if (reuse) {
          reuse.projection = projection;
          reuse.sourceUpdatedAt = new Date();
          if (reuse.status === 'WITHDRAWN' || reuse.status === 'FAILED') reuse.status = 'DRAFT';
          await this.publications.save(reuse);
        } else {
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
    // Multiple version rows exist per source×channel (unique includes sourceUpdatedAt).
    // Always mutate the newest; findOne+order is unreliable across TypeORM versions.
    const existing = (await this.publications.find({
      where: { sourceType, sourceId, channel },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
      take: 1,
    }))[0] ?? null;
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
      await this.publications.manager.transaction(async (tx) => {
        await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`publication:${sourceType}:${sourceId}:${channel}`]);
        const repo = tx.getRepository(PublicationEntity);
        const again = (await repo.find({
          where: { sourceType, sourceId, channel },
          order: { updatedAt: 'DESC', createdAt: 'DESC' },
          take: 1,
        }))[0] ?? null;
        if (again) {
          again.projection = projection;
          again.sourceUpdatedAt = new Date();
          if (again.status === 'WITHDRAWN' || again.status === 'FAILED') again.status = 'DRAFT';
          await repo.save(again);
          return;
        }
        await repo.save(repo.create({
          sourceType,
          sourceId,
          channel,
          sourceUpdatedAt: new Date(),
          projection,
          status: 'DRAFT',
        }));
      });
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
   * Channel automation for one product/channel. Each enabled destination evaluates its own
   * publishSettings (mode, cap, events, categories, OOS, withdraw) independently.
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
    if (!areOmnichannelConnectorsEnabled() || !isOmnichannelAutoPublishEnabled()) return 'flags_off';
    const [global, dests, conns, live] = await Promise.all([
      this.loadStoredSettings(),
      this.destinations.find({ where: { enabled: true } }),
      this.connections.find({ where: { channel: input.channel, status: 'ACTIVE' } }),
      this.liveRemoteMessages('PRODUCT', input.sourceId, input.channel),
    ]);
    if (!conns.length) return 'mode_off';
    const publication = (await this.publications.find({
      where: { sourceType: 'PRODUCT', sourceId: input.sourceId, channel: input.channel },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
      take: 1,
    }))[0] ?? null;
    if (!publication) return 'no_publication';
    const cats = await this.productCategoryIdsFor(input.sourceId);
    const results: string[] = [];
    const connById = new Map(conns.map((row) => [row.id, row]));
    for (const dest of dests) {
      const conn = connById.get(dest.connectionId);
      if (!conn) continue;
      const resolved = resolveDestinationPublishSettings(
        dest.publishSettings,
        conn.publishSettings,
        global,
        input.channel,
      );
      const { automation } = resolved;
      if (automation.mode === 'OFF') {
        results.push('mode_off');
        continue;
      }
      const liveOnDest = live.filter((msg) => msg.destinationId === dest.id);
      let publishable = input.publishable;
      if (resolved.categoryIds.length > 0) {
        const categoryGate = evaluateCategoryAllowlistGate({
          allowlist: resolved.categoryIds,
          primaryCategoryId: cats.primaryCategoryId,
          membershipCategoryIds: cats.membershipCategoryIds,
        });
        if (!categoryGate.allow) {
          if (liveOnDest.length === 0) {
            results.push('category_not_allowed');
            continue;
          }
          publishable = false;
        }
      }
      const intent = resolveRemoteIntent({
        eventType: input.eventType,
        localAction: input.localAction,
        previousStatus: input.previousStatus,
        publishable,
        available: input.available,
        hasRemoteMessage: liveOnDest.length > 0,
        oosPolicy: resolved.oosPolicy,
        oosChosen: resolved.oosChosen,
        withdrawAction: automation.withdrawAction,
        chosenEvents: resolved.events,
      });
      if (intent.action === 'none') {
        results.push(intent.reason);
        continue;
      }
      if (intent.action === 'DELETE') {
        const count = await this.enqueueDeliveries(this.publications.manager, {
          publicationId: publication.id,
          channel: input.channel,
          action: 'DELETE',
          rendered: null,
          targets: liveOnDest.map((msg) => ({
            destinationId: msg.destinationId,
            providerMessageId: msg.providerMessageId,
            publicationId: msg.publicationId,
          })),
          auto: true,
        });
        results.push(count ? 'delete' : 'delete_deduped');
        continue;
      }
      if (!input.projection) {
        results.push('no_projection');
        continue;
      }
      const rendered = await this.publicationPayloadFor(input.projection, conn.id, dest.id);
      if (intent.action === 'UPDATE') {
        const text = intent.notice
          ? renderUnavailableNotice(await this.publicationVarsFor(input.projection), rendered.parseMode)
          : rendered.text;
        const count = await this.enqueueDeliveries(this.publications.manager, {
          publicationId: publication.id,
          channel: input.channel,
          action: 'UPDATE',
          rendered: { ...rendered, text },
          targets: liveOnDest.map((msg) => ({
            destinationId: msg.destinationId,
            providerMessageId: msg.providerMessageId,
            publicationId: msg.publicationId,
          })),
          auto: true,
        });
        results.push(count ? (intent.notice ? 'update_notice' : 'update') : 'update_deduped');
        continue;
      }
      const counters = await this.automationCountersForDestination(dest.id, input.channel);
      const gate = evaluateAutomationGate({
        mode: automation.mode,
        eventType: input.eventType,
        chosenEvents: resolved.events,
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
      if (gate.allow === false) {
        results.push(gate.reason);
        continue;
      }
      const eligible = selectAutomationDestinationsForConnection([dest], conn, automation.mode)
        .filter((row) => liveOnDest.length === 0)
        .map((row) => ({ destinationId: row.id }));
      if (!eligible.length) {
        results.push('no_destination');
        continue;
      }
      const count = await this.enqueueDeliveries(this.publications.manager, {
        publicationId: publication.id,
        channel: input.channel,
        action: 'CREATE',
        rendered,
        targets: eligible,
        auto: true,
        availableAt: gate.sendAt,
      });
      if (count && publication.status === 'DRAFT') {
        publication.status = 'READY';
        await this.publications.save(publication);
      }
      results.push(count ? (gate.deferred ? 'create_deferred' : 'create') : 'create_deduped');
    }
    const success = results.find((r) =>
      r === 'create'
      || r === 'create_deferred'
      || r === 'update'
      || r === 'update_notice'
      || r === 'delete'
      || r === 'create_deduped'
      || r === 'update_deduped'
      || r === 'delete_deduped');
    if (success) return success;
    if (results.every((r) => r === 'mode_off')) return 'mode_off';
    return results[0] || 'mode_off';
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
        status: In(['PENDING', 'PROCESSING', 'RETRY', 'HOLD']),
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

  /**
   * CREATE slots used toward the daily cap (Tehran day).
   * Prefer destinationId; connectionId scopes all of that bot's destinations.
   */
  private async countCreatesTowardDailyCap(
    channel?: string,
    connectionId?: string,
    destinationId?: string,
  ): Promise<number> {
    const dayStart = tehranDayStart(new Date());
    const qb = this.deliveries
      .createQueryBuilder('d')
      .innerJoin(PublicationEntity, 'p', 'p.id = d.publicationId')
      .where('d.action = :action', { action: 'CREATE' })
      .andWhere(`(
        (d.status = 'SUCCEEDED' AND d.sentAt >= :dayStart)
        OR (
          d."supersededAt" IS NULL
          AND (
            (d.status = 'PROCESSING' AND d.updatedAt >= :recent)
            OR d.status IN ('HOLD', 'PENDING', 'RETRY')
          )
        )
      )`, { dayStart, recent: new Date(Date.now() - 10 * 60_000) });
    if (channel) qb.andWhere('p.channel = :channel', { channel });
    if (destinationId) {
      qb.andWhere('d.destinationId = :destinationId', { destinationId });
    } else if (connectionId) {
      qb.innerJoin(ChannelDestinationEntity, 'dest', 'dest.id = d.destinationId')
        .andWhere('dest.connectionId = :connectionId', { connectionId });
    }
    const row = await qb.select('COUNT(*)', 'n').getRawOne<{ n: string }>();
    return Number(row?.n || 0);
  }

  /** CREATE counters for one destination: slots used today + latest scheduled send (for min-gap). */
  private async automationCountersForDestination(
    destinationId: string,
    channel: string,
  ): Promise<{ sentToday: number; lastScheduledAt: Date | null }> {
    const dayStart = tehranDayStart(new Date());
    const [sentToday, last] = await Promise.all([
      this.countCreatesTowardDailyCap(channel, undefined, destinationId),
      this.events
        .createQueryBuilder('e')
        .where('e.eventType = :type', { type: OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED })
        .andWhere('e.channel = :channel', { channel })
        .andWhere("e.payload->>'action' = 'CREATE'")
        .andWhere("e.payload->>'destinationId' = :destinationId", { destinationId })
        .andWhere('e.createdAt >= :dayStart', { dayStart })
        .select('MAX(e.availableAt)', 'last')
        .getRawOne<{ last: Date | string | null }>(),
    ]);
    const lastRaw = last?.last ?? null;
    const lastScheduledAt = lastRaw ? new Date(lastRaw) : null;
    return {
      sentToday,
      lastScheduledAt: lastScheduledAt && !Number.isNaN(lastScheduledAt.getTime()) ? lastScheduledAt : null,
    };
  }

  /** CREATE counters for one bot (compat / multi-dest scope). */
  private async automationCountersForConnection(
    connectionId: string,
    channel: string,
  ): Promise<{ sentToday: number; lastScheduledAt: Date | null }> {
    const dayStart = tehranDayStart(new Date());
    const destIds = (
      await this.destinations.find({ where: { connectionId }, select: ['id'] })
    ).map((row) => row.id);
    const [sentToday, last] = await Promise.all([
      this.countCreatesTowardDailyCap(channel, connectionId),
      destIds.length
        ? this.events
          .createQueryBuilder('e')
          .where('e.eventType = :type', { type: OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED })
          .andWhere('e.channel = :channel', { channel })
          .andWhere("e.payload->>'action' = 'CREATE'")
          .andWhere("e.payload->>'destinationId' IN (:...destIds)", { destIds })
          .andWhere('e.createdAt >= :dayStart', { dayStart })
          .select('MAX(e.availableAt)', 'last')
          .getRawOne<{ last: Date | string | null }>()
        : Promise.resolve({ last: null }),
    ]);
    const lastRaw = last?.last ?? null;
    const lastScheduledAt = lastRaw ? new Date(lastRaw) : null;
    return {
      sentToday,
      lastScheduledAt: lastScheduledAt && !Number.isNaN(lastScheduledAt.getTime()) ? lastScheduledAt : null,
    };
  }

  /** @deprecated Prefer automationCountersForConnection — kept for channel-wide diagnosis. */
  private async automationCounters(channel: string): Promise<{ sentToday: number; lastScheduledAt: Date | null }> {
    const dayStart = tehranDayStart(new Date());
    const [sentToday, last] = await Promise.all([
      this.countCreatesTowardDailyCap(channel),
      this.events
        .createQueryBuilder('e')
        .where('e.eventType = :type', { type: OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED })
        .andWhere('e.channel = :channel', { channel })
        .andWhere("e.payload->>'action' = 'CREATE'")
        .andWhere('e.createdAt >= :dayStart', { dayStart })
        .select('MAX(e.availableAt)', 'last')
        .getRawOne<{ last: Date | string | null }>(),
    ]);
    const lastRaw = last?.last ?? null;
    const lastScheduledAt = lastRaw ? new Date(lastRaw) : null;
    return {
      sentToday,
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

  private async publicationPayloadFor(
    projection: Record<string, unknown>,
    connectionId?: string,
    destinationId?: string,
  ): Promise<RenderedPublication> {
    if (String(projection.sourceType || '').toUpperCase() === FREE_POST_SOURCE_TYPE) {
      return renderFreePost(projection);
    }
    const eventType = projection.sourceType === 'BLOG_POST'
      ? 'blog.published'
      : projection.sourceType === 'CMS_PAGE'
        ? 'cms.published'
        : 'product.published';
    const channel = projection.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    if (eventType === 'product.published') await this.ensureProductTemplates();
    let body: string | undefined;
    if (destinationId) {
      const perDest = await this.templates.find({
        where: { destinationId, eventType, enabled: true },
        order: { version: 'DESC' },
        take: 1,
      });
      body = perDest[0]?.body;
    }
    if (!body && connectionId) {
      const perBot = await this.templates.find({
        where: { connectionId, eventType, enabled: true, destinationId: IsNull() },
        order: { version: 'DESC' },
        take: 1,
      });
      body = perBot[0]?.body;
    }
    if (!body) {
      const rows = await this.templates.find({
        where: [
          {
            provider: MASTER_TEMPLATE_PROVIDER,
            channel,
            eventType,
            enabled: true,
            connectionId: IsNull(),
            destinationId: IsNull(),
          },
        ],
        order: { version: 'DESC' },
        take: 1,
      });
      body = rows[0]?.body
        || (await this.templates.find({
          where: { provider: MASTER_TEMPLATE_PROVIDER, channel, eventType, enabled: true },
          order: { version: 'DESC' },
          take: 5,
        })).find((row) => !row.connectionId && !row.destinationId)?.body;
    }
    const layout = parseTemplateLayout(body, channel);
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
    vars.sizes = sizesLine(product.sizeType, product.sizeLabels);
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
      /** When false, UPDATE-only (daily CREATE room exhausted). */
      allowCreate?: boolean;
    },
  ): Promise<{ queued: number; created: number; skipReason?: string }> {
    const primaryDest = opts.destinationId
      ? opts.targets.find((row) => row.id === opts.destinationId) || opts.targets[0]
      : opts.targets[0];
    const { projection } = await this.preview({
      channel: opts.channel,
      sourceType: 'PRODUCT',
      sourceId: productId,
      destinationId: primaryDest?.id,
      connectionId: primaryDest?.connectionId,
    });
    if (!projection.publishable) {
      return { queued: 0, created: 0, skipReason: projection.rejectReason || 'غیرقابل انتشار' };
    }
    const sourceId = String(projection.sourceId || productId);
    const available = 'available' in projection ? projection.available === true : true;
    const oos = await this.oosDecisionFor(
      opts.channel,
      available,
      'PRODUCT',
      sourceId,
      primaryDest?.connectionId,
      primaryDest?.id,
    );
    const reject = liveOosRejectReason(oos, available);
    if (reject) {
      return { queued: 0, created: 0, skipReason: `ناموجود (${oos.policy})` };
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
    if (opts.allowCreate === false) plan.creates.length = 0;
    if (plan.creates.length === 0 && plan.updates.length === 0) {
      return {
        queued: 0,
        created: 0,
        skipReason: opts.allowCreate === false && liveRemote.length === 0
          ? 'سقف پست روزانه پر شد'
          : 'ارسال قبلی هنوز در صف است',
      };
    }
    let queued = 0;
    let created = 0;
    await this.publications.manager.transaction(async (manager) => {
      const repo = manager.getRepository(PublicationEntity);
      // Newest row wins (including WITHDRAWN/DRAFT). A stale WITHDRAWN sibling must not
      // block requeue — that left the publish console unable to restock the channel after
      // mass withdraw while inventory kept creating orphan drafts.
      const existing = (await repo.find({
        where: {
          sourceType: 'PRODUCT',
          sourceId,
          channel: opts.channel,
        },
        order: { updatedAt: 'DESC', createdAt: 'DESC' },
        take: 1,
      }))[0] ?? null;
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
      const destById = new Map(opts.targets.map((dest) => [dest.id, dest]));
      const enqueuePerTarget = async (
        action: 'CREATE' | 'UPDATE',
        planTargets: Array<{ destinationId: string; providerMessageId?: string; publicationId?: string }>,
      ) => {
        for (const target of planTargets) {
          const dest = destById.get(target.destinationId);
          const rendered = await this.publicationPayloadFor(
            projection,
            dest?.connectionId,
            target.destinationId,
          );
          const n = await this.enqueueDeliveries(manager, {
            publicationId: row.id,
            channel: opts.channel,
            action,
            rendered,
            targets: [target],
            auto: false,
            availableAt: opts.availableAt,
          });
          queued += n;
          if (action === 'CREATE' && n > 0) created += 1;
        }
      };
      if (plan.creates.length) await enqueuePerTarget('CREATE', plan.creates);
      if (plan.updates.length) await enqueuePerTarget('UPDATE', plan.updates);
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
    return { queued, created };
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
      /** Set only for FREE_POST so the worker can audit after the shared adapter send. */
      sourceType?: string;
    },
  ): Promise<number> {
    let created = 0;
    for (const target of input.targets) {
      created += await this.enqueueOneDelivery(manager, input, target, true);
    }
    return created;
  }

  private async enqueueOneDelivery(
    manager: EntityManager,
    input: {
      publicationId: string;
      channel: string;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      rendered: RenderedPublication | null;
      auto: boolean;
      availableAt?: Date;
      sourceType?: string;
    },
    target: { destinationId: string; providerMessageId?: string; publicationId?: string },
    allowConvert: boolean,
  ): Promise<number> {
    return manager.transaction(async (tx) => {
      const publicationId = target.publicationId || input.publicationId;
      const publication = await tx.getRepository(PublicationEntity).findOne({ where: { id: publicationId } });
      const sourceType = input.sourceType || publication?.sourceType || 'PRODUCT';
      const sourceId = publication?.sourceId || publicationId;
      const hash = contentHash({
        text: input.rendered?.text,
        photoUrls: input.rendered?.photoUrls,
        buttons: input.rendered?.buttons,
      });
      const idempotencyKey = buildIdempotencyKey({
        action: input.action,
        sourceType,
        sourceId,
        destinationId: target.destinationId,
        providerMessageId: target.providerMessageId,
        contentHash: hash,
      });
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [idempotencyKey]);
      if (input.action === 'CREATE') {
        const existing = await this.loadActiveCreates(tx, idempotencyKey);
        const decision = decideCreateEnqueue(existing, hash);
        if (decision.kind === 'skip') return 0;
        if (decision.kind === 'convert_update') {
          if (!allowConvert) return 0;
          return this.enqueueOneDelivery(tx, {
            ...input,
            action: 'UPDATE',
            publicationId: decision.publicationId,
          }, {
            destinationId: target.destinationId,
            providerMessageId: decision.providerMessageId,
            publicationId: decision.publicationId,
          }, false);
        }
        if (decision.kind === 'merge' || decision.kind === 'reuse') {
          if (decision.kind === 'merge') {
            const inflight = await tx.query(
              `SELECT status FROM "omnichannel_outbox_events" WHERE id = $1`,
              [decision.eventId],
            ) as Array<{ status?: string }>;
            if (inflight[0]?.status === 'PROCESSING') return 0;
          }
          await this.supersedeDeliveryIds(tx, decision.supersedeIds);
          await this.retargetDelivery(tx, decision, {
            publicationId,
            sourceType,
            sourceId,
            destinationId: target.destinationId,
            channel: input.channel,
            action: 'CREATE',
            auto: input.auto,
            hash,
            idempotencyKey,
            availableAt: input.availableAt || new Date(),
            providerMessageId: null,
            rendered: input.rendered,
            reset: decision.kind === 'reuse',
          });
          return decision.kind === 'reuse' ? 1 : 0;
        }
      }
      const queued = await this.outbox.enqueue({
        operationId: idempotencyKey,
        eventType: OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED,
        aggregateType: 'PUBLICATION',
        aggregateId: sourceId,
        channel: input.channel,
        availableAt: input.availableAt,
        payload: this.outboxDeliveryPayload(input, target, publicationId, sourceType),
      }, tx);
      if (!queued.id) return 0;
      const inserted = await tx.query(
        `INSERT INTO "omnichannel_publication_deliveries" (
          "publicationId", "destinationId", "eventId", "action", "status", "providerMessageId",
          "attempts", "nextAttemptAt", "sourceType", "sourceId", "idempotencyKey", "auto",
          "contentHash", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, 'PENDING', $5,
          0, $6, $7, $8, $9, $10,
          $11, NOW(), NOW()
        )
        ON CONFLICT ("idempotencyKey") WHERE ${input.action === 'CREATE' ? ACTIVE_CREATE_INDEX_PREDICATE : ACTIVE_MUTATION_INDEX_PREDICATE}
        DO NOTHING
        RETURNING id`,
        [
          publicationId,
          target.destinationId,
          queued.id,
          input.action,
          target.providerMessageId || null,
          input.availableAt || null,
          sourceType,
          sourceId,
          idempotencyKey,
          input.auto,
          hash,
        ],
      );
      const deliveryId = insertedId(inserted);
      if (!deliveryId) {
        await tx.query(
          `UPDATE "omnichannel_outbox_events"
           SET status = 'DONE', "completedAt" = NOW(), "lastError" = $2::text,
               "lockedAt" = NULL, "lockedBy" = NULL, "updatedAt" = NOW()
           WHERE id = $1::uuid AND status = 'PENDING'`,
          [queued.id, input.action === 'CREATE' ? 'create_deduped' : 'mutation_deduped'],
        );
        return 0;
      }
      await tx.query(
        `UPDATE "omnichannel_outbox_events"
         SET payload = payload || $2::jsonb, "updatedAt" = NOW()
         WHERE id = $1`,
        [queued.id, JSON.stringify({ deliveryId })],
      );
      return 1;
    });
  }

  private async loadActiveCreates(tx: EntityManager, idempotencyKey: string): Promise<ExistingCreateRow[]> {
    const rows = await tx.query(
      `SELECT id, status, "contentHash", "providerMessageId", "eventId", "publicationId", "createdAt", "deferredReason"
       FROM "omnichannel_publication_deliveries"
       WHERE "idempotencyKey" = $1 AND action = 'CREATE' AND "supersededAt" IS NULL`,
      [idempotencyKey],
    ) as Array<Record<string, string | null>>;
    return rows.map((row) => ({
      id: String(row.id),
      status: String(row.status),
      contentHash: row.contentHash,
      providerMessageId: row.providerMessageId,
      eventId: String(row.eventId),
      publicationId: String(row.publicationId),
      createdAt: new Date(String(row.createdAt)),
      deferredReason: row.deferredReason,
    }));
  }

  private async supersedeDeliveryIds(tx: EntityManager, ids: string[]): Promise<void> {
    if (!ids.length) return;
    await tx.query(
      `UPDATE "omnichannel_publication_deliveries"
       SET status = 'DEAD', "lastError" = 'superseded_duplicate', "supersededAt" = NOW(), "updatedAt" = NOW()
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    await tx.query(
      `UPDATE "omnichannel_outbox_events" e
       SET status = 'DEAD', "lastError" = 'superseded_duplicate', "completedAt" = COALESCE(e."completedAt", NOW()),
           "lockedAt" = NULL, "lockedBy" = NULL, "updatedAt" = NOW()
       FROM "omnichannel_publication_deliveries" d
       WHERE d.id = ANY($1::uuid[]) AND e.id = d."eventId" AND e.status <> 'DONE'`,
      [ids],
    );
  }

  private async retargetDelivery(
    tx: EntityManager,
    decision: { deliveryId: string; eventId: string },
    input: {
      publicationId: string;
      sourceType: string;
      sourceId: string;
      destinationId: string;
      channel: string;
      action: string;
      auto: boolean;
      hash: string;
      idempotencyKey: string;
      availableAt: Date;
      providerMessageId: string | null;
      rendered: RenderedPublication | null;
      reset: boolean;
    },
  ): Promise<void> {
    await tx.query(
      `UPDATE "omnichannel_publication_deliveries"
       SET "publicationId" = $2,
           "contentHash" = $3,
           "auto" = $4,
           "nextAttemptAt" = $5,
           "providerMessageId" = COALESCE($6, "providerMessageId"),
           status = CASE WHEN $7 THEN 'PENDING' ELSE status END,
           attempts = CASE WHEN $7 THEN 0 ELSE attempts END,
           "lastError" = CASE WHEN $7 THEN NULL ELSE "lastError" END,
           "deferredReason" = CASE WHEN $7 THEN NULL ELSE "deferredReason" END,
           "supersededAt" = CASE WHEN $7 THEN NULL ELSE "supersededAt" END,
           "updatedAt" = NOW()
       WHERE id = $1`,
      [
        decision.deliveryId,
        input.publicationId,
        input.hash,
        input.auto,
        input.availableAt,
        input.providerMessageId,
        input.reset,
      ],
    );
    const payload = {
      ...(input.rendered ? this.deliveryPayload(input.rendered) : {}),
      publicationId: input.publicationId,
      destinationId: input.destinationId,
      action: input.action,
      channel: input.channel,
      auto: input.auto,
      deliveryId: decision.deliveryId,
      ...(input.sourceType === FREE_POST_SOURCE_TYPE ? { sourceType: FREE_POST_SOURCE_TYPE } : {}),
      ...(input.providerMessageId ? { providerMessageId: input.providerMessageId } : {}),
    };
    const dedupeKey = buildDedupeKey({
      operationId: input.idempotencyKey,
      eventType: OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED,
      aggregateType: 'PUBLICATION',
      aggregateId: input.sourceId,
      channel: input.channel,
    });
    await tx.query(
      `UPDATE "omnichannel_outbox_events"
       SET status = 'PENDING',
           attempts = 0,
           "availableAt" = $2,
           "completedAt" = NULL,
           "lockedAt" = NULL,
           "lockedBy" = NULL,
           "lastError" = NULL,
           "dedupeKey" = CASE
             WHEN EXISTS (
               SELECT 1 FROM "omnichannel_outbox_events" other
               WHERE other."dedupeKey" = $3 AND other.id <> "omnichannel_outbox_events".id
             ) THEN "dedupeKey"
             ELSE $3
           END,
           payload = $4::jsonb,
           "updatedAt" = NOW()
       WHERE id = $1`,
      [decision.eventId, input.availableAt, dedupeKey, JSON.stringify(sanitizeOutboxPayload(payload))],
    );
  }

  private outboxDeliveryPayload(
    input: {
      channel: string;
      action: string;
      auto: boolean;
      rendered: RenderedPublication | null;
      sourceType?: string;
    },
    target: { destinationId: string; providerMessageId?: string },
    publicationId: string,
    sourceType: string,
  ): Record<string, unknown> {
    return {
      publicationId,
      destinationId: target.destinationId,
      action: input.action,
      channel: input.channel,
      auto: input.auto,
      ...(target.providerMessageId ? { providerMessageId: target.providerMessageId } : {}),
      ...(sourceType === FREE_POST_SOURCE_TYPE || input.sourceType === FREE_POST_SOURCE_TYPE
        ? { sourceType: FREE_POST_SOURCE_TYPE }
        : {}),
      ...(input.rendered ? this.deliveryPayload(input.rendered) : {}),
    };
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

  /** Turning automation on for one bot needs a canary (CANARY) or verified destination (LIVE) on that bot. */
  private async assertAutomationPrerequisitesForConnection(
    conn: ChannelConnectionEntity,
    mode: 'CANARY' | 'LIVE',
  ) {
    if (conn.status !== 'ACTIVE') {
      throw new BadRequestException('ابتدا وضعیت این ربات را ACTIVE کنید');
    }
    const dests = await this.destinations.find({ where: { connectionId: conn.id, enabled: true } });
    const ready = selectAutomationDestinationsForConnection(dests, conn, mode);
    if (!ready.length) {
      throw new BadRequestException(
        mode === 'CANARY'
          ? 'برای حالت آزمایشی این ربات، یک مقصد canary روی همین اتصال لازم است'
          : 'برای حالت زنده این ربات، دست‌کم یک مقصد فعال و بررسی‌شده روی همین اتصال لازم است',
      );
    }
  }

  /** Turning automation on for one destination: that destination must itself be eligible. */
  private async assertAutomationPrerequisitesForDestination(
    dest: ChannelDestinationEntity,
    conn: ChannelConnectionEntity,
    mode: 'CANARY' | 'LIVE',
  ) {
    if (conn.status !== 'ACTIVE') {
      throw new BadRequestException('ابتدا وضعیت این ربات را ACTIVE کنید');
    }
    if (!dest.enabled) {
      throw new BadRequestException('این مقصد غیرفعال است');
    }
    const ready = selectAutomationDestinationsForConnection([dest], conn, mode);
    if (!ready.length) {
      throw new BadRequestException(
        mode === 'CANARY'
          ? 'برای حالت آزمایشی، این مقصد باید canary باشد'
          : 'برای حالت زنده، این مقصد باید canary یا بررسی‌شده با اجازهٔ ارسال باشد',
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

  /** One canary per bot connection; each wholesale Telegram/Bale/Rubika bot may have its own. */
  private async assertUniqueCanary(connectionId: string, exceptId?: string) {
    const dests = await this.destinations.find({ where: { connectionId } });
    const current = dests.find((dest) => isCanarySettings(dest.settings));
    if (current && current.id !== exceptId) {
      throw new ConflictException('برای این ربات قبلاً مقصد canary ثبت شده');
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
    connectionId?: string,
    destinationId?: string,
  ) {
    const stored = await this.loadStoredSettings();
    let policy = readChannelOos(stored, channel).policy;
    let chosen = readChannelOos(stored, channel).chosen;
    if (destinationId) {
      const dest = await this.destinations.findOne({ where: { id: destinationId } });
      const conn = dest
        ? await this.connections.findOne({ where: { id: dest.connectionId } })
        : null;
      if (dest && conn) {
        const resolved = resolveDestinationPublishSettings(
          dest.publishSettings,
          conn.publishSettings,
          stored,
          channel,
        );
        policy = resolved.oosPolicy;
        chosen = resolved.oosChosen;
      }
    } else if (connectionId) {
      const conn = await this.connections.findOne({ where: { id: connectionId } });
      if (conn) {
        const resolved = resolveConnectionPublishSettings(conn.publishSettings, stored, channel);
        policy = resolved.oosPolicy;
        chosen = resolved.oosChosen;
      }
    }
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
