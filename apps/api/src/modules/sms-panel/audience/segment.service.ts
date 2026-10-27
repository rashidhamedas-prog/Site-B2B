import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsService } from '../../settings/settings.service';
import type { SmsMessageClass } from '../domain/template';
import { SmsAuditLogEntity, SmsSegmentEntity, SmsTemplateEntity } from '../entities/sms-panel.entities';
import { SMS_PANEL_SETTINGS_KEY } from '../sms-panel.settings';
import { SmsPanelService } from '../sms-panel.service';
import { presentAudienceContacts } from './audience-merge';
import { previewAudience, readUnitPrice } from './audience-preview';
import { AudienceService } from './audience.service';
import {
  AUDIENCE_SOURCE_PRIORITY,
  isAudienceSource,
  masksAudiencePhone,
  type AudienceSource,
} from './audience.types';
import { audienceFieldCatalog, parseSegmentRules, SegmentRuleError } from './segment-rules';
import { SMS_MARKETERS } from '../sms-roles';

const MESSAGE_CLASSES = ['OTP', 'TRANSACTIONAL', 'PROMO'] as const;

export function canManageSegments(role: string): boolean {
  return (SMS_MARKETERS as readonly string[]).includes(role);
}

@Injectable()
export class SegmentService {
  constructor(
    private readonly audience: AudienceService,
    private readonly sms: SmsPanelService,
    private readonly settings: SettingsService,
    @InjectRepository(SmsSegmentEntity) private readonly segments: Repository<SmsSegmentEntity>,
    @InjectRepository(SmsTemplateEntity) private readonly templates: Repository<SmsTemplateEntity>,
    @InjectRepository(SmsAuditLogEntity) private readonly audit: Repository<SmsAuditLogEntity>,
  ) {}

  async fields() {
    const cities = await this.audience.distinctCities().catch(() => [] as string[]);
    return audienceFieldCatalog(cities);
  }

  async preview(body: {
    sources?: string[];
    rules?: unknown;
    text?: string;
    templateId?: string;
    messageClass?: string;
  }, role?: string) {
    const rules = this.rulesOrThrow(body.rules);
    const sources = this.sourcesOrThrow(body.sources);
    const messageClass = this.classOrThrow(body.messageClass);
    const text = await this.resolveText(body.text, body.templateId);
    const collected = await this.audience.collect(sources);
    const credit = await this.sms.getCredit(false);
    const stored = await this.settings.get(SMS_PANEL_SETTINGS_KEY);
    const result = previewAudience({
      contacts: collected.contacts,
      duplicateExtras: collected.duplicateExtras,
      invalid: collected.invalid.length,
      rules,
      messageClass,
      text,
      availableCredit: credit.amount,
      unitPricePerPart: readUnitPrice(stored),
    });
    const mask = masksAudiencePhone(role);
    return {
      ...result,
      partialSources: collected.partialSources,
      sample: mask ? presentAudienceContacts(result.sample, role) : result.sample,
    };
  }

  list() {
    return this.segments.find({ order: { updatedAt: 'DESC' }, take: 200 });
  }

  async create(actorId: string, body: { name?: string; sources?: string[]; rules?: unknown }) {
    const row = await this.segments.save(this.segments.create({
      name: this.nameOrThrow(body.name),
      sources: this.sourcesOrThrow(body.sources),
      rules: this.rulesOrThrow(body.rules),
      createdBy: actorId || null,
    }));
    await this.auditAction(actorId, 'segment.create', row.id);
    return row;
  }

  async update(actorId: string, id: string, body: { name?: string; sources?: string[]; rules?: unknown }) {
    const row = await this.mustGet(id);
    if (body.name != null) row.name = this.nameOrThrow(body.name);
    if (body.sources != null) row.sources = this.sourcesOrThrow(body.sources);
    if (body.rules != null) row.rules = this.rulesOrThrow(body.rules);
    const saved = await this.segments.save(row);
    await this.auditAction(actorId, 'segment.update', id);
    return saved;
  }

  async remove(actorId: string, id: string) {
    await this.mustGet(id);
    await this.segments.delete({ id });
    await this.auditAction(actorId, 'segment.delete', id);
    return { ok: true };
  }

  private async auditAction(actorId: string, action: string, id: string) {
    await this.audit.save(this.audit.create({
      actorId: actorId || null,
      action,
      targetType: 'segment',
      targetId: id,
      meta: {},
      ip: null,
      userAgent: null,
      at: new Date(),
    }));
  }

  private async mustGet(id: string) {
    const row = await this.segments.findOne({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'سگمنت پیدا نشد', code: 'SMS_SEGMENT_NOT_FOUND' });
    return row;
  }

  private rulesOrThrow(input: unknown) {
    try {
      return parseSegmentRules(input);
    } catch (err) {
      if (err instanceof SegmentRuleError) {
        throw new BadRequestException({ message: 'قاعده سگمنت نامعتبر است', code: err.code });
      }
      throw err;
    }
  }

  private sourcesOrThrow(input?: string[]): AudienceSource[] {
    const sources = Array.isArray(input) && input.length ? input : [...AUDIENCE_SOURCE_PRIORITY];
    if (!sources.every((source) => isAudienceSource(source))) {
      throw new BadRequestException({ message: 'منبع نامعتبر است', code: 'SMS_SEGMENT_INVALID' });
    }
    return sources;
  }

  private classOrThrow(input?: string): SmsMessageClass {
    if (!(MESSAGE_CLASSES as readonly string[]).includes(String(input || ''))) {
      throw new BadRequestException({ message: 'کلاس پیام نامعتبر است', code: 'SMS_SEGMENT_INVALID' });
    }
    return input as SmsMessageClass;
  }

  private nameOrThrow(name?: string) {
    const value = String(name || '').trim();
    if (!value || value.length > 120) {
      throw new BadRequestException({ message: 'نام سگمنت لازم است', code: 'SMS_SEGMENT_INVALID' });
    }
    return value;
  }

  private async resolveText(text?: string, templateId?: string) {
    if (templateId) {
      const template = await this.templates.findOne({ where: { id: templateId } });
      if (!template) throw new NotFoundException({ message: 'قالب پیدا نشد', code: 'SMS_TEMPLATE_NOT_FOUND' });
      return template.body;
    }
    return String(text || '');
  }
}
