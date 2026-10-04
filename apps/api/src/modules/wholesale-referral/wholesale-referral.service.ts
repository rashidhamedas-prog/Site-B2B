import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppSettingEntity } from '../settings/entities/app-setting.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { OrderItemEntity } from '../order/entities/order-item.entity';
import { PaymentEntity } from '../payment/entities/payment.entity';
import { RefundEntity } from '../payment/entities/refund.entity';
import { ReturnRequestEntity } from '../rma/entities/return-request.entity';
import { OtpCooldownError, OtpService } from '../redis/redis.module';
import { allowDevOtpExpose } from '../auth/phone.util';
import { NotificationService } from '../notification/notification.service';
import { WholesaleReferralPartnerEntity } from './entities/wholesale-referral-partner.entity';
import { WholesaleReferralIntroductionEntity } from './entities/wholesale-referral-introduction.entity';
import { WholesaleReferralEventEntity } from './entities/wholesale-referral-event.entity';
import { WholesaleReferralLedgerEntryEntity } from './entities/wholesale-referral-ledger-entry.entity';
import { WholesaleReferralDisputeEntity } from './entities/wholesale-referral-dispute.entity';
import { WholesaleReferralAuditEntity } from './entities/wholesale-referral-audit.entity';
import { WholesaleReferralTermsAcceptanceEntity } from './entities/wholesale-referral-terms-acceptance.entity';
import { WholesaleReferralClickEntity } from './entities/wholesale-referral-click.entity';
import type { WholesaleReferralCapture } from './wholesale-referral-capture';
import {
  DEFAULT_WHOLESALE_REFERRAL_SETTINGS,
  FUNNEL_STEPS,
  MANUAL_FRESHNESS_NOTE,
  PARTNER_REASON_FA,
  PARTNER_STAGE_LABEL,
  REWARD_BUCKET_DEFINITION,
  REWARD_BUCKET_LABEL,
  WHOLESALE_REFERRAL_SETTINGS_KEY,
  applyOwnershipOverride,
  assertPayoutAllowed,
  bucketTotals,
  canAdjustReward,
  canOpenDispute,
  canOverrideOwnership,
  canReviewReferral,
  commitOwnership,
  launchFieldLabels,
  missingLaunchFields,
  normalizeIranMobile,
  normalizeReferralCode,
  planEstimate,
  planHoldRelease,
  planRefundReversal,
  programAllowsApply,
  programCanLockOwnership,
  programReady,
  resolveWholesaleReferralSettings,
  ruleFromSettings,
  toPartnerIntroduction,
  validateManualIntroduction,
  validatePayoutIban,
  validateStatusChange,
  type IntroRecord,
  type LedgerRow,
  type PartnerStage,
  type RewardBucket,
  type WholesaleReferralSettings,
} from './wholesale-referral-policy';

const CODE_ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789';

function newPublicCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && !!err && (err as { code?: string }).code === '23505';
}

function asStage(value: string): PartnerStage {
  return (PARTNER_STAGE_LABEL as Record<string, string>)[value] ? (value as PartnerStage) : 'SUBMITTED';
}

