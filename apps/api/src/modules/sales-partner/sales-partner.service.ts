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
import { In, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification/notification.service';
import { OutboxService } from '../omnichannel/services/outbox.service';
import { SALES_PARTNER_EVENT, salesPartnerOutboxPayload } from './sales-partner-events';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AppSettingEntity } from '../settings/entities/app-setting.entity';
import { UserEntity } from '../auth/entities/user.entity';
import { OtpService } from '../redis/redis.module';
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
  resolveSalesPartnerSettings,
  SALES_PARTNER_SETTINGS_KEY,
  type SalesPartnerSettings,
} from './sales-partner-settings';
import {
  canSalesPartnerLogin,
  canTransitionProfile,
  isOpenApplicationStatus,
  parseDisplayName,
  parseReviewReason,
  SALES_PARTNER_ACTING_ROLE,
  SALES_PARTNER_PURPOSE,
  toPublicSalesPartner,
} from './sales-partner-policy';
import { isVendorRole as vendorRole } from '../vendor/vendor-policy';
import { ibanRecord, resolveIbanSecret } from './sales-partner-iban';
import { normalizeIban } from './sales-partner-policy';

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
    };
  }

  async apply(input: {
    displayName: string;
    phone: string;
    instagram?: string;
    telegram?: string;
    acceptTerms: boolean;
  }) {
    const settings = await this.settings();
    if (!programAllowsApply(settings)) {
      throw new ForbiddenException('ثبت‌نام همکاری در حال حاضر باز نیست');
    }
    if (!input.acceptTerms) {
      throw new BadRequestException('پذیرش شرایط همکاری لازم است');
    }
    const phone = normalizePhone(input.phone);
    const displayName = parseDisplayName(input.displayName);
    const user = await this.users.findOne({ where: { phone } });
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
        socialHandles: {
          ...(input.instagram ? { instagram: String(input.instagram).slice(0, 80) } : {}),
          ...(input.telegram ? { telegram: String(input.telegram).slice(0, 80) } : {}),
        },
        userId: user?.id ?? null,
      });
    } else {
      application.displayName = displayName;
    }
    await this.applications.save(application);
    const issued = await this.issueOtp(phone, displayName, 'sales_partner_apply');
    await this.audit(null, 'application.otp_requested', 'application', application.id, { phoneMasked: phone.slice(0, 4) });
    return {
      applicationId: application.id,
      status: application.status,
      cooldownSeconds: 60,
      ...(allowDevOtpExpose(String(this.config.get('NODE_ENV') || ''), String(this.config.get('DEV_OTP_EXPOSE') || '')) ? { devCode: issued.code } : {}),
    };
  }

  async verifyApplication(input: { phone: string; code: string }) {
    const phone = normalizePhone(input.phone);
    await this.verifyOtp(phone, input.code, 'sales_partner_apply');
    const application = await this.applications.findOne({
      where: { phone, status: In(['PENDING_OTP', 'PENDING_REVIEW', 'NEEDS_INFORMATION']) },
    });
    if (!application) throw new NotFoundException('درخواستی برای این شماره پیدا نشد');
    let user = await this.users.findOne({ where: { phone } });
    if (!user) {
      user = this.users.create({
        phone,
        passwordHash: await bcrypt.hash(randomBytes(16).toString('hex'), 12),
        role: 'CUSTOMER',
        isActive: true,
      });
      await this.users.save(user);
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
      });
      await this.profiles.save(profile);
    } else if (profile.status === 'REJECTED') {
      profile.status = 'PENDING_REVIEW';
      profile.displayName = application.displayName;
      profile.statusReason = null;
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
      cooldownSeconds: 60,
      ...(allowDevOtpExpose(String(this.config.get('NODE_ENV') || ''), String(this.config.get('DEV_OTP_EXPOSE') || '')) ? { devCode: issued.code } : {}),
    };
  }

  async verifyLoginOtp(phoneRaw: string, code: string) {
    const phone = normalizePhone(phoneRaw);
    await this.verifyOtp(phone, code, 'sales_partner');
    return this.issuePartnerSession(phone);
  }

  async loginWithPassword(phoneRaw: string, password: string) {
    const phone = normalizePhone(phoneRaw);
    const user = await this.users.findOne({ where: { phone } });
    if (!user) throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');
    return this.issuePartnerSession(phone);
  }

  async me(salesPartnerId: string) {
    const profile = await this.profiles.findOne({ where: { id: salesPartnerId } });
    if (!profile) throw new NotFoundException();
    return toPublicSalesPartner(profile);
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
    return rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      phoneMasked: `${row.phone.slice(0, 4)}***${row.phone.slice(-2)}`,
      status: row.status,
      socialHandles: row.socialHandles,
      createdAt: row.createdAt,
    }));
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
    return rows.map((row) => toPublicSalesPartner(row));
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
    return {
      applications: {
        total: applications.length,
        byStatus: countBy(applications),
      },
      partners: {
        total: profiles.length,
        byStatus: countBy(profiles),
      },
      note: 'اعداد تخمینی، قطعی و پرداخت‌شده را با هم مخلوط نکنید. جزئیات مالی در دفتر هر همکار است.',
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
    user.lastLoginAt = new Date();
    await this.users.save(user);
    return {
      accessToken: this.jwt.sign({
        sub: user.id,
        phone: user.phone,
        role: SALES_PARTNER_ACTING_ROLE,
        customerId: user.customerId ?? undefined,
        purpose: SALES_PARTNER_PURPOSE,
        salesPartnerId: profile.id,
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
      if (err instanceof Error && err.message === 'COOLDOWN') {
        throw new HttpException('لطفاً کمی بعد دوباره تلاش کنید', 429);
      }
      throw err;
    }
    const sent = this.notifications ? await this.notifications.sendOtp(phone, issued.code) : false;
    if (!sent && this.config.get('NODE_ENV') === 'production') {
      await this.otp.clear(phone, purpose);
      throw new HttpException('ارسال پیامک ناموفق بود', 503);
    }
    return issued;
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
