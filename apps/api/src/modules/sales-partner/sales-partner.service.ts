import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification/notification.service';
import { OutboxService } from '../omnichannel/services/outbox.service';
import { SALES_PARTNER_EVENT, salesPartnerOutboxPayload } from './sales-partner-events';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { AppSettingEntity } from '../settings/entities/app-setting.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { OtpCooldownError, OtpService } from '../redis/redis.module';
import { SmsCooldownException } from '../notification/sms-cooldown-http';
import { otpDispatchFromTransport } from '../notification/sms-transport';
import { allowDevOtpExpose, normalizePhone } from '../auth/phone.util';
import { isStaffRole } from '../auth/staff-access';
import {
  SalesPartnerApplicationEntity,
  SalesPartnerAuditEventEntity,
  SalesPartnerProfileEntity,
} from './entities';
import {
  DEFAULT_SALES_PARTNER_SETTINGS,
  programAllowsApply,
  programAllowsPartnerAction,
  publicApplyFormFields,
  resolveSalesPartnerSettings,
  SALES_PARTNER_SETTINGS_KEY,
  type SalesPartnerSettings,
} from './sales-partner-settings';
import {
  answersForAdminView,
  maskNationalId,
  validateApplyAnswers,
} from './sales-partner-apply-form';
import { normalizeSalesPartnerCode, salesPartnerPublicCode } from './sales-partner-attribution';
import {
  canSalesPartnerLogin,
  canTransitionProfile,
  normalizeIban,
  parseReviewReason,
  SALES_PARTNER_ACTING_ROLE,
  SALES_PARTNER_PURPOSE,
  toPublicSalesPartner,
} from './sales-partner-policy';
import { isVendorRole as vendorRole } from '../vendor/vendor-policy';
import { ibanRecord, requireDedicatedIbanKey, resolveIbanSecret } from './sales-partner-iban';
import { humanRiskFlags } from './sales-partner-risk-policy';
import { validateNewPassword } from '../auth/password-policy';
import { smsFailureBlocksSend } from './sales-partner-draft-policy';
import {
  generateValidSalesPartnerTempPassword,
  salesPartnerLoginUrl,
  welcomeSmsCooldownActive,
  WELCOME_SMS_COOLDOWN_MS,
} from './sales-partner-welcome-sms';

@Injectable()
export class SalesPartnerService {
  constructor(
    @InjectRepository(SalesPartnerProfileEntity)
    private readonly profiles: Repository<SalesPartnerProfileEntity>,
    @InjectRepository(SalesPartnerApplicationEntity)
    private readonly applications: Repository<SalesPartnerApplicationEntity>,
    @InjectRepository(SalesPartnerAuditEventEntity)
    private readonly audits: Repository<SalesPartnerAuditEventEntity>,
    @InjectRepository(AppSettingEntity)
    private readonly settingsRepo: Repository<AppSettingEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly otp: OtpService,
    @Optional() private readonly notifications?: NotificationService,
    @Optional() private readonly outbox?: OutboxService,
  ) {}

  async settings(): Promise<SalesPartnerSettings> {
    const row = await this.settingsRepo.findOne({ where: { key: SALES_PARTNER_SETTINGS_KEY } });
    return resolveSalesPartnerSettings(row?.value ?? DEFAULT_SALES_PARTNER_SETTINGS);
  }

  async adminSettings() {
    return this.settings();
  }

  async updateSettings(actorUserId: string, patch: Record<string, unknown>) {
    const current = await this.settings();
    const next = resolveSalesPartnerSettings({ ...current, ...patch });
    let row = await this.settingsRepo.findOne({ where: { key: SALES_PARTNER_SETTINGS_KEY } });
    if (!row) {
      row = this.settingsRepo.create({ key: SALES_PARTNER_SETTINGS_KEY, value: next });
    } else {
      row.value = next;
    }
    await this.settingsRepo.save(row);
    await this.audit(actorUserId, 'settings.updated', 'settings', SALES_PARTNER_SETTINGS_KEY, {
      mode: next.mode,
      enabled: next.enabled,
      applyOpen: next.applyOpen,
    });
    return next;
  }