@Injectable()
export class WholesaleReferralService implements WholesaleReferralCapture {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly otp: OtpService,
    @Optional() private readonly notifications: NotificationService | null,
    @InjectRepository(AppSettingEntity) private readonly settingsRepo: Repository<AppSettingEntity>,
    @InjectRepository(WholesaleReferralPartnerEntity) private readonly partners: Repository<WholesaleReferralPartnerEntity>,
    @InjectRepository(WholesaleReferralIntroductionEntity) private readonly intros: Repository<WholesaleReferralIntroductionEntity>,
    @InjectRepository(WholesaleReferralEventEntity) private readonly events: Repository<WholesaleReferralEventEntity>,
    @InjectRepository(WholesaleReferralLedgerEntryEntity) private readonly ledger: Repository<WholesaleReferralLedgerEntryEntity>,
    @InjectRepository(WholesaleReferralDisputeEntity) private readonly disputes: Repository<WholesaleReferralDisputeEntity>,
    @InjectRepository(WholesaleReferralAuditEntity) private readonly audits: Repository<WholesaleReferralAuditEntity>,
    @InjectRepository(WholesaleReferralTermsAcceptanceEntity) private readonly terms: Repository<WholesaleReferralTermsAcceptanceEntity>,
    @InjectRepository(WholesaleReferralClickEntity) private readonly clicks: Repository<WholesaleReferralClickEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(CustomerEntity) private readonly customers: Repository<CustomerEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity) private readonly items: Repository<OrderItemEntity>,
    @InjectRepository(PaymentEntity) private readonly payments: Repository<PaymentEntity>,
    @InjectRepository(RefundEntity) private readonly refunds: Repository<RefundEntity>,
    @InjectRepository(ReturnRequestEntity) private readonly returns: Repository<ReturnRequestEntity>,
  ) {}

  async settings(): Promise<WholesaleReferralSettings> {
    const row = await this.settingsRepo.findOne({ where: { key: WHOLESALE_REFERRAL_SETTINGS_KEY } });
    return resolveWholesaleReferralSettings(row?.value);
  }

  async publicSettings() {
    const settings = await this.settings();
    const termsFinal = settings.termsVersion !== 'draft-unreviewed' && settings.termsBody.trim().length > 0;
    return {
      applyOpen: settings.mode === 'LIVE' && programReady(settings) && settings.applyOpen,
      canary: settings.mode === 'CANARY',
      termsFinal,
      termsVersion: termsFinal ? settings.termsVersion : 'draft-unreviewed',
      termsBody: termsFinal ? settings.termsBody : '',
      eligibilityNote: settings.boutiqueEligibilityNote,
      rewardPublished: false,
      freshnessNote: MANUAL_FRESHNESS_NOTE,
    };
  }

  async saveSettings(actorUserId: string, role: string, patch: Record<string, unknown>) {
    if (role !== 'ADMIN') throw new ForbiddenException('فقط مدیر کل می‌تواند قواعد برنامه را ذخیره کند.');
    if (patch.repeatOrderRewards === true || patch.marketDevelopmentTier === true) {
      throw new BadRequestException('پاداش سفارش تکراری و سطح پیشرفته در این نسخه فعال نمی‌شوند.');
    }
    const current = await this.settings();
    const next = resolveWholesaleReferralSettings({ ...current, ...patch, repeatOrderRewards: false, marketDevelopmentTier: false });
    if (next.enabled && missingLaunchFields(next).length) {
      throw new BadRequestException(
        `برنامه روشن نمی‌شود تا این موارد تأیید شوند: ${launchFieldLabels(missingLaunchFields(next)).join('، ')}`,
      );
    }
    if ((next.mode === 'CANARY' || next.mode === 'LIVE') && next.enabled && missingLaunchFields(next).length) {
      throw new BadRequestException('حالت آزمایش یا اجرا بدون قواعد کامل مجاز نیست.');
    }
    await this.settingsRepo.save({ key: WHOLESALE_REFERRAL_SETTINGS_KEY, value: next });
    await this.audit(actorUserId, 'SETTINGS_SAVE', 'settings', WHOLESALE_REFERRAL_SETTINGS_KEY, {
      enabled: next.enabled,
      mode: next.mode,
      termsVersion: next.termsVersion,
    });
    return { settings: next, missing: launchFieldLabels(missingLaunchFields(next)) };
  }

  async recordClick(rawCode: string) {
    const code = normalizeReferralCode(rawCode);
    if (!code) return { recorded: false };
    const partner = await this.partners.findOne({ where: { publicCode: code, status: 'APPROVED' } });
    if (!partner) return { recorded: false };
    await this.clicks.save(this.clicks.create({ publicCode: code }));
    return { recorded: true };
  }

  async apply(input: { displayName: string; phone: string; termsAccepted: boolean }) {
    const phone = normalizeIranMobile(input.phone);
    if (!phone) throw new BadRequestException('شماره موبایل معتبر نیست.');
    if (!input.displayName.trim()) throw new BadRequestException('نام همکار لازم است.');
    const settings = await this.settings();
    if (!input.termsAccepted || !programAllowsApply(settings, phone)) {
      throw new ForbiddenException('پذیرش درخواست هنوز باز نیست یا شرایط تأییدشده پذیرفته نشده است.');
    }
    const existing = await this.partners.findOne({ where: { phone } });
    if (existing && existing.status !== 'PENDING_PHONE') {
      return { status: existing.status, alreadySubmitted: true, message: 'وضعیت بررسی درخواست شما همین است.' };
    }
    const partner = existing
      ? existing
      : await this.partners.save(this.partners.create({
          phone,
          displayName: input.displayName.trim(),
          status: 'PENDING_PHONE',
          userId: null,
          publicCode: null,
        }));
    if (partner.displayName !== input.displayName.trim()) {
      partner.displayName = input.displayName.trim();
      await this.partners.save(partner);
    }
    return this.issueOtp(phone, input.displayName, 'boutique_referral_apply');
  }

  async verifyApplication(input: { phone: string; code: string }) {
    const phone = normalizeIranMobile(input.phone);
    if (!phone) throw new BadRequestException('شماره موبایل معتبر نیست.');
    await this.verifyOtp(phone, input.code, 'boutique_referral_apply');
    const settings = await this.settings();
    const partner = await this.partners.findOne({ where: { phone } });
    if (!partner) throw new NotFoundException('درخواستی برای این شماره نیست.');
    const now = new Date();
    partner.status = 'PENDING_REVIEW';
    partner.termsVersion = settings.termsVersion;
    partner.termsAcceptedAt = now;
    await this.partners.save(partner);
    await this.terms.save(this.terms.create({
      partnerId: partner.id,
      termsVersion: settings.termsVersion,
      acceptedAt: now,
      phoneVerifiedAt: now,
    }));
    await this.audit(null, 'TERMS_ACCEPTANCE', 'partner', partner.id, { termsVersion: settings.termsVersion });
    return { status: partner.status, message: 'درخواست ثبت شد و در صف بررسی است.' };
  }

  async requestLogin(phoneRaw: string) {
    const phone = normalizeIranMobile(phoneRaw);
    if (!phone) throw new BadRequestException('شماره موبایل معتبر نیست.');
    const partner = await this.partners.findOne({ where: { phone, status: 'APPROVED' } });
    if (!partner?.userId) throw new ForbiddenException('حساب همکاری شما هنوز فعال نشده است.');
    return this.issueOtp(phone, partner.displayName, 'boutique_referral_login');
  }

  async verifyLogin(phoneRaw: string, code: string) {
    const phone = normalizeIranMobile(phoneRaw);
    if (!phone) throw new BadRequestException('شماره موبایل معتبر نیست.');
    await this.verifyOtp(phone, code, 'boutique_referral_login');
    const partner = await this.partners.findOne({ where: { phone, status: 'APPROVED' } });
    if (!partner?.userId) throw new ForbiddenException('حساب همکاری شما هنوز فعال نشده است.');
    const accessToken = this.jwt.sign({
      sub: partner.userId,
      phone,
      role: 'REFERRAL_PARTNER',
      purpose: 'boutique_referral',
    });
    return { accessToken, role: 'REFERRAL_PARTNER' };
  }

  async home(partnerId: string) {
    const partner = await this.requirePartner(partnerId);
    const rows = await this.intros.find({ where: { partnerId }, order: { updatedAt: 'DESC' }, take: 8 });
    const owned = rows.filter((row) => row.ownershipStatus === 'OWNED').length;
    const rewards = bucketTotals(await this.ledgerRows(partnerId));
    return {
      displayName: partner.displayName,
      primaryAction: rows.length
        ? { href: '/hamkar-moarefi/panel/introductions', label: 'معرفی‌ها را ببینید' }
        : { href: '/hamkar-moarefi/panel/link', label: 'اولین بوتیک را معرفی کنید' },
      recent: rows
        .slice(0, 5)
        .map((row) => this.partnerCard(partnerId, row, bucketTotals([])))
        .filter((card): card is NonNullable<typeof card> => card != null),
      acceptedCount: owned,
      availableForPayout: rewards.available,
      buckets: rewards,
      bucketLabels: REWARD_BUCKET_LABEL,
      bucketDefinitions: REWARD_BUCKET_DEFINITION,
      freshnessNote: MANUAL_FRESHNESS_NOTE,
    };
  }

  async toolkit(partnerId: string) {
    const partner = await this.requirePartner(partnerId);
    const settings = await this.settings();
    const origin = this.config.get<string>('WHOLESALE_PUBLIC_ORIGIN', 'https://poshaktaranom.com');
    const link = partner.publicCode ? `${origin}/go/br/${partner.publicCode}` : null;
    return {
      link,
      code: partner.publicCode,
      invitationText: link
        ? `سلام. اگر بوتیک شما خریدار عمده است، از این لینک درخواست همکاری با پوشاک ترنم را بفرستید. بعد از تأیید حساب، خودتان مستقیم از ترنم خرید می‌کنید: ${link}`
        : 'لینک دعوت بعد از تأیید همکاری ساخته می‌شود.',
      eligibilityNote: settings.boutiqueEligibilityNote,
      materialsNote: 'مادهٔ تصویری تأییدشده‌ای هنوز برای اشتراک گذاشته نشده است.',
      minOrderNote: 'حداقل سفارش هر مدل بعد از تأیید حساب، روی خود کالا در فروش عمده دیده می‌شود.',
      reward: settings.rewardKind
        ? {
            kind: settings.rewardKind,
            rateBps: settings.rewardRateBps,
            fixedAmount: settings.rewardFixedAmount,
            cap: settings.rewardCap,
            holdDays: settings.holdDays,
            note: 'این عدد فقط وقتی در پاداش شما می‌آید که قواعد برنامه روشن باشد و سفارش واجد شرایط پرداخت شده باشد.',
          }
        : null,
      rewardUnset: !settings.rewardKind,
      freshnessNote: MANUAL_FRESHNESS_NOTE,
    };
  }

  async listMine(partnerId: string, q?: string) {
    const rows = await this.intros.find({ where: { partnerId }, order: { updatedAt: 'DESC' }, take: 100 });
    const query = (q || '').trim();
    const filtered = query
      ? rows.filter((row) => (row.boutiqueName || '').includes(query) || row.stage.includes(query.toUpperCase()))
      : rows;
    return {
      items: filtered
        .map((row) => this.partnerCard(partnerId, row, bucketTotals([])))
        .filter((card): card is NonNullable<typeof card> => card != null),
      freshnessNote: MANUAL_FRESHNESS_NOTE,
    };
  }

  async getMine(partnerId: string, id: string) {
    const row = await this.intros.findOne({ where: { id } });
    if (!row) throw new NotFoundException('معرفی پیدا نشد.');
    const rewards = await this.rewardTotals(row.id);
    const view = toPartnerIntroduction({
      viewerPartnerId: partnerId,
      rewards,
      row: {
        id: row.id,
        partnerId: row.partnerId,
        stage: asStage(row.stage),
        partnerExplanation: row.partnerExplanation,
        reasonCode: row.reasonCode,
        nextAction: row.nextAction,
        updatedAt: row.updatedAt.toISOString(),
        phone: row.normalizedPhone,
        internalNote: row.internalNote,
      },
    });
    if (!view.ok) throw new ForbiddenException('به این معرفی دسترسی ندارید.');
    const history = await this.events.find({ where: { introductionId: id }, order: { createdAt: 'ASC' } });
    return {
      introduction: view.view,
      timeline: history.map((event) => ({
        at: event.createdAt.toISOString(),
        stageLabel: PARTNER_STAGE_LABEL[asStage(event.toStage)],
        explanation: event.partnerExplanation || (event.reasonCode ? PARTNER_REASON_FA[event.reasonCode] : null),
      })),
      bucketDefinitions: REWARD_BUCKET_DEFINITION,
    };
  }

  async manualIntro(partnerId: string, input: {
    boutiqueName: string;
    phone: string;
    consentToShareContact: boolean;
  }) {
    const consent = validateManualIntroduction(input.consentToShareContact === true);
    if ('error' in consent) throw new BadRequestException(consent.error);
    const phone = normalizeIranMobile(input.phone);
    if (!phone) throw new BadRequestException('شماره بوتیک معتبر نیست.');
    const partner = await this.requirePartner(partnerId);
    if (partner.status !== 'APPROVED' || !partner.publicCode) {
      throw new ForbiddenException('بعد از تأیید همکاری می‌توانید بوتیک معرفی کنید.');
    }
    const customer = await this.customers.findOne({ where: { phone } });
    const settings = await this.settings();
    const commit = await this.lockPhone(phone, {
      newId: randomUUID(),
      partnerId,
      partnerPhone: partner.phone,
      boutiquePhone: phone,
      customerId: customer?.id || null,
      customerPreexistingActive: customer?.status === 'ACTIVE',
      referralCodeValid: true,
      now: new Date().toISOString(),
      windowDays: settings.ownershipWindowDays,
      programCanLock: programCanLockOwnership(settings, partner.phone),
    }, { source: 'MANUAL', boutiqueName: input.boutiqueName.trim(), consent: true });
    return { decision: commit.decision, reasonCode: commit.reasonCode };
  }

  async openDispute(partnerId: string, introductionId: string, message: string) {
    const row = await this.intros.findOne({ where: { id: introductionId } });
    if (!row) throw new NotFoundException('معرفی پیدا نشد.');
    if (!canOpenDispute(partnerId, row.partnerId)) throw new ForbiddenException('به این معرفی دسترسی ندارید.');
    if (!message.trim()) throw new BadRequestException('شرح اختلاف لازم است.');
    const dispute = await this.disputes.save(this.disputes.create({
      introductionId,
      partnerId,
      message: message.trim(),
      status: 'OPEN',
    }));
    await this.audit(null, 'DISPUTE_OPENED', 'dispute', dispute.id, { introductionId });
    return { id: dispute.id, status: dispute.status };
  }

  async savePayout(partnerId: string, ibanRaw: string, beneficiary: string) {
    const partner = await this.requirePartner(partnerId);
    const iban = validatePayoutIban(ibanRaw);
    if ('error' in iban) throw new BadRequestException(iban.error);
    if (!beneficiary.trim()) throw new BadRequestException('نام صاحب حساب لازم است.');
    const totals = bucketTotals(await this.ledgerRows(partnerId));
    const settings = await this.settings();
    const allowed = assertPayoutAllowed(totals.available, settings.minPayout);
    if ('error' in allowed) throw new BadRequestException(allowed.error);
    partner.payoutIban = iban.iban;
    partner.payoutBeneficiary = beneficiary.trim();
    await this.partners.save(partner);
    return { saved: true, message: 'اطلاعات پرداخت ذخیره شد. واریز بعد از ثبت تیم مالی انجام می‌شود.' };
  }

  async onWholesaleRegistered(input: { customerId: string; phone: string; referralCode?: string | null }): Promise<void> {
    const code = normalizeReferralCode(input.referralCode);
    const phone = normalizeIranMobile(input.phone);
    if (!code || !phone) return;
    const partner = await this.partners.findOne({ where: { publicCode: code, status: 'APPROVED' } });
    if (!partner) return;
    const settings = await this.settings();
    await this.lockPhone(phone, {
      newId: randomUUID(),
      partnerId: partner.id,
      partnerPhone: partner.phone,
      boutiquePhone: phone,
      customerId: input.customerId,
      customerPreexistingActive: false,
      referralCodeValid: true,
      now: new Date().toISOString(),
      windowDays: settings.ownershipWindowDays,
      programCanLock: programCanLockOwnership(settings, partner.phone),
    }, { source: 'LINK', boutiqueName: null, consent: false });
  }

  async adminQueue(role: string, stage?: string) {
    if (!canReviewReferral(role)) throw new ForbiddenException('دسترسی غیرمجاز');
    const where = stage ? { stage } : {};
    const rows = await this.intros.find({ where, order: { updatedAt: 'DESC' }, take: 100 });
    const partnerIds = [...new Set(rows.map((row) => row.partnerId))];
    const partners = partnerIds.length ? await this.partners.find({ where: { id: In(partnerIds) } }) : [];
    const byId = new Map(partners.map((partner) => [partner.id, partner]));
    return rows.map((row) => ({
      id: row.id,
      stage: row.stage,
      stageLabel: PARTNER_STAGE_LABEL[asStage(row.stage)],
      ownershipStatus: row.ownershipStatus,
      reasonCode: row.reasonCode,
      partnerExplanation: row.partnerExplanation,
      internalNote: row.internalNote,
      nextAction: row.nextAction,
      boutiqueName: row.boutiqueName,
      normalizedPhone: row.normalizedPhone,
      customerId: row.customerId,
      orderId: row.orderId,
      partnerName: byId.get(row.partnerId)?.displayName || '',
      updatedAt: row.updatedAt,
      assignedStaffId: row.assignedStaffId,
    }));
  }

  async adminApplications(role: string) {
    if (!canReviewReferral(role)) throw new ForbiddenException('دسترسی غیرمجاز');
    return this.partners.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  async approvePartner(actorUserId: string, role: string, partnerId: string) {
    if (role !== 'ADMIN' && role !== 'SALES_MANAGER') throw new ForbiddenException('دسترسی غیرمجاز');
    const partner = await this.partners.findOne({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('درخواست پیدا نشد.');
    if (partner.status !== 'PENDING_REVIEW') throw new BadRequestException('فقط درخواست در حال بررسی تأیید می‌شود.');
    const existingUser = await this.users.findOne({ where: { phone: partner.phone } });
    if (existingUser && existingUser.role !== 'REFERRAL_PARTNER') {
      throw new ConflictException('این شماره قبلاً حساب دیگری در ترنم دارد. شمارهٔ دیگری برای همکار لازم است.');
    }
    let user = existingUser;
    if (!user) {
      user = await this.users.save(this.users.create({
        phone: partner.phone,
        passwordHash: await bcrypt.hash(randomUUID(), 12),
        role: 'REFERRAL_PARTNER',
        isActive: true,
      }));
    }
    partner.userId = user.id;
    partner.status = 'APPROVED';
    partner.publicCode = partner.publicCode || newPublicCode();
    await this.partners.save(partner);
    await this.audit(actorUserId, 'PARTNER_APPROVED', 'partner', partner.id, { publicCode: partner.publicCode });
    return { status: partner.status, publicCode: partner.publicCode };
  }

  async updateStatus(actorUserId: string, role: string, id: string, body: {
    toStatus: string;
    reasonCode?: string;
    partnerExplanation?: string;
    internalNote?: string;
    nextAction?: string;
    assignedStaffId?: string;
  }) {
    if (!canReviewReferral(role)) throw new ForbiddenException('دسترسی غیرمجاز');
    const checked = validateStatusChange(body);
    if ('error' in checked) throw new BadRequestException(checked.error);
    const row = await this.intros.findOne({ where: { id } });
    if (!row) throw new NotFoundException('معرفی پیدا نشد.');
    const from = row.stage;
    row.stage = body.toStatus;
    row.reasonCode = body.reasonCode?.trim() || null;
    row.partnerExplanation = checked.partnerExplanation;
    row.internalNote = checked.internalNote;
    row.nextAction = body.nextAction?.trim() || row.nextAction;
    if (body.assignedStaffId) row.assignedStaffId = body.assignedStaffId;
    await this.intros.save(row);
    await this.events.save(this.events.create({
      introductionId: row.id,
      fromStage: from,
      toStage: row.stage,
      reasonCode: row.reasonCode,
      partnerExplanation: row.partnerExplanation,
      internalNote: row.internalNote,
      actorUserId,
    }));
    await this.audit(actorUserId, 'STATUS_CHANGE', 'introduction', row.id, { from, to: row.stage, reasonCode: row.reasonCode });
    return { id: row.id, stage: row.stage };
  }

  async overrideOwnership(actorUserId: string, role: string, id: string, reason: string) {
    if (!canOverrideOwnership(role)) throw new ForbiddenException('دسترسی غیرمجاز');
    const target = await this.intros.findOne({ where: { id } });
    if (!target) throw new NotFoundException('معرفی پیدا نشد.');
    const settings = await this.settings();
    const rows = await this.intros.find({ where: { normalizedPhone: target.normalizedPhone } });
    const result = applyOwnershipOverride({
      records: rows.map((row) => this.toRecord(row)),
      phone: target.normalizedPhone,
      nextPartnerId: target.partnerId,
      now: new Date().toISOString(),
      windowDays: settings.ownershipWindowDays,
      reason,
    });
    if ('error' in result) throw new BadRequestException(result.error);
    await this.persistRecords(rows, result.records);
    await this.audit(actorUserId, 'OWNERSHIP_OVERRIDE', 'introduction', id, { reason: reason.trim() });
    return { id, ownershipStatus: 'OWNED' };
  }

  async syncOrder(actorUserId: string, role: string, orderId: string) {
    if (!canAdjustReward(role) && role !== 'SALES_MANAGER') throw new ForbiddenException('دسترسی غیرمجاز');
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('سفارش پیدا نشد.');
    const intro = await this.intros.findOne({ where: { customerId: order.customerId, ownershipStatus: 'OWNED' } });
    if (!intro) throw new BadRequestException('برای این مشتری معرفیِ مالکِ معتبری نیست.');
    const snapshot = await this.orderSnapshot(order);
    const settings = await this.settings();
    const rule = ruleFromSettings(settings);
    const existing = await this.ledger.find({ where: { introductionId: intro.id, orderId } });
    const keys = new Set(existing.map((row) => row.idempotencyKey));
    const mapped = existing.map((row) => this.toLedger(row));
    const estimate = planEstimate({
      existingKeys: keys,
      introductionId: intro.id,
      orderId,
      order: snapshot,
      rule,
    });
    const posted = await this.insertLedger(intro, estimate.rows, rule, snapshot.netMerchandise);
    const estimateRow = existing.find((row) => row.entryType === 'REWARD_ESTIMATED') || posted.find((row) => row.entryType === 'REWARD_ESTIMATED');
    const previousNet = Number(estimateRow?.ruleSnapshot?.netMerchandise || snapshot.netMerchandise);
    const reversal = planRefundReversal({
      existing: [...mapped, ...posted.map((row) => this.toLedger(row))],
      existingKeys: new Set([...keys, ...posted.map((row) => row.idempotencyKey)]),
      introductionId: intro.id,
      orderId,
      previousNet,
      nextNet: snapshot.netMerchandise,
      eventId: `net:${snapshot.netMerchandise}`,
      ruleVersion: rule?.version || null,
    });
    const reversed = await this.insertLedger(intro, reversal, rule, snapshot.netMerchandise);
    if (posted.length) {
      intro.orderId = orderId;
      intro.stage = 'REWARD_ESTIMATED';
      intro.partnerExplanation = 'اولین سفارش پرداخت شده و پاداش فقط برآورد است.';
      await this.intros.save(intro);
    }
    await this.audit(actorUserId, 'FINANCIAL_ADJUSTMENT', 'order', orderId, {
      introductionId: intro.id,
      blocked: estimate.blocked,
      posted: posted.length + reversed.length,
    });
    return { blocked: estimate.blocked, posted: posted.length + reversed.length, netMerchandise: snapshot.netMerchandise };
  }

  async transitionReward(actorUserId: string, role: string, introductionId: string, to: 'held' | 'available' | 'paid') {
    if (!canAdjustReward(role)) throw new ForbiddenException('ثبت وضعیت مالی فقط برای مدیر کل و حسابدار است.');
    const intro = await this.intros.findOne({ where: { id: introductionId } });
    if (!intro?.orderId) throw new BadRequestException('هنوز سفارش متصل به این معرفی نیست.');
    const existing = await this.ledger.find({ where: { introductionId, orderId: intro.orderId } });
    const rows = planHoldRelease({
      existing: existing.map((row) => this.toLedger(row)),
      existingKeys: new Set(existing.map((row) => row.idempotencyKey)),
      introductionId,
      orderId: intro.orderId,
      to,
      ruleVersion: existing.find((row) => row.ruleSnapshot)?.ruleSnapshot?.version as string | undefined || null,
    });
    const posted = await this.insertLedger(intro, rows, null, null);
    const stage = to === 'held' ? 'REWARD_HELD' : to === 'available' ? 'REWARD_AVAILABLE' : 'REWARD_PAID';
    intro.stage = stage;
    if (to === 'held') {
      intro.reasonCode = 'HOLD_PERIOD';
      intro.partnerExplanation = PARTNER_REASON_FA.HOLD_PERIOD;
    } else {
      intro.partnerExplanation = PARTNER_STAGE_LABEL[stage];
    }
    await this.intros.save(intro);
    await this.audit(actorUserId, 'FINANCIAL_ADJUSTMENT', 'introduction', introductionId, { to, posted: posted.length });
    return { stage, posted: posted.length };
  }

  async resolveDispute(actorUserId: string, role: string, id: string, resolution: string) {
    if (!canReviewReferral(role)) throw new ForbiddenException('دسترسی غیرمجاز');
    if (resolution.trim().length < 8) throw new BadRequestException('نتیجهٔ اختلاف باید روشن نوشته شود.');
    const dispute = await this.disputes.findOne({ where: { id } });
    if (!dispute) throw new NotFoundException('اختلاف پیدا نشد.');
    dispute.status = 'RESOLVED';
    dispute.resolution = resolution.trim();
    dispute.resolvedByUserId = actorUserId;
    await this.disputes.save(dispute);
    await this.audit(actorUserId, 'DISPUTE_RESOLVED', 'dispute', id, { introductionId: dispute.introductionId });
    return { status: dispute.status };
  }

  async report(role: string) {
    if (!canReviewReferral(role) && role !== 'ACCOUNTANT') throw new ForbiddenException('دسترسی غیرمجاز');
    const [partners, intros, ledger, openDisputes, clicks] = await Promise.all([
      this.partners.count(),
      this.intros.find({ take: 500 }),
      this.ledger.find({ take: 1000 }),
      this.disputes.count({ where: { status: 'OPEN' } }),
      this.clicks.count(),
    ]);
    const approved = await this.partners.count({ where: { status: 'APPROVED' } });
    const totals = bucketTotals(ledger.map((row) => this.toLedger(row)));
    return {
      funnel: FUNNEL_STEPS,
      counts: {
        partner_application: partners,
        partner_approval: approved,
        unique_introduction: intros.length,
        accepted_introduction: intros.filter((row) => row.ownershipStatus === 'OWNED').length,
        boutique_approval: intros.filter((row) => ['ACCOUNT_APPROVED', 'FIRST_ORDER_PENDING', 'REWARD_ESTIMATED', 'REWARD_HELD', 'REWARD_AVAILABLE', 'REWARD_PAID'].includes(row.stage)).length,
        first_paid_qualifying_order: ledger.filter((row) => row.entryType === 'REWARD_ESTIMATED').length,
        reward_available: totals.available > 0 ? 1 : 0,
        reward_paid: totals.paid > 0 ? 1 : 0,
      },
      rewards: totals,
      openDisputes,
      diagnosticClicks: clicks,
      note: 'کلیک ابزار تشخیص است و معیار اصلی موفقیت نیست.',
    };
  }

  private async issueOtp(phone: string, name: string, purpose: 'boutique_referral_apply' | 'boutique_referral_login') {
    try {
      const issued = await this.otp.issue(phone, name, purpose);
      await this.notifications?.sendOtp(phone, issued.code).catch(() => undefined);
      const expose = allowDevOtpExpose(this.config.get('NODE_ENV', ''), this.config.get('OTP_EXPOSE', ''));
      return {
        status: 'CODE_SENT',
        expiresInSeconds: this.otp.ttlSeconds(),
        ...(expose ? { devCode: issued.code } : {}),
      };
    } catch (err) {
      if (err instanceof OtpCooldownError) {
        throw new BadRequestException(`کد قبلی هنوز معتبر است. ${err.remainingSeconds} ثانیه دیگر دوباره درخواست کنید.`);
      }
      throw err;
    }
  }

  private async verifyOtp(phone: string, code: string, purpose: 'boutique_referral_apply' | 'boutique_referral_login') {
    try {
      await this.otp.verify(phone, code, purpose);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'EXPIRED') throw new BadRequestException('کد منقضی شده است. دوباره درخواست کنید.');
      if (message === 'MAX_ATTEMPTS') throw new BadRequestException('تعداد تلاش بیش از حد است. کمی بعد دوباره درخواست کنید.');
      throw new BadRequestException('کد واردشده درست نیست.');
    }
  }

  private async requirePartner(partnerId: string) {
    const partner = await this.partners.findOne({ where: { id: partnerId } });
    if (!partner) throw new ForbiddenException('حساب همکاری پیدا نشد.');
    return partner;
  }

  private partnerCard(partnerId: string, row: WholesaleReferralIntroductionEntity, rewards: Record<RewardBucket, number>) {
    const view = toPartnerIntroduction({
      viewerPartnerId: partnerId,
      rewards: row.orderId ? rewards : bucketTotals([]),
      row: {
        id: row.id,
        partnerId: row.partnerId,
        stage: asStage(row.stage),
        partnerExplanation: row.partnerExplanation,
        reasonCode: row.reasonCode,
        nextAction: row.nextAction,
        updatedAt: row.updatedAt.toISOString(),
      },
    });
    return view.ok ? view.view : null;
  }

  private async ledgerRows(partnerId: string): Promise<LedgerRow[]> {
    const rows = await this.ledger.find({ where: { partnerId }, take: 500 });
    return rows.map((row) => this.toLedger(row));
  }

  private async rewardTotals(introductionId: string) {
    const rows = await this.ledger.find({ where: { introductionId } });
    return bucketTotals(rows.map((row) => this.toLedger(row)));
  }

  private toLedger(row: WholesaleReferralLedgerEntryEntity): LedgerRow {
    return {
      idempotencyKey: row.idempotencyKey,
      bucket: row.bucket as RewardBucket,
      amount: Number(row.amount),
      entryType: row.entryType,
      orderId: row.orderId || '',
      ruleVersion: typeof row.ruleSnapshot?.version === 'string' ? row.ruleSnapshot.version : null,
    };
  }

  private toRecord(row: WholesaleReferralIntroductionEntity): IntroRecord {
    return {
      id: row.id,
      partnerId: row.partnerId,
      normalizedPhone: row.normalizedPhone,
      customerId: row.customerId,
      ownershipStatus: row.ownershipStatus as IntroRecord['ownershipStatus'],
      reasonCode: row.reasonCode,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      stage: asStage(row.stage),
    };
  }

  private async lockPhone(
    phone: string,
    attempt: Parameters<typeof commitOwnership>[1],
    meta: { source: 'LINK' | 'MANUAL'; boutiqueName: string | null; consent: boolean },
  ) {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`wr:${phone}`]);
      const existing = await manager.find(WholesaleReferralIntroductionEntity, { where: { normalizedPhone: phone } });
      const commit = commitOwnership(existing.map((row) => this.toRecord(row)), attempt);
      await this.persistRecords(existing, commit.records, manager, meta);
      return commit;
    });
  }

  private async persistRecords(
    existing: WholesaleReferralIntroductionEntity[],
    records: IntroRecord[],
    manager?: EntityManager,
    meta?: { source: 'LINK' | 'MANUAL'; boutiqueName: string | null; consent: boolean },
  ) {
    const repo = manager ? manager.getRepository(WholesaleReferralIntroductionEntity) : this.intros;
    const byId = new Map(existing.map((row) => [row.id, row]));
    for (const record of records) {
      const current = byId.get(record.id);
      if (!current) {
        await repo.save(repo.create({
          id: record.id,
          partnerId: record.partnerId,
          normalizedPhone: record.normalizedPhone,
          customerId: record.customerId,
          source: meta?.source || 'LINK',
          consentToShareContact: meta?.consent === true,
          consentAt: meta?.consent ? new Date() : null,
          stage: record.stage,
          ownershipStatus: record.ownershipStatus,
          reasonCode: record.reasonCode,
          partnerExplanation: record.reasonCode ? PARTNER_REASON_FA[record.reasonCode] || null : null,
          boutiqueName: meta?.boutiqueName || null,
          acquiredAt: record.ownershipStatus === 'OWNED' ? new Date() : null,
          expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
        }));
        continue;
      }
      current.customerId = record.customerId;
      current.stage = record.stage;
      current.ownershipStatus = record.ownershipStatus;
      current.reasonCode = record.reasonCode;
      current.expiresAt = record.expiresAt ? new Date(record.expiresAt) : null;
      if (record.ownershipStatus === 'OWNED' && !current.acquiredAt) current.acquiredAt = new Date();
      if (record.reasonCode && !current.partnerExplanation) {
        current.partnerExplanation = PARTNER_REASON_FA[record.reasonCode] || current.partnerExplanation;
      }
      await repo.save(current);
    }
  }

  private async insertLedger(
    intro: WholesaleReferralIntroductionEntity,
    rows: LedgerRow[],
    rule: ReturnType<typeof ruleFromSettings>,
    net: number | null,
  ) {
    const saved: WholesaleReferralLedgerEntryEntity[] = [];
    for (const row of rows) {
      try {
        const entry = await this.ledger.save(this.ledger.create({
          partnerId: intro.partnerId,
          introductionId: intro.id,
          orderId: row.orderId,
          entryType: row.entryType,
          bucket: row.bucket,
          amount: row.amount,
          idempotencyKey: row.idempotencyKey,
          ruleSnapshot: rule ? { ...rule, netMerchandise: net } : net == null ? null : { netMerchandise: net },
        }));
        saved.push(entry);
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    return saved;
  }

  private async orderSnapshot(order: OrderEntity) {
    const payments = await this.payments.find({ where: { orderId: order.id } });
    const paid = payments.filter((row) => row.status === 'PAID');
    const paidAmount = paid.reduce((sum, row) => sum + Number(row.amount), 0);
    const refunded = payments.length
      ? await this.refunds.find({ where: { paymentId: In(payments.map((row) => row.id)), status: 'SUCCEEDED' } })
      : [];
    const refundedAmount = refunded.reduce((sum, row) => sum + Number(row.amount), 0);
    const returns = await this.returns.find({ where: { orderId: order.id, requestType: 'RETURN' } });
    const itemIds = returns.filter((row) => row.status === 'APPROVED' || row.status === 'COMPLETED').map((row) => row.orderItemId);
    const returnedItems = itemIds.length ? await this.items.find({ where: { id: In(itemIds) } }) : [];
    const returnedMerchandise = returnedItems.reduce((sum, row) => sum + Number(row.totalPrice), 0);
    const paymentStatus = paidAmount > 0 ? 'PAID' as const : 'NONE' as const;
    const net = planEstimate({
      existingKeys: new Set(),
      introductionId: 'snapshot',
      orderId: order.id,
      order: {
        orderType: order.type,
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        walletApplied: Number(order.walletApplied || 0),
        shippingFee: Number(order.shippingFee),
        taxAmount: 0,
        cancelled: order.status === 'CANCELLED' || order.status === 'DELETED',
        paymentStatus,
        paidAmount,
        refundedAmount,
        returnedMerchandise,
      },
      rule: { version: 'snapshot', kind: 'FIXED', rateBps: null, fixedAmount: 1, cap: null },
    });
    return {
      orderType: order.type,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      walletApplied: Number(order.walletApplied || 0),
      shippingFee: Number(order.shippingFee),
      taxAmount: 0,
      cancelled: order.status === 'CANCELLED' || order.status === 'DELETED',
      paymentStatus,
      paidAmount,
      refundedAmount,
      returnedMerchandise,
      netMerchandise: net.net,
    };
  }

  private async audit(actorUserId: string | null, action: string, entityType: string, entityId: string, payload: Record<string, unknown>) {
    await this.audits.save(this.audits.create({ actorUserId, action, entityType, entityId, payload }));
  }
}

export { DEFAULT_WHOLESALE_REFERRAL_SETTINGS };
