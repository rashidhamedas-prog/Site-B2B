import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

// SMS provider: sms.ir (REST API v1, auth via x-api-key header).
// API key, line number, per-event toggles and the master switch are all
// user-configurable from the admin settings panel (DB → env fallback).
// With no API key configured the service logs and no-ops.
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private static readonly BASE = 'https://api.sms.ir/v1';

  constructor(private readonly settings: SettingsService) {}

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
      return this.sendSms(receptor, `پوشاک ترنم\nکد تایید شما: ${token}`);
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

  async orderRegistered(phone: string, orderNumber: string) {
    if (!(await this.eventEnabled('orderRegistered'))) return false;
    return this.sendSms(
      phone,
      `پوشاک ترنم\nسفارش ${orderNumber} ثبت شد و در انتظار بررسی است.\nپیگیری: poshaktaranom.com/portal`,
    );
  }

  async orderConfirmed(phone: string, orderNumber: string) {
    if (!(await this.eventEnabled('orderConfirmed'))) return false;
    return this.sendSms(
      phone,
      `پوشاک ترنم\nسفارش ${orderNumber} تایید شد و آماده‌سازی آن آغاز شده است.`,
    );
  }

  async orderShipped(phone: string, orderNumber: string, trackingCode?: string) {
    if (!(await this.eventEnabled('orderShipped'))) return false;
    const tracking = trackingCode ? `\nکد رهگیری: ${trackingCode}` : '';
    return this.sendSms(phone, `پوشاک ترنم\nسفارش ${orderNumber} ارسال شد.${tracking}`);
  }

  async paymentReceived(phone: string, amountToman: string, refId: string) {
    if (!(await this.eventEnabled('paymentReceived'))) return false;
    return this.sendSms(
      phone,
      `پوشاک ترنم\nپرداخت ${amountToman} تومان با موفقیت ثبت شد.\nکد پیگیری: ${refId}`,
    );
  }

  async status() {
    const cfg = await this.settings.sms();
    return {
      enabled: cfg.enabled && !!cfg.apiKey,
      provider: 'sms.ir',
      lineNumber: cfg.lineNumber || null,
      otpTemplate: cfg.otpTemplateId || null,
      events: cfg.events,
    };
  }
}