  async publicSettings() {
    const s = await this.settings();
    return {
      enabled: s.enabled,
      applyOpen: programAllowsApply(s),
      termsVersion: s.termsVersion,
      termsFinal: s.termsVersion !== 'draft-unreviewed',
      applyFormFields: publicApplyFormFields(s.applyFormFields),
    };
  }

  async apply(input: Record<string, unknown> | object) {
    const settings = await this.settings();
    if (!programAllowsApply(settings)) {
      throw new ForbiddenException('ثبت‌نام همکاری در حال حاضر باز نیست');
    }
    const inputObj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const nestedAnswers =
      inputObj.answers && typeof inputObj.answers === 'object'
        ? (inputObj.answers as Record<string, unknown>)
        : {};
    const flat: Record<string, unknown> = { ...nestedAnswers, ...inputObj };
    delete flat.answers;
    const validated = validateApplyAnswers(settings.applyFormFields, flat);
    if (validated.ok === false) {
      throw new BadRequestException(validated.error);
    }
    const { displayName, phone, socialHandles, answers } = validated.data;
    const user = await this.users.findOne({ where: { phone }, withDeleted: true });
    if (user && (isStaffRole(user.role) || vendorRole(user.role))) {
      throw new ConflictException('این شماره برای همکاری بازاریاب قابل استفاده نیست');
    }
    const existingProfile = await this.profiles.findOne({ where: { phone } });
    if (existingProfile && ['ACTIVE', 'SUSPENDED', 'PENDING_REVIEW', 'NEEDS_INFORMATION'].includes(existingProfile.status)) {
      throw new ConflictException('برای این شماره درخواست یا حساب همکاری وجود دارد');
    }
    let application = await this.applications.findOne({
      where: { phone, status: In(['PENDING_OTP', 'PENDING_REVIEW', 'NEEDS_INFORMATION']) },
    });
    if (!application) {
      application = this.applications.create({
        phone,
        displayName,
        status: 'PENDING_OTP',
        socialHandles: Object.keys(socialHandles).length ? socialHandles : null,
        answers,
        userId: user?.id ?? null,
      });
      await this.applications.save(application);
    }
    const issued = await this.issueOtp(phone, displayName, 'sales_partner_apply');
    await this.audit(null, 'application.otp_requested', 'application', application.id, { phoneMasked: phone.slice(0, 4) });
    return {
      applicationId: application.id,
      status: application.status,
      cooldownSeconds: this.otp.cooldownSeconds('sales_partner_apply'),
      expiresInSeconds: issued.expiresInSeconds,
      delivery: issued.delivery,
      ...(allowDevOtpExpose(String(this.config.get('NODE_ENV') || ''), String(this.config.get('DEV_OTP_EXPOSE') || '')) &&
      issued.delivery !== 'sent'
        ? { devCode: issued.code }
        : {}),
    };
  }

  async verifyApplication(input: { phone: string; code: string }) {
    const phone = normalizePhone(input.phone);
    await this.verifyOtp(phone, input.code, 'sales_partner_apply');
    const application = await this.applications.findOne({
      where: { phone, status: In(['PENDING_OTP', 'PENDING_REVIEW', 'NEEDS_INFORMATION']) },
    });
    if (!application) throw new NotFoundException('درخواستی برای این شماره پیدا نشد');
    // Soft-deleted users still occupy users.phone UNIQUE — must restore, not re-insert (500 otherwise).
    let user = await this.users.findOne({ where: { phone }, withDeleted: true });
    if (!user) {
      user = this.users.create({
        phone,
        passwordHash: await bcrypt.hash(randomBytes(16).toString('hex'), 12),
        role: 'CUSTOMER',
        isActive: true,
      });
      await this.users.save(user);
    } else if (user.deletedAt || !user.isActive) {
      throw new ConflictException('این شماره برای ثبت‌نام همکاری در دسترس نیست');
    }
    if (isStaffRole(user.role) || vendorRole(user.role)) {
      throw new ConflictException('این شماره برای همکاری بازاریاب قابل استفاده نیست');
    }
    application.userId = user.id;
    application.status = 'PENDING_REVIEW';
    await this.applications.save(application);

    let profile = await this.profiles.findOne({ where: { userId: user.id } });
    if (!profile) {
      profile = this.profiles.create({
        userId: user.id,
        phone,
        displayName: application.displayName,
        status: 'PENDING_REVIEW',
        publicCode: salesPartnerPublicCode(randomBytes(8)),
        applicationAnswers: application.answers,
      });
      await this.profiles.save(profile);
    } else if (profile.status === 'REJECTED') {
      profile.status = 'PENDING_REVIEW';
      profile.displayName = application.displayName;
      profile.statusReason = null;
      profile.applicationAnswers = application.answers;
      await this.profiles.save(profile);
    } else {
      profile.applicationAnswers = application.answers ?? profile.applicationAnswers;
      await this.profiles.save(profile);
    }
    application.profileId = profile.id;
    await this.applications.save(application);
    await this.audit(user.id, 'application.submitted', 'application', application.id, { status: 'PENDING_REVIEW' });
    await this.emit(SALES_PARTNER_EVENT.APPLICATION_SUBMITTED, application.id, {
      applicationId: application.id,
      profileId: profile.id,
      status: 'PENDING_REVIEW',
    });
    return {
      applicationId: application.id,
      status: 'PENDING_REVIEW',
      statusLabel: 'درخواست ثبت شد و در انتظار بررسی است',
    };
  }

