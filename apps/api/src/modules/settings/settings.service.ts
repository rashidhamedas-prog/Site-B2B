import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AppSettingEntity } from './entities/app-setting.entity';
import { resolveSmsTemplates } from '../notification/sms-templates.defaults';

// Central user-configurable settings, stored in DB and edited from the admin
// panel. Consumers (shipping/sms/payment) read through the typed getters,
// which fall back to env vars and finally to hard defaults, so the platform
// works before the admin ever opens the settings page.
@Injectable()
export class SettingsService {
  // Small in-memory cache so hot paths don't hit the DB on every request.
  private cache = new Map<string, { value: Record<string, any>; at: number }>();
  private static readonly TTL_MS = 60_000;

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
    let next = value;
    if (key === 'payment' && value && typeof value === 'object') {
      const prev = await this.get('payment');
      next = { ...value };
      delete next.digipayConfigured;
      for (const secretKey of [
        'digipayClientId',
        'digipayClientSecret',
        'digipayUsername',
        'digipayPassword',
      ]) {
        if (!String(next[secretKey] ?? '').trim()) {
          next[secretKey] = String(prev[secretKey] || '');
        }
      }
    }
    const saved = await this.repo.save(this.repo.create({ key, value: next }));
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

  private enamadSeal(raw: unknown) {
    const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
      enabled: s.enabled === true,
      /** شناسه اینماد (پارامتر id در لینک trustseal) */
      id: String(s.id ?? ''),
      /** کد اینماد (پارامتر Code) */
      code: String(s.code ?? ''),
      /** لینک تأیید — اگر خالی باشد از id+code ساخته می‌شود */
      linkUrl: String(s.linkUrl ?? ''),
      /** تصویر لوگو — آپلود یا خالی برای لوگو رسمی اینماد */
      imageUrl: String(s.imageUrl ?? ''),
      /** HTML کامل از پنل اینماد (اولویت بالاتر از id/code) */
      htmlSnippet: String(s.htmlSnippet ?? ''),
    };
  }

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
      /** Auto «موجودی محدود» when stock ≤ minOrder × this (both channels) */
      limitedStockMultiplier: Math.max(1, Number(s.limitedStockMultiplier) || 2),
      /** Auto «جدید» badge window in days (both channels) */
      newBadgeDays: Math.max(1, Number(s.newBadgeDays) || 7),
      /** نماد اعتماد الکترونیکی — عمده (poshaktaranom.com) */
      enamadWholesale: this.enamadSeal(s.enamadWholesale),
      /** نماد اعتماد الکترونیکی — تکی (www.poshaktaranom.ir) */
      enamadRetail: this.enamadSeal(s.enamadRetail),
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

    const defaultBase = Number(this.config.get('SHIPPING_BASE_FEE', 1500000));
    const defaultPerKg = Number(this.config.get('SHIPPING_PER_KG_FEE', 250000));
    const defaultFree = Number(this.config.get('SHIPPING_FREE_THRESHOLD', 50_000_000));
    const defaultKg = Number(this.config.get('SHIPPING_KG_PER_PIECE', 0.45)) || 0.45;

    // Legacy flat fields = retail defaults when nested retail is missing
    const legacyBase = Number(s.baseFee) || defaultBase;
    const legacyPerKg = Number(s.perKgFee) || defaultPerKg;
    const legacyFree = Number(s.freeThreshold) || defaultFree;
    const legacyKgRaw = Number(s.kgPerPiece);
    const legacyKg =
      Number.isFinite(legacyKgRaw) && legacyKgRaw > 0 ? legacyKgRaw : defaultKg;

    const retailSrc = s.retail && typeof s.retail === 'object' ? s.retail : {};
    const wholesaleSrc = s.wholesale && typeof s.wholesale === 'object' ? s.wholesale : {};

    const retailKgRaw = Number(retailSrc.kgPerPiece);
    const retail = {
      baseFee: Number(retailSrc.baseFee) || legacyBase,
      perKgFee: Number(retailSrc.perKgFee) || legacyPerKg,
      freeThreshold: Number(retailSrc.freeThreshold) || legacyFree,
      kgPerPiece:
        Number.isFinite(retailKgRaw) && retailKgRaw > 0 ? retailKgRaw : legacyKg,
      detailsText: String(
        retailSrc.detailsText ??
          [
            'وزن تقریبی: ceil(تعداد × وزن‌هر‌عدد × ۱۰) / ۱۰ کیلوگرم',
            'هزینه: کارمزد پایه + ceil(وزن) × کارمزد هر کیلو',
            'پیک تهران / اسنپ‌باکس: حداکثر برابر کارمزد پایه. اگر مبلغ فاکتور ≥ آستانه ارسال رایگان → هزینه صفر.',
          ].join('\n'),
      ),
    };

    const wholesale = {
      baseFee: Number(wholesaleSrc.baseFee) || legacyBase,
      freeThreshold: Number(wholesaleSrc.freeThreshold) || legacyFree,
      detailsText: String(
        wholesaleSrc.detailsText ??
          [
            'هزینه ثابت = کارمزد پایه (بدون ضرب وزن)، مگر اینکه مبلغ پس از تخفیف ≥ آستانه ارسال رایگان باشد.',
            'شرکت‌های حمل فعال در checkout نمایش داده می‌شوند.',
          ].join('\n'),
      ),
    };

    return {
      /** @deprecated Prefer retail.* — kept for backward compat (= retail) */
      baseFee: retail.baseFee,
      /** @deprecated Prefer retail.perKgFee */
      perKgFee: retail.perKgFee,
      /** @deprecated Prefer retail.freeThreshold */
      freeThreshold: retail.freeThreshold,
      /** @deprecated Prefer retail.kgPerPiece */
      kgPerPiece: retail.kgPerPiece,
      retail,
      wholesale,
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
      minActiveInvoices: Number(s.minActiveInvoices) || 2,
    };
  }

  async sms() {
    const s = await this.get('sms');
    return {
      enabled: s.enabled ?? true,
      apiKey: s.apiKey || this.config.get('SMSIR_API_KEY', '') || this.config.get('SMS_API_KEY', ''),
      lineNumber: s.lineNumber || this.config.get('SMSIR_LINE_NUMBER', '') || this.config.get('SMS_SENDER', ''),
      otpTemplateId: Number(s.otpTemplateId) || Number(this.config.get('SMSIR_OTP_TEMPLATE_ID', 0)),
      /** Admin alert phone for wholesale (.com) site events */
      adminPhoneWholesale: String(s.adminPhoneWholesale || ''),
      /** Optional second admin phone for wholesale */
      adminPhoneWholesale2: String(s.adminPhoneWholesale2 || ''),
      /** Admin alert phone for retail (.ir) site events */
      adminPhoneRetail: String(s.adminPhoneRetail || ''),
      /** Optional second admin phone for retail */
      adminPhoneRetail2: String(s.adminPhoneRetail2 || ''),
      events: {
        orderRegistered: s.events?.orderRegistered ?? true,
        orderConfirmed: s.events?.orderConfirmed ?? true,
        orderShipped: s.events?.orderShipped ?? true,
        paymentReceived: s.events?.paymentReceived ?? true,
        orderRegisteredAdmin: s.events?.orderRegisteredAdmin ?? true,
        wholesaleRegistrationAdmin: s.events?.wholesaleRegistrationAdmin ?? true,
        wholesaleApproved: s.events?.wholesaleApproved ?? true,
      } as Record<string, boolean>,
      /** Editable SMS bodies — empty/missing keys fall back to current production defaults */
      templates: resolveSmsTemplates(s.templates),
    };
  }

  async payment() {
    const s = await this.get('payment');
    const out = {
      enabled: s.enabled ?? true,
      /** Wholesale (.com) Zarinpal merchant */
      wholesaleEnabled: s.wholesaleEnabled ?? true,
      merchantId: s.merchantId || this.config.get('ZARINPAL_MERCHANT_ID', ''),
      sandbox:
        typeof s.sandbox === 'boolean'
          ? s.sandbox
          : this.config.get('ZARINPAL_SANDBOX', 'true') === 'true',
      callbackUrl:
        s.callbackUrl ||
        this.config.get(
          'PAYMENT_CALLBACK_URL',
          `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://poshaktaranom.com').replace(/\/$/, '')}/payment/callback`,
        ),
      /** Retail (.ir) Zarinpal merchant — separate terminal for storefront */
      retailEnabled: s.retailEnabled ?? true,
      retailMerchantId:
        s.retailMerchantId ||
        this.config.get('ZARINPAL_RETAIL_MERCHANT_ID', '') ||
        s.merchantId ||
        this.config.get('ZARINPAL_MERCHANT_ID', ''),
      retailSandbox:
        typeof s.retailSandbox === 'boolean'
          ? s.retailSandbox
          : typeof s.sandbox === 'boolean'
            ? s.sandbox
            : this.config.get('ZARINPAL_SANDBOX', 'true') === 'true',
      retailCallbackUrl:
        s.retailCallbackUrl ||
        this.config.get(
          'PAYMENT_RETAIL_CALLBACK_URL',
          `${(process.env.NEXT_PUBLIC_RETAIL_URL || 'https://www.poshaktaranom.ir').replace(/\/$/, '')}/payment/callback`,
        ),
      /** Customer chooses ZarinPal or DigiPay at retail checkout; this is not an exclusive admin lock. */
      digipayEnabled: s.digipayEnabled !== false,
      digipayClientId: this.pickSecret(s.digipayClientId, 'DIGIPAY_CLIENT_ID'),
      digipayClientSecret: this.pickSecret(s.digipayClientSecret, 'DIGIPAY_CLIENT_SECRET'),
      digipayUsername: this.pickSecret(s.digipayUsername, 'DIGIPAY_USERNAME'),
      digipayPassword: this.pickSecret(s.digipayPassword, 'DIGIPAY_PASSWORD'),
      digipaySandbox:
        typeof s.digipaySandbox === 'boolean'
          ? s.digipaySandbox
          : this.config.get(
              'DIGIPAY_SANDBOX',
              this.config.get('NODE_ENV', 'development') === 'production' ? 'false' : 'true',
            ) === 'true',
      digipayConfigured: false,
      manualCardNumber: s.manualCardNumber ?? '',
      manualCardOwner: s.manualCardOwner ?? '',
    };
    out.digipayConfigured =
      !!out.digipayClientId &&
      out.digipayClientId !== 'CHANGE_ME' &&
      !!out.digipayClientSecret &&
      out.digipayClientSecret !== 'CHANGE_ME';
    return out;
  }

  private pickSecret(stored: unknown, envKey: string): string {
    const fromDb = String(stored || '').trim();
    if (fromDb && fromDb !== 'CHANGE_ME') return fromDb;
    return String(this.config.get(envKey, '') || '').trim();
  }

  async theme() {
    const s = await this.get('theme');
    const blur = Number(s.glassBlurPx);
    const delay = Number(s.popups?.boutique?.delaySeconds ?? s.boutiqueDelaySeconds);
    const newsDelay = Number(s.popups?.newsletter?.delaySeconds ?? s.newsletterDelaySeconds);

    const boutique = {
      enabled: s.popups?.boutique?.enabled ?? s.boutiqueEnabled ?? true,
      trigger: (s.popups?.boutique?.trigger ?? s.boutiqueTrigger ?? 'delay') as 'delay' | 'exit',
      delaySeconds: Number.isFinite(delay) && delay > 0 ? delay : 6,
      title: s.popups?.boutique?.title ?? 'بوتیک دارید؟ عمده بگیرید',
      body:
        s.popups?.boutique?.body ??
        'مستقیم از تولیدی ترنم در مشهد — لینن و کتان، حداقل سفارش عمده، ارسال سراسر ایران. همین حالا ثبت‌نام کنید تا لیست قیمت عمده برایتان فعال شود.',
      ctaLabel: s.popups?.boutique?.ctaLabel ?? 'ثبت‌نام عمده‌فروش',
      ctaUrl: s.popups?.boutique?.ctaUrl ?? '/portal/register',
    };

    const newsletter = {
      enabled: s.popups?.newsletter?.enabled ?? s.newsletterEnabled ?? true,
      trigger: (s.popups?.newsletter?.trigger ?? s.newsletterTrigger ?? 'exit') as 'delay' | 'exit',
      delaySeconds: Number.isFinite(newsDelay) && newsDelay > 0 ? newsDelay : 18,
      title: s.popups?.newsletter?.title ?? 'کلکسیون لینن جدید',
      body:
        s.popups?.newsletter?.body ??
        'قبل از اتمام موجودی فصل، از مدل‌های جدید شومیزی و مانتو لینن باخبر شوید — تماس با فروش یا عضویت از صفحه تماس.',
      ctaLabel: s.popups?.newsletter?.ctaLabel ?? 'مشاوره خرید عمده',
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

  async menus(channel?: string) {
    const nested = await this.get('menus');
    const wholesaleKey = await this.get('menus_wholesale');
    const retailKey = await this.get('menus_retail');

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

    const buildFrom = (s: Record<string, any>) => ({
      megaEnabled: s.megaEnabled !== false,
      main: normalize(s.main, defaultMain),
      footer: normalize(s.footer, defaultFooter),
      mobile: normalize(s.mobile, defaultMain),
      legal: normalize(s.legal, defaultLegal),
    });

    // Prefer dedicated keys → nested menus.wholesale/retail → flat menus (= wholesale)
    const hasNested =
      nested &&
      typeof nested === 'object' &&
      (nested.wholesale || nested.retail) &&
      !Array.isArray(nested.main);

    const wholesaleSource =
      (wholesaleKey && Object.keys(wholesaleKey).length ? wholesaleKey : null) ||
      (hasNested ? nested.wholesale : null) ||
      nested;

    const retailSource =
      (retailKey && Object.keys(retailKey).length ? retailKey : null) ||
      (hasNested ? nested.retail : null) ||
      wholesaleSource;

    const ch = String(channel || '').toUpperCase();
    if (ch === 'RETAIL') return buildFrom(retailSource || {});
    if (ch === 'WHOLESALE') return buildFrom(wholesaleSource || {});

    // Admin full view: return both + flat wholesale for backward compat
    const wholesale = buildFrom(wholesaleSource || {});
    const retail = buildFrom(retailSource || {});
    return {
      ...wholesale,
      wholesale,
      retail,
    };
  }

  async siteContent() {
    const s = await this.get('siteContent');
    return s && typeof s === 'object' ? s : {};
  }

  async marketing() {
    const s = await this.get('marketing');
    return {
      feedBrandName: String(s.feedBrandName ?? 'پوشاک ترنم'),
      // Google Analytics 4 + Search Console (public-safe IDs / verification tokens)
      ga4WholesaleId: String(s.ga4WholesaleId ?? ''),
      ga4RetailId: String(s.ga4RetailId ?? ''),
      gtmWholesaleId: String(s.gtmWholesaleId ?? ''),
      gtmRetailId: String(s.gtmRetailId ?? ''),
      gscWholesaleVerification: String(s.gscWholesaleVerification ?? ''),
      gscRetailVerification: String(s.gscRetailVerification ?? ''),
      // Pixels / head scripts (public-safe IDs & script URLs)
      yektanetPixelId: String(s.yektanetPixelId ?? ''),
      metaPixelId: String(s.metaPixelId ?? ''),
      adroScriptUrl: String(s.adroScriptUrl ?? ''),
      adroAccountId: String(s.adroAccountId ?? ''),
      afferScriptUrl: String(s.afferScriptUrl ?? ''),
      afsonaScriptUrl: String(s.afsonaScriptUrl ?? ''),
      takhfifanScriptUrl: String(s.takhfifanScriptUrl ?? ''),
      // S2S postback URL templates — secrets stay admin-only via full marketing()
      yektanetPostbackUrl: String(s.yektanetPostbackUrl ?? ''),
      afferPostbackUrl: String(s.afferPostbackUrl ?? ''),
      afsonaPostbackUrl: String(s.afsonaPostbackUrl ?? ''),
      takhfifanPostbackUrl: String(s.takhfifanPostbackUrl ?? ''),
      postbackUrl: String(s.postbackUrl ?? ''),
      broadcastPostbacks: s.broadcastPostbacks === true,
      // Basalam (token never exposed on public endpoint)
      basalamEnabled: s.basalamEnabled === true,
      basalamAccessToken: String(s.basalamAccessToken ?? ''),
      basalamVendorId: String(s.basalamVendorId ?? ''),
      basalamProductMap: (s.basalamProductMap && typeof s.basalamProductMap === 'object'
        ? s.basalamProductMap
        : {}) as Record<string, number>,
      /** Torob order-tracking Sync API (JSON /torob/v1/orders) */
      torobOrderSyncEnabled: s.torobOrderSyncEnabled === true,
    };
  }
}
