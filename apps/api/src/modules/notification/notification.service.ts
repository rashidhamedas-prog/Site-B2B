import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import {
  SMS_TEMPLATE_DEFAULTS,
  fillSmsTemplate,
  type SmsTemplateKey,
} from './sms-templates.defaults';

// SMS provider: sms.ir (REST API v1, auth via x-api-key header).
// API key, line number, per-event toggles, message templates and the master
// switch are all user-configurable from the admin settings panel
// (DB → defaults). With no API key configured the service logs and no-ops.
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private static readonly BASE = 'https://api.sms.ir/v1';

  constructor(private readonly settings: SettingsService) {}

  static readonly FETCH_TIMEOUT_MS = 8_000;

  private async post(apiKey: string, path: string, body: Record<string, any>): Promise<boolean> {
    try {
      const res = await fetch(`${NotificationService.BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(NotificationService.FETCH_TIMEOUT_MS),
      });
      const json: any = await res.json();
      // sms.ir returns { status: 1, message: "موفق", data: {...} } on success.
      const ok = json?.status === 1;
      if (!ok) this.logger.error(`sms.ir ${path} failed: ${JSON.stringify(json)}`);
      return ok;
    } catch (err: any) {
      this.logger.error(`sms.ir ${path} exception: ${err.message}`);
      return false;
    }
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

  /** Notify site admin(s) when a new order is placed (per-channel phones, up to 2). */
  async orderRegisteredAdmin(
    channel: 'WHOLESALE' | 'RETAIL',
    orderNumber: string,
    customerLabel?: string,
  ) {
    if (!(await this.eventEnabled('orderRegisteredAdmin'))) return false;
    const phones = await this.adminPhonesFor(channel);
    if (phones.length === 0) {
      this.logger.log(`[SMS] orderRegisteredAdmin skipped — no admin phone for ${channel}`);
      return false;
    }
    const site = channel === 'RETAIL' ? 'تک‌فروشی' : 'عمده';
    const customerLine = customerLabel ? `\nمشتری: ${customerLabel}` : '';
    const message = await this.template('orderRegisteredAdmin', {
      site,
      orderNumber,
      customerLabel: customerLabel || '',
      customerLine,
    });
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

  async status() {
    const cfg = await this.settings.sms();
    return {
      enabled: cfg.enabled && !!cfg.apiKey,
      provider: 'sms.ir',
      lineNumber: cfg.lineNumber || null,
      otpTemplate: cfg.otpTemplateId || null,
      adminPhoneWholesale: cfg.adminPhoneWholesale || null,
      adminPhoneWholesale2: cfg.adminPhoneWholesale2 || null,
      adminPhoneRetail: cfg.adminPhoneRetail || null,
      adminPhoneRetail2: cfg.adminPhoneRetail2 || null,
      events: cfg.events,
      templates: cfg.templates,
    };
  }
}