  async requestLoginOtp(phoneRaw: string) {
    const phone = normalizePhone(phoneRaw);
    const profile = await this.profiles.findOne({ where: { phone } });
    if (!profile || !canSalesPartnerLogin(profile.status)) {
      throw new UnauthorizedException('حساب همکار بازاریاب فعال نیست');
    }
    const settings = await this.settings();
    if (!programAllowsPartnerAction(settings, phone)) {
      throw new ForbiddenException('برنامه همکاری فعلاً فعال نیست');
    }
    const issued = await this.issueOtp(phone, profile.displayName, 'sales_partner');
    return {
      cooldownSeconds: this.otp.cooldownSeconds('sales_partner'),
      expiresInSeconds: issued.expiresInSeconds,
      delivery: issued.delivery,
      message:
        issued.delivery === 'pending'
          ? 'ارسال پیامک کمی طول کشید. اگر کد رسید همان را وارد کنید.'
          : 'کد تأیید ارسال شد',
      ...(allowDevOtpExpose(String(this.config.get('NODE_ENV') || ''), String(this.config.get('DEV_OTP_EXPOSE') || '')) &&
      issued.delivery !== 'sent'
        ? { devCode: issued.code }
        : {}),
    };
  }

  async verifyLoginOtp(phoneRaw: string, code: string) {
    const phone = normalizePhone(phoneRaw);
    await this.verifyOtp(phone, code, 'sales_partner');
    const session = await this.issuePartnerSession(phone);
    const user = await this.users.findOne({ where: { phone } });
    if (user) await this.otp.markSessionGrant(user.id, session.sid, 'sales_partner_password');
    return session;
  }

  async loginWithPassword(phoneRaw: string, password: string) {
    const phone = normalizePhone(phoneRaw);
    const user = await this.users.findOne({ where: { phone } });
    if (!user) throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');
    return this.issuePartnerSession(phone);
  }

  async me(salesPartnerId: string, sessionId?: string) {
    const profile = await this.profiles.findOne({ where: { id: salesPartnerId } });
    if (!profile) throw new NotFoundException();
    const canSetWithoutCurrent = Boolean(
      sessionId && await this.otp.hasSessionGrant(profile.userId, sessionId, 'sales_partner_password'),
    );
    return {
      ...toPublicSalesPartner(profile),
      canSetPasswordWithoutCurrent: canSetWithoutCurrent,
      applicationAnswers: profile.applicationAnswers,
    };
  }

  async setOrChangePassword(
    salesPartnerId: string,
    password: string,
    currentPassword?: string,
    sessionId?: string,
  ) {
    const profile = await this.profiles.findOne({ where: { id: salesPartnerId } });
    if (!profile) throw new NotFoundException();
    if (!canSalesPartnerLogin(profile.status)) {
      throw new ForbiddenException('حساب همکار بازاریاب فعال نیست');
    }
    const user = await this.users.findOne({ where: { id: profile.userId } });
    if (!user) throw new NotFoundException();
    const policyError = validateNewPassword(password, user.phone);
    if (policyError) throw new BadRequestException(policyError);

    if (currentPassword) {
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) throw new BadRequestException('رمز عبور فعلی اشتباه است');
    } else {
      const granted = Boolean(
        sessionId && await this.otp.consumeSessionGrant(user.id, sessionId, 'sales_partner_password'),
      );
      if (!granted) {
        throw new BadRequestException(
          'برای تعریف رمز بدون رمز فعلی، با پیامک وارد شوید یا رمز فعلی را وارد کنید',
        );
      }
    }

