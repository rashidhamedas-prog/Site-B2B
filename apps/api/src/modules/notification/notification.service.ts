import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import {
  SMS_TEMPLATE_DEFAULTS,
  fillSmsTemplate,
  type SmsTemplateKey,
} from './sms-templates.defaults';
import { resolveSmsOps, smsOpsEnabled, type SmsChannel } from './sms-ops';
import {
  SMS_FETCH_TIMEOUT_MS,
  smsIrRequest,
  type SmsTransportConfig,
  type SmsTransportResult,
} from './sms-transport';

// SMS provider: sms.ir (REST API v1, auth via x-api-key header).
// API key, line number, per-event toggles, message templates and the master
// switch are all user-configurable from the admin settings panel
// (DB → defaults). With no API key configured the service logs and no-ops.
// When the origin cannot reach api.sms.ir (common on EU VPS), set
// SMS_EGRESS_BASE_URL (+ SMS_EGRESS_SECRET) to a Cloudflare Worker proxy.
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly settings: SettingsService) {}

  static readonly FETCH_TIMEOUT_MS = SMS_FETCH_TIMEOUT_MS;

  private transportCfg(cfg: { egressBaseUrl?: string; egressSecret?: string }): SmsTransportConfig {
    return {
      egressBaseUrl: cfg.egressBaseUrl || '',
      egressSecret: cfg.egressSecret || '',
      timeoutMs: NotificationService.FETCH_TIMEOUT_MS,
    };
  }

  private logTransportFailure(path: string, result: SmsTransportResult) {
    this.logger.error(
      `sms.ir ${path} failed via=${result.via} code=${result.errorCode || 'PROVIDER'} ms=${result.durationMs} msg=${result.errorMessage || ''}`,
    );
  }

  private async post(apiKey: string, path: string, body: Record<string, any>): Promise<boolean> {
    const cfg = await this.settings.sms();
    const result = await smsIrRequest(
      'POST',
      path,
      apiKey,
      body,
      this.transportCfg(cfg),
    );
    if (!result.ok) this.logTransportFailure(path, result);
    return result.ok;
  }

  private async template(key: SmsTemplateKey, vars: Record<string, string>): Promise<string> {
    const cfg = await this.settings.sms();
    const tpl =
      (cfg.templates && cfg.templates[key]) ||
      SMS_TEMPLATE_DEFAULTS[key];
    return fillSmsTemplate(tpl, vars);
  }

  // Plain SMS to one number. Returns true when actually dispatched.
  async sendSms(receptor: string, message: string): Promise<boolean> {
    const cfg = await this.settings.sms();
    if (!cfg.enabled || !cfg.apiKey) {
      this.logger.log(`[SMS off] to=${receptor} msg=${message.slice(0, 60)}...`);
      return false;
    }
    return this.post(cfg.apiKey, '/send/bulk', {
      lineNumber: cfg.lineNumber || undefined,
      messageText: message,
      mobiles: [receptor],
    });
  }

  // Bulk SMS to many numbers (marketing blast).
  async sendBulk(receptors: string[], message: string): Promise<boolean> {
    const cfg = await this.settings.sms();
    if (!cfg.enabled || !cfg.apiKey || receptors.length === 0) {
      this.logger.log(`[SMS off/bulk] count=${receptors.length}`);
      return false;
    }
    return this.post(cfg.apiKey, '/send/bulk', {
      lineNumber: cfg.lineNumber || undefined,
      messageText: message,
      mobiles: receptors,
    });
  }

  /** Marketing / blast path: never send more than 100 numbers per sms.ir request. */
  async sendBulkChunked(receptors: string[], message: string, chunkSize = 100): Promise<boolean> {
    const unique = [...new Set(receptors.map((r) => String(r || '').trim()).filter(Boolean))];
    if (unique.length === 0) return false;
    const size = Math.max(1, Math.min(chunkSize, 100));
    let any = false;
    for (let i = 0; i < unique.length; i += size) {
      const ok = await this.sendBulk(unique.slice(i, i + size), message);
      any = any || ok;
    }
    return any;
  }

  // OTP via sms.ir fast-send template (template must define #CODE#).
  async sendOtp(receptor: string, token: string): Promise<boolean> {
    const cfg = await this.settings.sms();
    if (!cfg.enabled || !cfg.apiKey) {
      this.logger.log(`[SMS off] OTP to=${receptor} token=${token}`);
      return false;
    }
    if (!cfg.otpTemplateId) {
      const message = await this.template('otpFallback', { code: token });
      return this.sendSms(receptor, message);
    }
    return this.post(cfg.apiKey, '/send/verify', {
      mobile: receptor,
      templateId: cfg.otpTemplateId,
      parameters: [{ name: 'CODE', value: token }],
    });
  }

  // ── Business event helpers (each toggleable in settings) ──

  private async eventEnabled(event: string): Promise<boolean> {
    const cfg = await this.settings.sms();
    return cfg.enabled && cfg.events[event] !== false;
  }

  private async adminPhonesFor(channel: 'WHOLESALE' | 'RETAIL'): Promise<string[]> {
    const cfg = await this.settings.sms();
    const primary =
      channel === 'RETAIL' ? cfg.adminPhoneRetail : cfg.adminPhoneWholesale;
    const secondary =
      channel === 'RETAIL' ? cfg.adminPhoneRetail2 : cfg.adminPhoneWholesale2;
    return [primary, secondary]
      .map((p) => String(p || '').trim())
      .filter(Boolean);
  }

  async orderRegistered(phone: string, orderNumber: string) {
    if (!(await this.eventEnabled('orderRegistered'))) return false;
    const message = await this.template('orderRegistered', { orderNumber });
    return this.sendSms(phone, message);
  }

  /**
   * Legacy hook from order.created — admin is notified only after payment
   * (`orderPaidAdmin`). Customer SMS still uses `orderRegistered`.
   */
  async orderRegisteredAdmin(
    _channel: 'WHOLESALE' | 'RETAIL',
    _orderNumber: string,
    _customerLabel?: string,
  ) {
    return false;
  }

  private async opsEnabled(channel: SmsChannel, event: 'orderPaidAdmin' | 'abandonedCart' | 'stockOutAdmin') {
    const raw = await this.settings.get('smsOps');
    return smsOpsEnabled(resolveSmsOps(raw), channel, event);
  }

  async orderPaidAdmin(
    channel: 'WHOLESALE' | 'RETAIL',
    orderNumber: string,
    customerLabel?: string,
  ) {
    if (!(await this.opsEnabled(channel, 'orderPaidAdmin'))) return false;
    const phones = await this.adminPhonesFor(channel);
    if (phones.length === 0) {
      this.logger.log(`[SMS] orderPaidAdmin skipped — no admin phone for ${channel}`);
      return false;
    }
    const site = channel === 'RETAIL' ? 'تک‌فروشی' : 'عمده';
    const customerLine = customerLabel ? `\nمشتری: ${customerLabel}` : '';
    const message = await this.template('orderPaidAdmin', {
      site,
      orderNumber,
      customerLabel: customerLabel || '',
      customerLine,
    });
    const results = await Promise.all(phones.map((p) => this.sendSms(p, message)));
    return results.some(Boolean);
  }

  async abandonedCart(channel: SmsChannel, phone: string) {
    if (!(await this.opsEnabled(channel, 'abandonedCart'))) return false;
    const site = channel === 'RETAIL' ? 'تک‌فروشی' : 'عمده';
    const cartUrl = channel === 'RETAIL' ? 'poshaktaranom.ir' : 'poshaktaranom.com/portal';
    const message = await this.template('abandonedCart', { site, cartUrl });
    return this.sendSms(phone, message);
  }

  async stockOutAdmin(channel: SmsChannel, productName: string) {
    if (!(await this.opsEnabled(channel, 'stockOutAdmin'))) return false;
    const phones = await this.adminPhonesFor(channel);
    if (phones.length === 0) return false;
    const site = channel === 'RETAIL' ? 'تک‌فروشی' : 'عمده';
    const message = await this.template('stockOutAdmin', { site, productName });
    const results = await Promise.all(phones.map((p) => this.sendSms(p, message)));
    return results.some(Boolean);
  }

  /** Notify wholesale admin(s) when a B2B customer registers. */
  async wholesaleRegistrationAdmin(customerName: string, phone: string) {
    if (!(await this.eventEnabled('wholesaleRegistrationAdmin'))) return false;
    const phones = await this.adminPhonesFor('WHOLESALE');
    if (phones.length === 0) {
      this.logger.log('[SMS] wholesaleRegistrationAdmin skipped — no admin phone');
      return false;
    }
    const message = await this.template('wholesaleRegistrationAdmin', {
      customerName,
      phone,
    });
    const results = await Promise.all(phones.map((p) => this.sendSms(p, message)));
    return results.some(Boolean);
  }

  /** Notify wholesale customer that their account was approved. */
  async wholesaleApproved(phone: string, customerName?: string) {
    if (!(await this.eventEnabled('wholesaleApproved'))) return false;
    const greet = customerName ? `${customerName} عزیز،\n` : '';
    const message = await this.template('wholesaleApproved', {
      greet,
      customerName: customerName || '',
    });
    return this.sendSms(phone, message);
  }

  async orderConfirmed(phone: string, orderNumber: string) {
    if (!(await this.eventEnabled('orderConfirmed'))) return false;
    const message = await this.template('orderConfirmed', { orderNumber });
    return this.sendSms(phone, message);
  }

  async orderShipped(phone: string, orderNumber: string, trackingCode?: string) {
    if (!(await this.eventEnabled('orderShipped'))) return false;
    const trackingLine = trackingCode ? `\nکد رهگیری: ${trackingCode}` : '';
    const message = await this.template('orderShipped', {
      orderNumber,
      trackingCode: trackingCode || '',
      trackingLine,
    });
    return this.sendSms(phone, message);
  }

  async paymentReceived(phone: string, amountToman: string, refId: string) {
    if (!(await this.eventEnabled('paymentReceived'))) return false;
    const message = await this.template('paymentReceived', { amountToman, refId });
    return this.sendSms(phone, message);
  }

  /** SMS to dropship partner when a vendor parcel awaits accept. */
  async fulfillmentPendingAccept(
    phone: string,
    vars: { orderNumber: string; slaHours?: number | null; partnersUrl?: string },
  ) {
    if (!(await this.eventEnabled('fulfillmentPendingAccept'))) return false;
    const sla =
      vars.slaHours != null && Number.isFinite(Number(vars.slaHours))
        ? String(Math.max(1, Math.floor(Number(vars.slaHours))))
        : '۱۲';
    const message = await this.template('fulfillmentPendingAccept', {
      orderNumber: vars.orderNumber,
      slaHours: sla,
      partnersUrl: vars.partnersUrl || 'poshaktaranom.com/partners',
    });
    return this.sendSms(phone, message);
  }

  async fulfillmentShipped(
    phone: string,
    vars: { orderNumber: string; parcelLabel: string; trackingCode: string },
  ) {
    if (!(await this.eventEnabled('fulfillmentShipped'))) return false;
    const trackingLine = vars.trackingCode ? `\nکد رهگیری: ${vars.trackingCode}` : '';
    const message = await this.template('fulfillmentShipped', {
      orderNumber: vars.orderNumber,
      parcelLabel: vars.parcelLabel || 'مرسوله',
      trackingCode: vars.trackingCode || '',
      trackingLine,
    });
    return this.sendSms(phone, message);
  }

  /** Admin alert when partner SLA expires or partner rejects — parcel back to OWN. */
  async fulfillmentAcceptExpired(
    channel: 'WHOLESALE' | 'RETAIL',
    vars: {
      orderNumber: string;
      parcelLabel: string;
      vendorName: string;
      reason: 'sla' | 'reject';
    },
  ) {
    if (!(await this.eventEnabled('fulfillmentAcceptExpired'))) return false;
    const phones = await this.adminPhonesFor(channel);
    if (phones.length === 0) {
      this.logger.log(`[SMS] fulfillmentAcceptExpired skipped — no admin phone for ${channel}`);
      return false;
    }
    const reasonLabel = vars.reason === 'reject' ? 'رد همکار' : 'انقضای مهلت قبول';
    const message = await this.template('fulfillmentAcceptExpired', {
      orderNumber: vars.orderNumber,
      parcelLabel: vars.parcelLabel || 'مرسوله',
      vendorName: vars.vendorName || 'همکار',
      reasonLabel,
    });
    const results = await Promise.all(phones.map((p) => this.sendSms(p, message)));
    return results.some(Boolean);
  }

  async status() {
    const cfg = await this.settings.sms();
    return {
      enabled: cfg.enabled && !!cfg.apiKey,
      provider: 'sms.ir',
      lineNumber: cfg.lineNumber || null,
      otpTemplate: cfg.otpTemplateId || null,
      egressConfigured: Boolean(cfg.egressBaseUrl),
      egressBaseUrl: cfg.egressBaseUrl || null,
      adminPhoneWholesale: cfg.adminPhoneWholesale || null,
      adminPhoneWholesale2: cfg.adminPhoneWholesale2 || null,
      adminPhoneRetail: cfg.adminPhoneRetail || null,
      adminPhoneRetail2: cfg.adminPhoneRetail2 || null,
      events: cfg.events,
      templates: cfg.templates,
    };
  }

  /**
   * Admin connectivity probe — hits sms.ir /credit through the same transport
   * as live sends (direct or egress). Never returns the API key.
   */
  async probe(): Promise<{
    ok: boolean;
    via: 'direct' | 'egress';
    errorCode?: string;
    errorMessage?: string;
    durationMs: number;
    credit?: number | null;
    enabled: boolean;
    hasApiKey: boolean;
    egressConfigured: boolean;
  }> {
    const cfg = await this.settings.sms();
    if (!cfg.enabled) {
      return {
        ok: false,
        via: cfg.egressBaseUrl ? 'egress' : 'direct',
        errorCode: 'DISABLED',
        errorMessage: 'SMS master switch is off',
        durationMs: 0,
        enabled: false,
        hasApiKey: !!cfg.apiKey,
        egressConfigured: Boolean(cfg.egressBaseUrl),
      };
    }
    if (!cfg.apiKey) {
      return {
        ok: false,
        via: cfg.egressBaseUrl ? 'egress' : 'direct',
        errorCode: 'DISABLED',
        errorMessage: 'API key missing',
        durationMs: 0,
        enabled: true,
        hasApiKey: false,
        egressConfigured: Boolean(cfg.egressBaseUrl),
      };
    }
    const result = await smsIrRequest('GET', '/credit', cfg.apiKey, undefined, this.transportCfg(cfg));
    const data = result.body && typeof result.body === 'object' ? (result.body as any).data : null;
    const credit =
      typeof data === 'number'
        ? data
        : data && typeof data === 'object' && typeof data.credit === 'number'
          ? data.credit
          : null;
    if (!result.ok) this.logTransportFailure('/credit', result);
    return {
      ok: result.ok,
      via: result.via,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      durationMs: result.durationMs,
      credit,
      enabled: true,
      hasApiKey: true,
      egressConfigured: Boolean(cfg.egressBaseUrl),
    };
  }
}
