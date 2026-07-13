import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AppSettingEntity } from './entities/app-setting.entity';

// Central user-configurable settings, stored in DB and edited from the admin
// panel. Consumers (shipping/sms/payment) read through the typed getters,
// which fall back to env vars and finally to hard defaults, so the platform
// works before the admin ever opens the settings page.
@Injectable()
export class SettingsService {
  // Small in-memory cache so hot paths don't hit the DB on every request.
  private cache = new Map<string, { value: Record<string, any>; at: number }>();
  private static readonly TTL_MS = 30_000;

  constructor(
    @InjectRepository(AppSettingEntity)
    private readonly repo: Repository<AppSettingEntity>,
    private readonly config: ConfigService,
  ) {}

  async get(key: string): Promise<Record<string, any>> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < SettingsService.TTL_MS) return hit.value;
    const row = await this.repo.findOne({ where: { key } });
    const value = row?.value ?? {};
    this.cache.set(key, { value, at: Date.now() });
    return value;
  }

  async set(key: string, value: Record<string, any>): Promise<AppSettingEntity> {
    const saved = await this.repo.save(this.repo.create({ key, value }));
    this.cache.set(key, { value: saved.value, at: Date.now() });
    return saved;
  }

  async getAll(): Promise<Record<string, Record<string, any>>> {
    const rows = await this.repo.find();
    const out: Record<string, Record<string, any>> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  // ── Typed group getters (DB → env → default) ──────────────

  async business() {
    const s = await this.get('business');
    return {
      businessName: s.businessName ?? 'پوشاک ترنم',
      ownerName: s.ownerName ?? 'حامد رشید',
      phone: s.phone ?? '09152424624',
      email: s.email ?? 'info@poshaktaranom.com',
      website: s.website ?? 'poshaktaranom.com',
      instagram: s.instagram ?? 'tolidi.taranom',
      telegram: s.telegram ?? '@toliditaranom',
      address: s.address ?? '',
      officeAddress: s.officeAddress ?? '',
      minOrderToman: Number(s.minOrderToman) || 1000000,
      defaultCreditDays: Number(s.defaultCreditDays) || 30,
    };
  }

  async shipping() {
    const s = await this.get('shipping');
    const defaults = [
      { id: 'CHAPAR', label: 'چاپار', isActive: true, sort: 10 },
      { id: 'TIPAX', label: 'تیپاکس', isActive: true, sort: 20 },
      { id: 'POST', label: 'پست پیشتاز', isActive: true, sort: 30 },
      { id: 'FREIGHT', label: 'باربری', isActive: true, sort: 40 },
      { id: 'OTHER', label: 'سایر', isActive: true, sort: 50 },
    ];

    const rawCompanies = Array.isArray(s.companies) ? s.companies : null;
    const companies = (rawCompanies ?? defaults)
      .map((c: any, i: number) => ({
        id: String(c?.id ?? defaults[i]?.id ?? `SHIP_${i + 1}`),
        label: String(c?.label ?? defaults[i]?.label ?? 'نامشخص'),
        isActive: c?.isActive !== false,
        sort: Number.isFinite(Number(c?.sort)) ? Number(c.sort) : (defaults[i]?.sort ?? (i + 1) * 10),
      }))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    return {
      baseFee: Number(s.baseFee) || Number(this.config.get('SHIPPING_BASE_FEE', 600000)),
      perKgFee: Number(s.perKgFee) || Number(this.config.get('SHIPPING_PER_KG_FEE', 250000)),
      freeThreshold:
        Number(s.freeThreshold) || Number(this.config.get('SHIPPING_FREE_THRESHOLD', 200000000)),
      // Editable shipping companies list (admin-managed). Kept alongside legacy `methods` for backward compat.
      companies,
      // Legacy per-method enable flags; derived from companies (or fall back to stored methods).
      methods: companies.reduce((acc, c) => {
        acc[c.id] = c.isActive !== false;
        return acc;
      }, { ...(s.methods ?? {}) } as Record<string, boolean>),
    };
  }

  async installments() {
    const s = await this.get('installments');
    return {
      minDownPaymentPercent: Number(s.minDownPaymentPercent) || 0,
      minDownPaymentAmount: Number(s.minDownPaymentAmount) || 0,
      maxMonths: Math.max(1, Number(s.maxMonths) || 6),
    };
  }

  async sms() {
    const s = await this.get('sms');
    return {
      enabled: s.enabled ?? true,
      apiKey: s.apiKey || this.config.get('SMSIR_API_KEY', '') || this.config.get('SMS_API_KEY', ''),
      lineNumber: s.lineNumber || this.config.get('SMSIR_LINE_NUMBER', '') || this.config.get('SMS_SENDER', ''),
      otpTemplateId: Number(s.otpTemplateId) || Number(this.config.get('SMSIR_OTP_TEMPLATE_ID', 0)),
      events: {
        orderRegistered: s.events?.orderRegistered ?? true,
        orderConfirmed: s.events?.orderConfirmed ?? true,
        orderShipped: s.events?.orderShipped ?? true,
        paymentReceived: s.events?.paymentReceived ?? true,
      } as Record<string, boolean>,
    };
  }

  async payment() {
    const s = await this.get('payment');
    return {
      enabled: s.enabled ?? true,
      merchantId: s.merchantId || this.config.get('ZARINPAL_MERCHANT_ID', ''),
      sandbox:
        typeof s.sandbox === 'boolean'
          ? s.sandbox
          : this.config.get('ZARINPAL_SANDBOX', 'true') === 'true',
      manualCardNumber: s.manualCardNumber ?? '',
      manualCardOwner: s.manualCardOwner ?? '',
    };
  }
}