    const same = await bcrypt.compare(password, user.passwordHash);
    if (same) throw new BadRequestException('رمز جدید باید با رمز فعلی متفاوت باشد');

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordChangedAt = new Date();
    await this.users.save(user);
    await this.audit(user.id, 'profile.password_updated', 'profile', profile.id, {});
    return {
      message: currentPassword ? 'رمز عبور تغییر کرد' : 'رمز عبور ذخیره شد',
      ...(await this.issuePartnerSession(profile.phone)),
    };
  }

  async updateIban(salesPartnerId: string, ibanRaw: string) {
    const profile = await this.profiles.findOne({ where: { id: salesPartnerId } });
    if (!profile) throw new NotFoundException();
    let iban: string;
    try {
      iban = normalizeIban(ibanRaw);
    } catch {
      throw new BadRequestException('شماره شبا معتبر نیست');
    }
    let secret: string;
    try {
      requireDedicatedIbanKey(this.config.get('NODE_ENV') || this.config.get('APP_ENV'), this.config.get('SALES_PARTNER_IBAN_KEY'));
      secret = resolveIbanSecret(this.config.get('JWT_SECRET'), this.config.get('SALES_PARTNER_IBAN_KEY'));
    } catch {
      throw new BadRequestException('ذخیره شبا فعلاً ممکن نیست');
    }
    const record = ibanRecord(iban, secret);
    profile.ibanLast4 = record.ibanLast4;
    profile.ibanFingerprint = record.ibanFingerprint;
    profile.ibanCipher = record.ibanCipher;
    await this.profiles.save(profile);
    await this.audit(profile.userId, 'profile.iban_updated', 'profile', profile.id, { ibanLast4: record.ibanLast4 });
    return toPublicSalesPartner(profile);
  }

  async listApplications(status?: string) {
    const where = status ? { status } : {};
    const rows = await this.applications.find({ where, order: { createdAt: 'DESC' }, take: 100 });
    const profileIds = [
      ...new Set(rows.map((row) => row.profileId).filter((id): id is string => Boolean(id))),
    ];
    const welcomeByProfile = new Map<string, { sentAt: Date; sent: boolean }>();
    if (profileIds.length > 0) {
      const welcomeAudits = await this.audits.find({
        where: {
          action: 'credentials.welcome_sms_sent',
          targetType: 'profile',
          targetId: In(profileIds),
        },
        order: { createdAt: 'DESC' },
        take: 500,
      });
      for (const audit of welcomeAudits) {
        if (welcomeByProfile.has(audit.targetId)) continue;
        const sentFlag = audit.payload?.sent;
        welcomeByProfile.set(audit.targetId, {
          sentAt: audit.createdAt,
          // Older rows without payload.sent still mean an admin send was recorded.
          sent: sentFlag === false ? false : true,
        });
      }
    }
    return rows.map((row) => {
      const nationalId =
        row.answers && typeof row.answers.nationalId === 'string' ? row.answers.nationalId : null;
      const welcome = row.profileId ? welcomeByProfile.get(row.profileId) : undefined;
      return {
        id: row.id,
        displayName: row.displayName,
        phoneMasked: `${row.phone.slice(0, 4)}***${row.phone.slice(-2)}`,
        status: row.status,
        socialHandles: row.socialHandles,
        nationalIdMasked: maskNationalId(nationalId),
        city: typeof row.answers?.city === 'string' ? row.answers.city : null,
        province: typeof row.answers?.province === 'string' ? row.answers.province : null,
        primaryChannel:
          typeof row.answers?.primaryChannel === 'string' ? row.answers.primaryChannel : null,
        createdAt: row.createdAt,
        welcomeSmsSent: Boolean(welcome?.sent),
        welcomeSmsLastSentAt: welcome?.sent ? welcome.sentAt.toISOString() : null,
      };
    });
  }

  async getApplication(applicationId: string) {
    const application = await this.applications.findOne({ where: { id: applicationId } });
    if (!application) throw new NotFoundException('درخواست پیدا نشد');
    const settings = await this.settings();
    return {
      id: application.id,
      displayName: application.displayName,
      phone: application.phone,
      phoneMasked: `${application.phone.slice(0, 4)}***${application.phone.slice(-2)}`,
      status: application.status,
      socialHandles: application.socialHandles,
      answers: application.answers,
      answerRows: answersForAdminView(application.answers, settings.applyFormFields),
      reviewNote: application.reviewNote,
      profileId: application.profileId,
      userId: application.userId,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }

  async reviewApplication(
    applicationId: string,
    actorUserId: string,
    action: 'APPROVE' | 'NEED_INFO' | 'REJECT',
    reason?: string,
  ) {
    const application = await this.applications.findOne({ where: { id: applicationId } });
    if (!application?.profileId) throw new NotFoundException('درخواست پیدا نشد');
    const profile = await this.profiles.findOne({ where: { id: application.profileId } });
    if (!profile) throw new NotFoundException('حساب همکاری پیدا نشد');
    const next = action === 'APPROVE' ? 'ACTIVE' : action === 'NEED_INFO' ? 'NEEDS_INFORMATION' : 'REJECTED';
    if (!canTransitionProfile(profile.status, next) && !(profile.status === 'NEEDS_INFORMATION' && next === 'ACTIVE')) {
      if (profile.status === 'NEEDS_INFORMATION' && next === 'ACTIVE') {
        profile.status = 'PENDING_REVIEW';
      } else {
        throw new BadRequestException('این تغییر وضعیت مجاز نیست');
      }
    }
    if (action !== 'APPROVE') profile.statusReason = parseReviewReason(reason);
    else profile.statusReason = null;
    if (action === 'APPROVE') {
      const settings = await this.settings();
      profile.termsVersion = settings.termsVersion;
      profile.termsAcceptedAt = profile.termsAcceptedAt ?? new Date();
      profile.applicationAnswers = application.answers ?? profile.applicationAnswers;
    }
    profile.status = next;
    application.status = action === 'APPROVE' ? 'APPROVED' : action === 'NEED_INFO' ? 'NEEDS_INFORMATION' : 'REJECTED';
    application.reviewNote = profile.statusReason;
    await this.profiles.save(profile);
    await this.applications.save(application);
    if (action !== 'APPROVE') {
      const user = await this.users.findOne({ where: { id: profile.userId } });
      if (user) {
        user.passwordChangedAt = new Date();
        await this.users.save(user);
      }
    }
    await this.audit(actorUserId, `application.${action.toLowerCase()}`, 'profile', profile.id, {
      status: next,
    });
    await this.emit(SALES_PARTNER_EVENT.PROFILE_STATUS_CHANGED, profile.id, {
      profileId: profile.id,
      status: next,
      action,
    });
    return toPublicSalesPartner(profile);
  }

  /**
   * Admin action: regenerate password + send welcome SMS (phone = username).
   * Never returns plaintext password. Rolls back hash if production SMS fails.
   */
  async sendWelcomeCredentialsSms(applicationId: string, actorUserId: string) {
    const application = await this.applications.findOne({ where: { id: applicationId } });
    if (!application?.profileId) throw new NotFoundException('درخواست پیدا نشد');
    if (application.status !== 'APPROVED') {
      throw new BadRequestException('پیامک خوش‌آمد فقط برای درخواست تأییدشده مجاز است');
    }
    const profile = await this.profiles.findOne({ where: { id: application.profileId } });
    if (!profile) throw new NotFoundException('حساب همکاری پیدا نشد');
    if (!canSalesPartnerLogin(profile.status)) {
      throw new BadRequestException('حساب همکار بازاریاب فعال نیست');
    }

    const since = new Date(Date.now() - WELCOME_SMS_COOLDOWN_MS);
    const recent = await this.audits.find({
      where: {
        action: 'credentials.welcome_sms_sent',
        targetId: profile.id,
        createdAt: MoreThan(since),
      },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    if (welcomeSmsCooldownActive(recent[0]?.createdAt)) {
      throw new BadRequestException(
        'پیامک ورود اخیراً ارسال شده است؛ حدود ۱۵ دقیقه دیگر دوباره تلاش کنید',
      );
    }

    const loginUrl = salesPartnerLoginUrl(this.config.get('NEXT_PUBLIC_RETAIL_URL'));
    const displayName = application.displayName || profile.displayName || undefined;

    return this.users.manager.transaction(async (manager) => {
      const user = await manager.findOne(UserEntity, {
        where: { id: profile.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('کاربر پیدا نشد');

      const phone = user.phone || application.phone;
      const password = generateValidSalesPartnerTempPassword(phone);
      const policyError = validateNewPassword(password, phone);
      if (policyError) throw new BadRequestException(policyError);

      const previousHash = user.passwordHash;
      const previousChangedAt = user.passwordChangedAt;
      user.passwordHash = await bcrypt.hash(password, 12);
      user.passwordChangedAt = new Date();
      await manager.save(user);

      const sent = this.notifications
        ? await this.notifications.salesPartnerWelcome({
            phone,
            password,
            loginUrl,
            displayName,
          })
        : false;

      if (smsFailureBlocksSend(this.config.get('NODE_ENV'), sent)) {
        user.passwordHash = previousHash;
        user.passwordChangedAt = previousChangedAt;
        await manager.save(user);
        throw new BadRequestException('ارسال پیامک ناموفق بود؛ دوباره تلاش کنید');
      }

      await manager.save(
        manager.create(SalesPartnerAuditEventEntity, {
          actorUserId,
          action: 'credentials.welcome_sms_sent',
          targetType: 'profile',
          targetId: profile.id,
          payload: {
            applicationId: application.id,
            phoneMasked: `${phone.slice(0, 4)}***${phone.slice(-2)}`,
            sent: Boolean(sent),
          },
        }),
      );

      return {
        sent: Boolean(sent),
        phoneMasked: `${phone.slice(0, 4)}***${phone.slice(-2)}`,
        message: sent
          ? 'پیامک خوش‌آمد و اطلاعات ورود ارسال شد'
          : 'رمز به‌روز شد؛ در این محیط پیامک ارسال نشد (SMS خاموش است)',
      };
    });
  }

  async patchProfileStatus(
    profileId: string,
    actorUserId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED',
    reason?: string,
  ) {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException();
    if (!canTransitionProfile(profile.status, status)) {
      throw new BadRequestException('این تغییر وضعیت مجاز نیست');
    }
    profile.status = status;
    profile.statusReason = status === 'ACTIVE' ? null : parseReviewReason(reason);
    if (status === 'CLOSED') profile.closedAt = new Date();
    await this.profiles.save(profile);
    const user = await this.users.findOne({ where: { id: profile.userId } });
    if (user && status !== 'ACTIVE') {
      user.passwordChangedAt = new Date();
      await this.users.save(user);
    }
    await this.audit(actorUserId, 'profile.status_changed', 'profile', profile.id, { status });
    await this.emit(SALES_PARTNER_EVENT.PROFILE_STATUS_CHANGED, profile.id, {
      profileId: profile.id,
      status,
    });
    return toPublicSalesPartner(profile);
  }

  async listPartners() {
    const rows = await this.profiles.find({ order: { createdAt: 'DESC' }, take: 100 });
    return rows.map((row) => ({
      ...toPublicSalesPartner(row),
      riskFlags: humanRiskFlags(row.riskFlags),
    }));
  }

  async listAudits(targetType?: string) {
    const rows = await this.audits.find({
      where: targetType ? { targetType } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      payload: salesPartnerOutboxPayload(row.payload || {}),
      createdAt: row.createdAt,
    }));
  }

  async programReport() {
    const [applications, profiles] = await Promise.all([
      this.applications.find({ take: 500, order: { createdAt: 'DESC' } }),
      this.profiles.find({ take: 500 }),
    ]);
    const countBy = (rows: { status: string }[]) =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {});
    const appByStatus = countBy(applications);
    const partnerByStatus = countBy(profiles);
    return {
      applications: {
        total: applications.length,
        byStatus: appByStatus,
        pendingReview: appByStatus.PENDING_REVIEW || 0,
      },
      partners: {
        total: profiles.length,
        byStatus: partnerByStatus,
        active: partnerByStatus.ACTIVE || 0,
      },
      note: 'اعداد تخمینی، قطعی و پرداخت‌شده را با هم مخلوط نکنید. جزئیات مالی در دفتر هر همکار است.',
      generatedAt: new Date().toISOString(),
    };
  }

  private async issuePartnerSession(phone: string) {
    const profile = await this.profiles.findOne({ where: { phone } });
    const user = await this.users.findOne({ where: { phone } });
    if (!profile || !user || !user.isActive || !canSalesPartnerLogin(profile.status)) {
      throw new UnauthorizedException('حساب همکار بازاریاب فعال نیست');
    }
    const settings = await this.settings();
    if (!programAllowsPartnerAction(settings, phone)) {
      throw new ForbiddenException('برنامه همکاری فعلاً فعال نیست');
    }
    const sid = randomUUID();
    user.lastLoginAt = new Date();
    await this.users.save(user);
    return {
      sid,
      accessToken: this.jwt.sign({
        sub: user.id,
        phone: user.phone,
        role: SALES_PARTNER_ACTING_ROLE,
        customerId: user.customerId ?? undefined,
        purpose: SALES_PARTNER_PURPOSE,
        salesPartnerId: profile.id,
        sid,
      }),
      role: SALES_PARTNER_ACTING_ROLE,
      purpose: SALES_PARTNER_PURPOSE,
      salesPartnerId: profile.id,
    };
  }

  private async issueOtp(phone: string, name: string, purpose: 'sales_partner' | 'sales_partner_apply') {
    let issued: { code: string };
    try {
      issued = await this.otp.issue(phone, name, purpose);
    } catch (err) {
      if (err instanceof OtpCooldownError) {
        throw new SmsCooldownException(
          err.remainingSeconds,
          this.otp.cooldownSeconds(purpose),
          'لطفاً کمی بعد دوباره تلاش کنید',
        );
      }
      throw err;
    }
    const expiresInSeconds = this.otp.ttlSeconds();
    if (!this.notifications) {
      return { code: issued.code, delivery: 'failed' as const, expiresInSeconds };
    }
    const delivery = otpDispatchFromTransport(await this.notifications.sendOtpDetailed(phone, issued.code));
    if (delivery === 'failed' && this.config.get('NODE_ENV') === 'production') {
      await this.otp.clear(phone, purpose);
      await this.otp.clearCooldown(phone, purpose);
      throw new HttpException('ارسال پیامک ناموفق بود', 503);
    }
    return { code: issued.code, delivery, expiresInSeconds };
  }

  private async verifyOtp(phone: string, code: string, purpose: 'sales_partner' | 'sales_partner_apply') {
    try {
      return await this.otp.verify(phone, code, purpose);
    } catch {
      throw new UnauthorizedException('کد تأیید نادرست است');
    }
  }

  async emitEvent(eventType: string, aggregateId: string, payload: Record<string, unknown>) {
    await this.emit(eventType, aggregateId, payload);
  }

  private async emit(eventType: string, aggregateId: string, payload: Record<string, unknown>) {
    if (!this.outbox) return;
    await this.outbox.enqueue({
      operationId: `${eventType}:${aggregateId}`,
      eventType,
      aggregateType: 'sales_partner',
      aggregateId,
      channel: 'RETAIL',
      payload: salesPartnerOutboxPayload(payload),
    });
  }

  async findActiveByPublicCode(code: string) {
    const normalized = normalizeSalesPartnerCode(code);
    if (!normalized) return null;
    return this.profiles.findOne({ where: { publicCode: normalized, status: 'ACTIVE' } });
  }

  async ensurePublicCode(profileId: string): Promise<string> {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('حساب همکار پیدا نشد');
    if (profile.publicCode) return profile.publicCode;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      profile.publicCode = salesPartnerPublicCode(randomBytes(8));
      try {
        await this.profiles.save(profile);
        return profile.publicCode;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === '23505' && attempt < 4) continue;
        throw err;
      }
    }
    throw new ConflictException('ساخت کد لینک فروش ممکن نشد');
  }

  async recordAudit(
    actorUserId: string | null,
    action: string,
    targetType: string,
    targetId: string,
    payload: Record<string, unknown>,
  ) {
    return this.audit(actorUserId, action, targetType, targetId, payload);
  }

  private async audit(
    actorUserId: string | null,
    action: string,
    targetType: string,
    targetId: string,
    payload: Record<string, unknown>,
  ) {
    await this.audits.save(
      this.audits.create({
        actorUserId,
        action,
        targetType,
        targetId,
        payload,
      }),
    );
  }
}
