import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreatePaymentRequest,
  CreatePaymentResult,
  NormalizedProviderError,
  PaymentProviderAdapter,
  ProviderCapabilities,
  ProviderConfig,
  VerifyReturnRequest,
  VerifyReturnResult,
} from './payment-provider.adapter';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const UPG_TICKET_TYPE = 11;
const DIGIPAY_VERSION = '2022-02-02';
const TOKEN_EXPIRY_SKEW_MS = 60_000;

type TokenCache = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

export function normalizeDigipayMobile(raw?: string): string {
  const digits = String(raw || '')
    .trim()
    .replace(/[\s-]/g, '')
    .replace(/^(\+98|0098|98)/, '0')
    .replace(/^۰/, '0');
  const fa = digits.replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)));
  let mobile = fa;
  if (/^9\d{9}$/.test(mobile)) mobile = `0${mobile}`;
  if (!/^09\d{9}$/.test(mobile)) {
    throw new Error('شماره موبایل برای درگاه دیجی‌پی الزامی و باید مثل 09xxxxxxxxx باشد');
  }
  return mobile;
}

export function digipayCallbackIsSuccess(input: {
  result?: string;
  status?: string;
  trackingCode?: string;
}): boolean {
  const status = String(input.status || '').trim().toUpperCase();
  if (status === 'NOK' || status === 'CANCEL' || status === 'CANCELED') return false;
  if (status === 'OK') return true;
  const result = String(input.result || '').trim().toUpperCase();
  if (result === '0' || result === 'SUCCESS' || result === 'OK') return true;
  if (result && result !== '0') return false;
  return !!String(input.trackingCode || '').trim();
}

