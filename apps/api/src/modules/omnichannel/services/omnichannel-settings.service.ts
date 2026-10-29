/**
 * PR-10 — per-destination channel settings + template activation guards.
 * Content never invents LIVE ids; contamination soft-warn / hard-fail on activate.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import { ChannelTemplateEntity } from '../entities/channel-template.entity';
import { AppSettingEntity } from '../../settings/entities/app-setting.entity';
import { OmnichannelAuditEntity } from '../entities/omnichannel-audit.entity';
import {
  CopyChannelSettingsDto,
  EmergencyHoldDto,
  PatchChannelSettingsDto,
} from '../dto/omnichannel.dto';
import { assertNoPlaintextSecrets } from '../omnichannel-secrets';
import {
  assertChannelContentInput,
  channelSettingsTextBlob,
  copyChannelContent,
  hasChannelContentPatch,
  parseChannelContentSettings,
  patchTouchesOwnerPolicy,
  readEmergencyHold,
  withEmergencyHold,
  writeChannelSettingsIntoPublish,
} from '../channel-settings';
import {
  assertNoCrossChannelContamination,
  contaminationWarnings,
  findCrossChannelContamination,
  type SiblingChannelMarkers,
} from '../cross-channel-contamination';
import {
  hasDestinationPublishPatch,
  mergeDestinationPublishSettingsPatch,
  parseDestinationPublishSettings,
  publicDestinationPublishSettings,
  resolveDestinationContentSettings,
  resolveDestinationPublishSettings,
} from '../destination-publish-settings';
import { parseStoredOmnichannelSettings } from '../oos-policy';
import {
  assertGoRefPresent,
  GO_REF_REQUIRED_MESSAGE,
  isOmnichannelRbacEnabled,
  normalizeGoRef,
  roleMeetsMinimum,
  type OmnichannelRole,
} from '../omnichannel-rbac';

type Actor = { id: string; omnichannelRole?: OmnichannelRole };

@Injectable()
export class OmnichannelSettingsService {
  constructor(
    @InjectRepository(ChannelConnectionEntity)
    private readonly connections: Repository<ChannelConnectionEntity>,
    @InjectRepository(ChannelDestinationEntity)
    private readonly destinations: Repository<ChannelDestinationEntity>,
    @InjectRepository(ChannelTemplateEntity)
    private readonly templates: Repository<ChannelTemplateEntity>,
    @InjectRepository(AppSettingEntity)
    private readonly settings: Repository<AppSettingEntity>,
    @InjectRepository(OmnichannelAuditEntity)
    private readonly audits: Repository<OmnichannelAuditEntity>,
  ) {}

  async getChannelSettings(destinationId: string) {
    const dest = await this.destinations.findOne({ where: { id: destinationId } });
    if (!dest) throw new NotFoundException('مقصد یافت نشد');
    const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
    if (!conn) throw new NotFoundException('اتصال یافت نشد');
    const channel = conn.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    const resolved = resolveDestinationPublishSettings(
      dest.publishSettings,
      conn.publishSettings,
      await this.loadStoredSettings(),
      channel,
    );
    const siblings = await this.siblingMarkers(destinationId);
    const text = channelSettingsTextBlob(resolved.content);
    const hits = findCrossChannelContamination(text, destinationId, siblings);
    const warnings = [
      ...contaminationWarnings(hits),
      ...(resolved.content.ownerChatId
        ? []
        : ['آی‌دی مقصد هدایت پیام‌ها خالی است؛ مالک باید پر کند (PR-14)']),
    ];
    return {
      destinationId: dest.id,
      connectionId: conn.id,
      provider: conn.provider,
      channel,
      displayName: dest.displayName,
      ...publicDestinationPublishSettings(resolved),
      warnings,
      activeTemplate: await this.activeProductTemplate(destinationId),
    };
  }

  async patchChannelSettings(destinationId: string, dto: PatchChannelSettingsDto, actor?: Actor) {
    const who = this.requireActor(actor);
    try {
      assertChannelContentInput(dto);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'تنظیمات کانال نامعتبر');
    }
    if (!hasDestinationPublishPatch(dto) && !hasChannelContentPatch(dto)) {
      throw new BadRequestException('حداقل یک فیلد تنظیمات لازم است');
    }
    // emergencyHold has a dedicated Owner+goRef route — reject here to avoid Publisher bypass.
    if (typeof (dto as { emergencyHold?: boolean }).emergencyHold === 'boolean') {
      throw new BadRequestException(
        'برای توقف اضطراری از PATCH …/emergency-hold استفاده کنید (Owner+goRef)',
      );
    }
    const policyTouch = patchTouchesOwnerPolicy(dto as unknown as Record<string, unknown>);
    if (isOmnichannelRbacEnabled()) {
      if (policyTouch) {
        if (!roleMeetsMinimum(who.omnichannelRole || 'PUBLISHER', 'OWNER')) {
          throw new ForbiddenException(
            'تغییر سیاست کانال (سقف/سکوت/ownerChatId/قیمت پیش‌فرض) فقط برای Owner است',
          );
        }
        try {
          assertGoRefPresent(dto.goRef);
        } catch {
          throw new BadRequestException(GO_REF_REQUIRED_MESSAGE);
        }
      }
      // Content-only Publisher drafts: no goRef required.
    }
    const dest = await this.destinations.findOne({ where: { id: destinationId } });
    if (!dest) throw new NotFoundException('مقصد یافت نشد');
    const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
    if (!conn) throw new NotFoundException('اتصال یافت نشد');
    const channel = conn.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    const previous = parseDestinationPublishSettings(dest.publishSettings);
    const next = mergeDestinationPublishSettingsPatch(previous, dto);
    const content = parseChannelContentSettings(next);
    let stored = writeChannelSettingsIntoPublish(next as Record<string, unknown>, content);
    // Re-apply automation keys from merge (write strips only content flats).
    const automation = parseDestinationPublishSettings(next);
    stored = {
      ...automation,
      ...stored,
      channelSettings: stored.channelSettings,
      seeded: true,
    };
    dest.publishSettings = stored;
    const saved = await this.destinations.save(dest);
    const resolved = resolveDestinationPublishSettings(
      saved.publishSettings,
      conn.publishSettings,
      await this.loadStoredSettings(),
      channel,
    );
    const siblings = await this.siblingMarkers(destinationId);
    const hits = findCrossChannelContamination(
      channelSettingsTextBlob(resolved.content),
      destinationId,
      siblings,
    );
    const auditAction = policyTouch ? 'channel_settings_policy_patch' : 'channel_settings_content_patch';
    await this.audit(who, auditAction, 'DESTINATION', saved.id, channel, dto.reason || null, {
      showPriceDefault: resolved.content.showPriceDefault,
      hasContactId: Boolean(resolved.content.contactId),
      hasUtm: Boolean(resolved.content.utmSource || resolved.content.utmCampaign),
      contaminationHits: hits.length,
      policyTouch,
    }, { goRef: dto.goRef });
    return {
      destinationId: saved.id,
      connectionId: conn.id,
      provider: conn.provider,
      channel,
      displayName: saved.displayName,
      ...publicDestinationPublishSettings(resolved),
      warnings: contaminationWarnings(hits),
    };
  }

  async patchEmergencyHold(destinationId: string, dto: EmergencyHoldDto, actor?: Actor) {
    const who = this.requireActor(actor);
    assertNoPlaintextSecrets(dto);
    if (typeof dto.hold !== 'boolean') {
      throw new BadRequestException('hold باید boolean باشد');
    }
    if (isOmnichannelRbacEnabled()) assertGoRefPresent(dto.goRef);
    const dest = await this.destinations.findOne({ where: { id: destinationId } });
    if (!dest) throw new NotFoundException('مقصد یافت نشد');
    const conn = await this.connections.findOne({ where: { id: dest.connectionId } });
    if (!conn) throw new NotFoundException('اتصال یافت نشد');
    const channel = conn.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    const before = readEmergencyHold(dest.publishSettings);
    dest.publishSettings = withEmergencyHold(
      (dest.publishSettings || {}) as Record<string, unknown>,
      dto.hold,
    );
    const saved = await this.destinations.save(dest);
    await this.audit(who, 'destination_emergency_hold', 'DESTINATION', saved.id, channel, dto.reason || null, {
      before: { emergencyHold: before },
      after: { emergencyHold: dto.hold === true },
      provider: conn.provider,
    }, { goRef: dto.goRef });
    return {
      destinationId: saved.id,
      emergencyHold: dto.hold === true,
      provider: conn.provider,
      channel,
    };
  }

  async copyChannelSettingsFrom(
    destinationId: string,
    dto: CopyChannelSettingsDto,
    actor?: Actor,
  ) {
    const who = this.requireActor(actor);
    assertNoPlaintextSecrets(dto);
    if (isOmnichannelRbacEnabled()) assertGoRefPresent(dto.goRef);
    if (dto.sourceDestinationId === destinationId) {
      throw new BadRequestException('مبدأ و مقصد کپی یکی است');
    }
    const [target, source] = await Promise.all([
      this.destinations.findOne({ where: { id: destinationId } }),
      this.destinations.findOne({ where: { id: dto.sourceDestinationId } }),
    ]);
    if (!target) throw new NotFoundException('مقصد یافت نشد');
    if (!source) throw new NotFoundException('مقصد مبدأ یافت نشد');
    const conn = await this.connections.findOne({ where: { id: target.connectionId } });
    if (!conn) throw new NotFoundException('اتصال یافت نشد');
    const channel = conn.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    const previous = parseDestinationPublishSettings(target.publishSettings);
    const sourceParsed = parseDestinationPublishSettings(source.publishSettings);
    const content = copyChannelContent(resolveDestinationContentSettings(source.publishSettings));
    let next = mergeDestinationPublishSettingsPatch(previous, {
      captionIntro: content.captionIntro,
      footerText: content.footerText,
      hashtags: content.hashtags,
      ctaText: content.ctaText,
      contactId: content.contactId,
      orderBotId: content.orderBotId,
      orderBotUsername: content.orderBotUsername,
      channelLink: content.channelLink,
      utmSource: content.utmSource,
      utmCampaign: content.utmCampaign,
      botUsername: content.botUsername,
      showPriceDefault: content.showPriceDefault,
      ownerChatId: content.ownerChatId,
    });
    if (dto.includeAutomation === true) {
      next = mergeDestinationPublishSettingsPatch(next, {
        autoPublishMode: sourceParsed.autoPublishMode,
        autoDailyCap: sourceParsed.autoDailyCap,
        autoMinGapSeconds: sourceParsed.autoMinGapSeconds,
        quietStartHour: sourceParsed.quietStartHour ?? null,
        quietEndHour: sourceParsed.quietEndHour ?? null,
        withdrawAction: sourceParsed.withdrawAction,
        oosPolicy: sourceParsed.oosPolicy,
        autoPublishEventTypes: sourceParsed.autoPublishEventTypes,
        autoPublishCategoryIds: sourceParsed.autoPublishCategoryIds,
      });
    }
    const mergedContent = parseChannelContentSettings(next);
    target.publishSettings = writeChannelSettingsIntoPublish(
      next as Record<string, unknown>,
      mergedContent,
    );
    target.publishSettings = {
      ...parseDestinationPublishSettings(next),
      ...(target.publishSettings as Record<string, unknown>),
      channelSettings: (target.publishSettings as Record<string, unknown>).channelSettings,
      seeded: true,
    };
    const saved = await this.destinations.save(target);
    const resolved = resolveDestinationPublishSettings(
      saved.publishSettings,
      conn.publishSettings,
      await this.loadStoredSettings(),
      channel,
    );
    await this.audit(who, 'channel_settings_copy_from', 'DESTINATION', saved.id, channel, dto.reason || null, {
      sourceDestinationId: source.id,
      includeAutomation: dto.includeAutomation === true,
      showPriceDefault: resolved.content.showPriceDefault,
    }, { goRef: dto.goRef });
    return {
      destinationId: saved.id,
      connectionId: conn.id,
      provider: conn.provider,
      channel,
      displayName: saved.displayName,
      ...publicDestinationPublishSettings(resolved),
    };
  }

  /** Hard-fail activate when body embeds sibling markers (D-9). */
  async assertTemplateActivationClean(destinationId: string, body: string): Promise<void> {
    const siblings = await this.siblingMarkers(destinationId);
    try {
      assertNoCrossChannelContamination(body, destinationId, siblings);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'آلودگی بین کانالی');
    }
  }

  async siblingMarkers(excludeDestinationId?: string): Promise<SiblingChannelMarkers[]> {
    const rows = await this.destinations.find({ take: 500 });
    return rows
      .filter((row) => row.id !== excludeDestinationId)
      .map((row) => {
        const content = resolveDestinationContentSettings(row.publishSettings);
        return {
          destinationId: row.id,
          contactId: content.contactId || undefined,
          orderBotUsername: content.orderBotUsername || undefined,
          channelLink: content.channelLink || undefined,
          botUsername: content.botUsername || undefined,
          ownerChatId: content.ownerChatId || undefined,
        };
      });
  }

  private async activeProductTemplate(destinationId: string) {
    const row = await this.templates.findOne({
      where: { destinationId, eventType: 'product.published', enabled: true },
      order: { version: 'DESC' },
    });
    if (!row) return null;
    return { id: row.id, version: row.version, enabled: row.enabled };
  }

  private async loadStoredSettings() {
    const row = await this.settings.findOne({ where: { key: 'omnichannel' } });
    return parseStoredOmnichannelSettings(row?.value);
  }

  private requireActor(actor?: Actor): Actor {
    if (!actor?.id) throw new BadRequestException('actor لازم است');
    return actor;
  }

  private async audit(
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    channel: string,
    reason: string | null,
    payload: Record<string, unknown>,
    opts?: { goRef?: string },
  ) {
    const goRef = normalizeGoRef(opts?.goRef);
    await this.audits.save(
      this.audits.create({
        actorId: actor.id,
        action,
        entityType,
        entityId,
        channel,
        reason,
        payload,
        goRef: goRef || null,
        source: 'panel',
      }),
    );
  }
}
