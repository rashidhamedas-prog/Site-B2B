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
    const legacy = {
      minDownPaymentPercent: Number(s.minDownPaymentPercent) || 0,
      minDownPaymentAmount: Number(s.minDownPaymentAmount) || 0,
      maxMonths: Math.max(1, Number(s.maxMonths) || 6),
    };
    const rawRules = Array.isArray(s.rules) ? s.rules : null;
    const rules = (rawRules && rawRules.length
      ? rawRules
      : [{
          id: 'default',
          minDownPaymentPercent: legacy.minDownPaymentPercent,
          maxMonths: legacy.maxMonths,
          categoryId: null as string | null,
        }]
    ).map((r: any, i: number) => ({
      id: String(r?.id ?? `rule_${i + 1}`),
      minDownPaymentPercent: Number(r?.minDownPaymentPercent) || 0,
      maxMonths: Math.max(1, Number(r?.maxMonths) || legacy.maxMonths || 6),
      categoryId: r?.categoryId ? String(r.categoryId) : null,
    }));
    return {
      ...legacy,
      minDownPaymentPercent: rules[0]?.minDownPaymentPercent ?? legacy.minDownPaymentPercent,
      maxMonths: Math.max(...rules.map((r) => r.maxMonths), legacy.maxMonths),
      rules,
      minActiveInvoices: 2,
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

  async theme() {
    const s = await this.get('theme');
    const blur = Number(s.glassBlurPx);
    const delay = Number(s.popups?.boutique?.delaySeconds ?? s.boutiqueDelaySeconds);
    const newsDelay = Number(s.popups?.newsletter?.delaySeconds ?? s.newsletterDelaySeconds);

    const boutique = {
      enabled: s.popups?.boutique?.enabled ?? s.boutiqueEnabled ?? false,
      trigger: (s.popups?.boutique?.trigger ?? s.boutiqueTrigger ?? 'delay') as 'delay' | 'exit',
      delaySeconds: Number.isFinite(delay) && delay > 0 ? delay : 5,
      title: s.popups?.boutique?.title ?? 'همکاری با تولیدی ترنم',
      body:
        s.popups?.boutique?.body ??
        'اگر صاحب بوتیک هستید، مشخصات تماس را بگذارید تا تیم فروش عمده با شما هماهنگ کند.',
      ctaLabel: s.popups?.boutique?.ctaLabel ?? 'ثبت‌نام عمده‌فروش',
      ctaUrl: s.popups?.boutique?.ctaUrl ?? '/portal/register',
    };

    const newsletter = {
      enabled: s.popups?.newsletter?.enabled ?? s.newsletterEnabled ?? false,
      trigger: (s.popups?.newsletter?.trigger ?? s.newsletterTrigger ?? 'delay') as 'delay' | 'exit',
      delaySeconds: Number.isFinite(newsDelay) && newsDelay > 0 ? newsDelay : 12,
      title: s.popups?.newsletter?.title ?? 'خبر کلکسیون‌های جدید',
      body:
        s.popups?.newsletter?.body ??
        'از مدل‌های لینن و شومیزی جدید ترنم زودتر از بقیه باخبر شوید.',
      ctaLabel: s.popups?.newsletter?.ctaLabel ?? 'عضویت در خبرنامه',
      ctaUrl: s.popups?.newsletter?.ctaUrl ?? '/contact',
    };

    return {
      primaryColor: s.primaryColor ?? '#1B5C4A',
      secondaryColor: s.secondaryColor ?? '#C9A84C',
      displayMode: (s.displayMode ?? 'light') as 'light' | 'dark' | 'customImage',
      backgroundImageUrl: s.backgroundImageUrl ?? '',
      glassBlurPx: Number.isFinite(blur) && blur >= 0 && blur <= 40 ? blur : 12,
      popups: { boutique, newsletter },
    };
  }

  async menus() {
    const s = await this.get('menus');
    const normalize = (items: any[] | undefined, fallback: any[]) => {
      const src = Array.isArray(items) && items.length ? items : fallback;
      return src.map((it: any, i: number) => ({
        id: String(it?.id ?? `item_${i + 1}`),
        label: String(it?.label ?? 'لینک'),
        href: String(it?.href ?? '#'),
        highlight: !!it?.highlight,
        imageUrl: it?.imageUrl ? String(it.imageUrl) : '',
        description: it?.description ? String(it.description) : '',
        children: Array.isArray(it?.children)
          ? it.children.map((c: any, j: number) => ({
              id: String(c?.id ?? `child_${i}_${j}`),
              label: String(c?.label ?? 'زیرمنو'),
              href: String(c?.href ?? '#'),
              imageUrl: c?.imageUrl ? String(c.imageUrl) : '',
              description: c?.description ? String(c.description) : '',
            }))
          : [],
      }));
    };

    const defaultMain = [
      {
        id: 'products',
        label: 'محصولات',
        href: '/products',
        highlight: false,
        imageUrl: '',
        description: '',
        children: [
          { id: 'cat-blouse', label: 'شومیزی', href: '/products?fabric=لینن', imageUrl: '', description: 'شومیزی عمده' },
          { id: 'cat-manteau', label: 'مانتو', href: '/products', imageUrl: '', description: 'مانتو عمده' },
          { id: 'cat-set', label: 'ست', href: '/products', imageUrl: '', description: 'ست دو و سه تکه' },
        ],
      },
      { id: 'about', label: 'درباره ترنم', href: '/about', highlight: false, imageUrl: '', description: '', children: [] },
      { id: 'wholesale', label: 'شرایط عمده', href: '/wholesale', highlight: false, imageUrl: '', description: '', children: [] },
      { id: 'blog', label: 'وبلاگ', href: '/blog', highlight: false, imageUrl: '', description: '', children: [] },
      { id: 'contact', label: 'تماس با ما', href: '/contact', highlight: false, imageUrl: '', description: '', children: [] },
      {
        id: 'linen',
        label: 'کلکسیون لینن ترنم',
        href: '/linen-collection',
        highlight: true,
        imageUrl: '',
        description: '',
        children: [],
      },
    ];

    const defaultFooter = [
      { id: 'f-products', label: 'محصولات', href: '/products', highlight: false, imageUrl: '', description: '', children: [] },
      { id: 'f-wholesale', label: 'شرایط عمده‌فروشی', href: '/wholesale', highlight: false, imageUrl: '', description: '', children: [] },
      { id: 'f-about', label: 'درباره ما', href: '/about', highlight: false, imageUrl: '', description: '', children: [] },
      { id: 'f-blog', label: 'وبلاگ', href: '/blog', highlight: false, imageUrl: '', description: '', children: [] },
      { id: 'f-contact', label: 'تماس با ما', href: '/contact', highlight: false, imageUrl: '', description: '', children: [] },
    ];

    const defaultLegal = [
      { id: 'l-privacy', label: 'حریم خصوصی', href: '/privacy', highlight: false, imageUrl: '', description: '', children: [] },
      { id: 'l-terms', label: 'شرایط و قوانین', href: '/terms', highlight: false, imageUrl: '', description: '', children: [] },
      { id: 'l-returns', label: 'شرایط مرجوعی', href: '/returns', highlight: false, imageUrl: '', description: '', children: [] },
      { id: 'l-shipping', label: 'شرایط ارسال', href: '/shipping', highlight: false, imageUrl: '', description: '', children: [] },
    ];

    return {
      megaEnabled: s.megaEnabled !== false,
      main: normalize(s.main, defaultMain),
      footer: normalize(s.footer, defaultFooter),
      mobile: normalize(s.mobile, defaultMain),
      legal: normalize(s.legal, defaultLegal),
    };
  }
}