export function digipayBasicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`;
}

@Injectable()
export class DigiPayAdapter implements PaymentProviderAdapter {
  readonly code = 'DIGIPAY';
  private readonly logger = new Logger(DigiPayAdapter.name);
  private token: TokenCache | null = null;

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): ProviderCapabilities {
    return {
      pay: true,
      bnpl: false,
      refund: true,
      partialRefund: true,
      webhook: false,
    };
  }

  isConfigured(): boolean {
    const id = this.clientId();
    const secret = this.clientSecret();
    return (
      id.length > 0 &&
      secret.length > 0 &&
      id !== 'CHANGE_ME' &&
      secret !== 'CHANGE_ME'
    );
  }

  isSandbox(): boolean {
    const raw = this.config.get<string>('DIGIPAY_SANDBOX');
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return this.config.get('NODE_ENV', 'development') !== 'production';
  }

  payRedirectUrl(ticket: string, sandbox = this.isSandbox()): string {
    const webBase = sandbox
      ? 'https://uatweb.mydigipay.info'
      : 'https://www.mydigipay.com';
    return `${webBase}/web-pay/tgs/${ticket}`;
  }

  private clientId(): string {
    return String(this.config.get('DIGIPAY_CLIENT_ID', '') || '').trim();
  }

  private clientSecret(): string {
    return String(this.config.get('DIGIPAY_CLIENT_SECRET', '') || '').trim();
  }

  private username(): string {
    return String(this.config.get('DIGIPAY_USERNAME', '') || '').trim() || this.clientId();
  }

  private password(): string {
    return String(this.config.get('DIGIPAY_PASSWORD', '') || '').trim() || this.clientSecret();
  }

  private apiBase(sandbox = this.isSandbox()): string {
    return sandbox
      ? 'https://uat.mydigipay.info/digipay/api'
      : 'https://api.mydigipay.com/digipay/api';
  }

  normalizeProviderError(err: unknown): NormalizedProviderError {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'خطای درگاه دیجی‌پی';
    const name = err instanceof Error ? err.name : '';
    const httpStatus =
      typeof err === 'object' &&
      err !== null &&
      'httpStatus' in err &&
      typeof (err as { httpStatus?: unknown }).httpStatus === 'number'
        ? (err as { httpStatus: number }).httpStatus
        : undefined;
    const retryable =
      name === 'AbortError' ||
      (httpStatus !== undefined && httpStatus >= 500) ||
      /timeout|network|ECONNRESET|ETIMEDOUT|fetch failed|5\d\d/i.test(message);
    return {
      code:
        name === 'AbortError'
          ? 'PROVIDER_TIMEOUT'
          : retryable
            ? 'PROVIDER_UNAVAILABLE'
            : 'PROVIDER_ERROR',
      retryable,
      message,
      httpStatus,
    };
  }

  private async fetchRaw(
    url: string,
    init: RequestInit,
    attempt = 0,
  ): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (!res.ok && res.status >= 500 && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        return this.fetchRaw(url, init, attempt + 1);
      }
      let json: Record<string, unknown> = {};
      const text = await res.text();
      if (text) {
        try {
          json = JSON.parse(text) as Record<string, unknown>;
        } catch {
          json = { raw: text.slice(0, 200) };
        }
      }
      return { ok: res.ok, status: res.status, json };
    } catch (err) {
      const norm = this.normalizeProviderError(err);
      if (norm.retryable && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        return this.fetchRaw(url, init, attempt + 1);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private resultStatus(json: Record<string, unknown>): number | undefined {
    const result = json.result as { status?: number } | undefined;
    return typeof result?.status === 'number' ? result.status : undefined;
  }

  private resultMessage(json: Record<string, unknown>, fallback: string): string {
    const result = json.result as { message?: string } | undefined;
    return String(result?.message || json.error_description || json.error || fallback);
  }

  async getAccessToken(force = false): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('اعتبارنامه دیجی‌پی روی سرور تنظیم نشده است');
    }
    if (
      !force &&
      this.token &&
      this.token.accessToken &&
      this.token.expiresAt > Date.now() + TOKEN_EXPIRY_SKEW_MS
    ) {
      return this.token.accessToken;
    }

    const form = new FormData();
    form.append('username', this.username());
    form.append('password', this.password());
    form.append('grant_type', 'password');

    const { ok, status, json } = await this.fetchRaw(
      `${this.apiBase()}/oauth/token`,
      {
        method: 'POST',
        headers: {
          Authorization: digipayBasicAuthHeader(this.clientId(), this.clientSecret()),
        },
        body: form,
      },
    );
    const accessToken = json.access_token;
    if (!ok || !accessToken) {
      this.logger.warn(`DigiPay oauth failed http=${status}`);
      throw new Error(
        status === 401
          ? 'ورود به دیجی‌پی ناموفق بود؛ شناسه/رمز کلاینت یا نام کاربری را در سرور بررسی کنید'
          : this.resultMessage(json, 'ورود به درگاه دیجی‌پی ناموفق بود'),
      );
    }
    const expiresIn = Number(json.expires_in || 3300);
    this.token = {
      accessToken: String(accessToken),
      refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
      expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
    };
    return this.token.accessToken;
  }

  private async authorizedJson(
    pathAndQuery: string,
    body: Record<string, unknown>,
    extraHeaders: Record<string, string> = {},
  ): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
    const token = await this.getAccessToken();
    const first = await this.fetchRaw(`${this.apiBase()}${pathAndQuery}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        Accept: 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
    if (first.status === 401) {
      const retryToken = await this.getAccessToken(true);
      return this.fetchRaw(`${this.apiBase()}${pathAndQuery}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${retryToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          Accept: 'application/json',
          ...extraHeaders,
        },
        body: JSON.stringify(body),
      });
    }
    return first;
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const cellNumber = normalizeDigipayMobile(req.mobile);
    const providerId = String(
      req.metadata?.providerId || req.orderId || '',
    ).trim();
    if (!providerId) {
      throw new Error('شناسه یکتای خرید دیجی‌پی (providerId) الزامی است');
    }
    const { ok, status, json } = await this.authorizedJson(
      `/tickets/business?type=${UPG_TICKET_TYPE}`,
      {
        cellNumber,
        amount: req.amountIrr,
        providerId,
        callbackUrl: req.callbackUrl,
      },
      {
        Agent: 'WEB',
        'Digipay-Version': DIGIPAY_VERSION,
      },
    );
    const ticket = json.ticket ? String(json.ticket) : '';
    const redirectUrl = json.redirectUrl ? String(json.redirectUrl) : '';
    const resultStatus = this.resultStatus(json);
    if (!ok || resultStatus !== 0 || !ticket || !redirectUrl) {
      this.logger.warn(`DigiPay ticket failed http=${status} result=${resultStatus ?? 'n/a'}`);
      throw new Error(this.resultMessage(json, 'خطا در ایجاد تیکت پرداخت دیجی‌پی'));
    }
    return {
      providerToken: ticket,
      redirectUrl,
      rawSanitized: {
        ticket,
        providerId,
        resultStatus,
      },
    };
  }

  async verifyReturn(req: VerifyReturnRequest): Promise<VerifyReturnResult> {
    const trackingCode = String(req.extra?.trackingCode || '').trim();
    const providerId = String(req.extra?.providerId || req.providerToken || '').trim();
    const type = Number(req.extra?.type || UPG_TICKET_TYPE) || UPG_TICKET_TYPE;
    if (!trackingCode || !providerId) {
      return {
        success: false,
        errorMessage: 'کد پیگیری دیجی‌پی برای تایید پرداخت دریافت نشد',
      };
    }
    try {
      const { ok, json } = await this.authorizedJson(`/purchases/verify?type=${type}`, {
        trackingCode,
        providerId,
      });
      const resultStatus = this.resultStatus(json);
      const amount = Number(json.amount);
      if (!ok || resultStatus !== 0) {
        return {
          success: false,
          code: resultStatus,
          errorMessage: this.resultMessage(json, 'تایید پرداخت دیجی‌پی ناموفق بود'),
          rawSanitized: { resultStatus, trackingCode },
        };
      }
      if (Number.isFinite(amount) && amount > 0 && amount !== req.amountIrr) {
        return {
          success: false,
          errorMessage: 'مبلغ تاییدشده با مبلغ سفارش یکسان نیست',
          rawSanitized: { resultStatus, amount, expected: req.amountIrr },
        };
      }
      const ref =
        (json.rrn && String(json.rrn)) ||
        (json.trackingCode && String(json.trackingCode)) ||
        trackingCode;
      return {
        success: true,
        providerRefId: ref,
        code: resultStatus,
        rawSanitized: {
          resultStatus,
          trackingCode: json.trackingCode,
          paymentGateway: json.paymentGateway,
          fpName: json.fpName,
        },
      };
    } catch (err) {
      const norm = this.normalizeProviderError(err);
      this.logger.warn(`DigiPay verify error: ${norm.code} ${norm.message}`);
      return { success: false, errorMessage: norm.message };
    }
  }

  async processWebhook(
    _payload: unknown,
  ): Promise<{ supported: boolean; processed?: boolean }> {
    return { supported: false };
  }

  async getPaymentStatus(
    _providerToken: string,
    _cfg: ProviderConfig,
  ): Promise<{ status: string }> {
    return { status: 'UNKNOWN' };
  }

  async cancelPayment(
    _providerToken: string,
    _cfg: ProviderConfig,
  ): Promise<{ cancelled: boolean }> {
    return { cancelled: false };
  }

  async refundPayment(input: {
    providerRefId: string;
    amountIrr: number;
    merchantId: string;
    sandbox: boolean;
  }): Promise<{
    success: boolean;
    providerRefundId?: string;
    errorMessage?: string;
  }> {
    const saleTrackingCode = String(input.providerRefId || '').trim();
    if (!saleTrackingCode) {
      return { success: false, errorMessage: 'کد پیگیری خرید برای استرداد موجود نیست' };
    }
    const refundProviderId = `rf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const { ok, json } = await this.authorizedJson(`/refunds?type=${UPG_TICKET_TYPE}`, {
        providerId: refundProviderId,
        amount: input.amountIrr,
        saleTrackingCode,
      });
      const resultStatus = this.resultStatus(json);
      if (!ok || resultStatus !== 0) {
        return {
          success: false,
          errorMessage: this.resultMessage(json, 'استرداد دیجی‌پی ناموفق بود'),
        };
      }
      return {
        success: true,
        providerRefundId: json.trackingCode ? String(json.trackingCode) : refundProviderId,
      };
    } catch (err) {
      const norm = this.normalizeProviderError(err);
      return { success: false, errorMessage: norm.message };
    }
  }

  async reconcile(_input: {
    since: Date;
    sandbox: boolean;
  }): Promise<{ supported: boolean; items?: unknown[] }> {
    return { supported: false };
  }
}
