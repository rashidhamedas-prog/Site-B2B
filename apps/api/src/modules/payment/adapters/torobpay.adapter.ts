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
import { normalizeDigits } from '../../auth/phone.util';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const TOKEN_EXPIRY_SKEW_MS = 60_000;
const TOKEN_TTL_MS = 60 * 60 * 1000;
const API_BASE = 'https://cpg.torobpay.com';
const PAYMENT_METHOD = 'ONLINE_CREDIT';
/** totweb / shetabit shops use a Latin category; a Persian label can fail their order insert (1011). */
const DEFAULT_CATEGORY = 'general';
const MIN_ADDRESS_LEN = 8;

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

export function normalizeTorobpayMobile(raw?: string): string {
  const digits = String(raw || '')
    .trim()
    .replace(/[\s-]/g, '')
    .replace(/^(\+98|0098|98)/, '0')
    .replace(/^۰/, '0');
  const fa = digits.replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)));
  let mobile = fa;
  if (/^9\d{9}$/.test(mobile)) mobile = `0${mobile}`;
  if (!/^09\d{9}$/.test(mobile)) {
    throw new Error('شماره موبایل برای درگاه ترب‌پی الزامی و باید مثل 09xxxxxxxxx باشد');
  }
  return mobile;
}

export function torobpayCallbackIsSuccess(input: {
  state?: string;
  status?: string;
}): boolean {
  const state = String(input.state || input.status || '')
    .trim()
    .toUpperCase();
  return state === 'OK' || state === 'SUCCESS';
}

export function torobpayBasicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`;
}

/** Compact UUID txn ids — hyphens can overflow a 32-char CPG column. Callback still uses paymentId. */
export function compactTorobpayTransactionId(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    throw new Error('شناسه یکتای خرید ترب‌پی (transactionId) الزامی است');
  }
  const hex = trimmed.replace(/-/g, '');
  if (/^[0-9a-f]{32}$/i.test(hex)) return hex;
  return trimmed.slice(0, 64);
}

export function normalizeTorobpayPostal(raw?: string): string {
  return normalizeDigits(String(raw || '')).slice(0, 10);
}

export function composeTorobpayAddress(input: {
  street?: string;
  city?: string;
  province?: string;
}): string {
  const street = String(input.street || '').trim();
  const city = String(input.city || '').trim();
  const province = String(input.province || '').trim();
  const composed = [province, city, street].filter(Boolean).join('، ');
  const chosen = (street.replace(/\s/g, '').length >= MIN_ADDRESS_LEN ? street : composed) || street;
  if (chosen.replace(/\s/g, '').length < MIN_ADDRESS_LEN) {
    throw new Error('برای ترب‌پی آدرس خیابان را کامل‌تر بنویسید (خیابان، پلاک، حداقل ۸ نویسه).');
  }
  return chosen.slice(0, 250);
}

/**
 * One cart line equal to the payable amount.
 * Line items + shipping + wallet-in-discount often fail CPG persist (1011) even when our math is fine.
 */
export function buildTorobpayBalancedCart(input: {
  amountIrr: number;
  transactionId: string;
  description?: string;
}): {
  amount: number;
  cartList: Array<{
    cartId: string;
    totalAmount: number;
    taxAmount: number;
    shippingAmount: number;
    isTaxIncluded: boolean;
    isShipmentIncluded: boolean;
    cartItems: Array<{
      id: string;
      name: string;
      count: number;
      amount: number;
      category: string;
    }>;
  }>;
} {
  const amount = Math.floor(Number(input.amountIrr) || 0);
  if (!Number.isFinite(amount) || amount < 10_000) {
    throw new Error('مبلغ پرداخت ترب‌پی نامعتبر است');
  }
  const transactionId = compactTorobpayTransactionId(input.transactionId);
  return {
    amount,
    cartList: [
      {
        cartId: transactionId,
        totalAmount: amount,
        taxAmount: 0,
        shippingAmount: 0,
        isTaxIncluded: true,
        isShipmentIncluded: false,
        cartItems: [
          {
            id: transactionId,
            name: String(input.description || 'سفارش پوشاک ترنم').slice(0, 120),
            count: 1,
            amount,
            category: DEFAULT_CATEGORY,
          },
        ],
      },
    ],
  };
}

export type TorobpayRuntimeCreds = {
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  sandbox?: boolean;
};

export type TorobpayCheckout = {
  address: string;
  postalCode: string;
  fullName: string;
  city: string;
  province: string;
  phone: string;
  shippingAmount?: number;
  discountAmount?: number;
  cartItems?: Array<{ id: string; name: string; count: number; amount: number }>;
};

export type TorobpayProbeFailureClass =
  | 'missing_config'
  | 'invalid_client'
  | 'invalid_grant'
  | 'merchant_inactive'
  | 'network'
  | 'unknown';

export type TorobpayProbeStage = 'config' | 'oauth' | 'eligible' | 'ready';

/** Admin/diagnostics result — never includes secrets or tokens. */
export type TorobpayProbeResult = {
  ok: boolean;
  stage: TorobpayProbeStage;
  failureClass?: TorobpayProbeFailureClass;
  httpStatus?: number;
  message: string;
  sandbox: boolean;
  eligible?: boolean;
  meta: {
    clientIdLen: number;
    clientSecretLen: number;
    usernameLen: number;
    passwordLen: number;
  };
};

export function classifyTorobpayOauthFailure(input: {
  httpStatus: number;
  json: Record<string, unknown>;
}): { failureClass: TorobpayProbeFailureClass; message: string } {
  const httpStatus = input.httpStatus;
  const json = input.json || {};
  const code = Number(json.error_code ?? json.errorCode ?? json.code);
  const msg = String(json.user_message || json.message || json.error || '').trim();

  if (httpStatus === 404 || code === 1017) {
    return {
      failureClass: 'invalid_client',
      message:
        'کد پذیرنده یا کلید توسط ترب‌پی پیدا نشد. این چهار مقدار از صفحهٔ فعال‌سازی درگاه است، نه لاگین پنل فروشگاه.',
    };
  }
  if (httpStatus === 403 && (code === 1099 || /inactive/i.test(msg))) {
    return {
      failureClass: 'merchant_inactive',
      message: 'مرچنت ترب‌پی غیرفعال است. از پشتیبانی ترب‌پی وضعیت پذیرنده را بپرسید.',
    };
  }
  if (httpStatus === 403 && (code === 1023 || /username|password/i.test(msg))) {
    return {
      failureClass: 'invalid_grant',
      message: 'نام کاربری یا رمز فعال‌سازی درگاه رد شد.',
    };
  }
  if (httpStatus === 403 || httpStatus === 401) {
    return {
      failureClass: 'invalid_client',
      message:
        msg ||
        'احراز هویت Basic (کد پذیرنده + کلید) توسط ترب‌پی رد شد. مقادیر صفحهٔ اطلاعات فعال‌سازی را دوباره وارد کنید.',
    };
  }
  if (httpStatus >= 500 || httpStatus === 0) {
    return {
      failureClass: 'network',
      message: msg || 'سرویس ترب‌پی در دسترس نیست؛ بعداً دوباره تست کنید.',
    };
  }
  return {
    failureClass: 'unknown',
    message: msg || `ورود OAuth ترب‌پی ناموفق بود (HTTP ${httpStatus || 'n/a'})`,
  };
}

function envelopeOk(json: Record<string, unknown>): boolean {
  if (json.successful === true) return true;
  if (json.successful === false) return false;
  return true;
}

function envelopeResponse(json: Record<string, unknown>): Record<string, unknown> {
  const response = json.response;
  return response && typeof response === 'object' ? (response as Record<string, unknown>) : json;
}

function envelopeMessage(json: Record<string, unknown>, fallback: string): string {
  const errorData =
    json.errorData && typeof json.errorData === 'object'
      ? (json.errorData as Record<string, unknown>)
      : {};
  const code = errorData.errorCode ?? json.error_code ?? json.errorCode ?? json.code;
  const msg = String(
    json.user_message ||
      json.message ||
      errorData.userMessage ||
      errorData.message ||
      json.error ||
      envelopeResponse(json).message ||
      '',
  ).trim();
  if (msg && code != null && String(code)) return `${msg} (${code})`;
  return msg || fallback;
}

@Injectable()
export class TorobPayAdapter implements PaymentProviderAdapter {
  readonly code = 'TOROBPAY';
  private readonly logger = new Logger(TorobPayAdapter.name);
  private readonly tokens = new Map<string, TokenCache>();

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): ProviderCapabilities {
    return {
      pay: true,
      bnpl: true,
      refund: false,
      partialRefund: false,
      webhook: false,
    };
  }

  isConfigured(over?: TorobpayRuntimeCreds): boolean {
    const c = this.creds(over);
    return (
      c.clientId.length > 0 &&
      c.clientSecret.length > 0 &&
      c.username.length > 0 &&
      c.password.length > 0 &&
      c.clientId !== 'CHANGE_ME' &&
      c.clientSecret !== 'CHANGE_ME'
    );
  }

  isSandbox(over?: TorobpayRuntimeCreds): boolean {
    if (typeof over?.sandbox === 'boolean') return over.sandbox;
    const raw = this.config.get<string>('TOROBPAY_SANDBOX');
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return this.config.get('NODE_ENV', 'development') !== 'production';
  }

  private pick(over: string | undefined, envKey: string): string {
    const a = String(over || '').trim();
    if (a && a !== 'CHANGE_ME') return a;
    return String(this.config.get(envKey, '') || '').trim();
  }

  private creds(over?: TorobpayRuntimeCreds) {
    return {
      clientId: this.pick(over?.clientId, 'TOROBPAY_CLIENT_ID'),
      clientSecret: this.pick(over?.clientSecret, 'TOROBPAY_CLIENT_SECRET'),
      username: this.pick(over?.username, 'TOROBPAY_USERNAME'),
      password: this.pick(over?.password, 'TOROBPAY_PASSWORD'),
      sandbox: this.isSandbox(over),
    };
  }

  private probeMeta(c: {
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
  }): TorobpayProbeResult['meta'] {
    return {
      clientIdLen: c.clientId.length,
      clientSecretLen: c.clientSecret.length,
      usernameLen: c.username.length,
      passwordLen: c.password.length,
    };
  }

  normalizeProviderError(err: unknown): NormalizedProviderError {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'خطای درگاه ترب‌پی';
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

  async getAccessToken(force = false, over?: TorobpayRuntimeCreds): Promise<string> {
    const c = this.creds(over);
    if (!this.isConfigured(over)) {
      throw new Error('اعتبارنامه ترب‌پی در تنظیمات ادمین یا فایل محیطی سرور کامل نیست');
    }
    const cached = this.tokens.get(c.clientId);
    if (
      !force &&
      cached &&
      cached.accessToken &&
      cached.expiresAt > Date.now() + TOKEN_EXPIRY_SKEW_MS
    ) {
      return cached.accessToken;
    }

    const { ok, status, json } = await this.fetchRaw(`${API_BASE}/api/online/v1/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: torobpayBasicAuthHeader(c.clientId, c.clientSecret),
        'Content-Type': 'application/json; charset=UTF-8',
        Accept: 'application/json',
      },
      body: JSON.stringify({ username: c.username, password: c.password }),
    });
    const accessToken = json.access_token;
    if (!ok || !accessToken) {
      this.logger.warn(`TorobPay oauth failed http=${status}`);
      const classified = classifyTorobpayOauthFailure({ httpStatus: status, json });
      throw new Error(classified.message);
    }
    this.tokens.set(c.clientId, {
      accessToken: String(accessToken),
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });
    return String(accessToken);
  }

  private async authorized(
    method: 'GET' | 'POST',
    pathAndQuery: string,
    body?: Record<string, unknown>,
    over?: TorobpayRuntimeCreds,
  ): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
    const token = await this.getAccessToken(false, over);
    const first = await this.fetchRaw(`${API_BASE}${pathAndQuery}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (first.status === 401) {
      const retryToken = await this.getAccessToken(true, over);
      return this.fetchRaw(`${API_BASE}${pathAndQuery}`, {
        method,
        headers: {
          Authorization: `Bearer ${retryToken}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    }
    return first;
  }

  /**
   * Admin connection probe: OAuth + eligible (no payment token) so production stays side-effect free.
   */
  async probeConnection(over?: TorobpayRuntimeCreds): Promise<TorobpayProbeResult> {
    const c = this.creds(over);
    const meta = this.probeMeta(c);
    const sandbox = c.sandbox;
    if (!this.isConfigured(over)) {
      return {
        ok: false,
        stage: 'config',
        failureClass: 'missing_config',
        message:
          'هر چهار مقدار فعال‌سازی لازم است: کد پذیرنده، کلید، نام کاربری و رمز عبور.',
        sandbox,
        meta,
      };
    }

    try {
      const { ok, status, json } = await this.fetchRaw(`${API_BASE}/api/online/v1/oauth/token`, {
        method: 'POST',
        headers: {
          Authorization: torobpayBasicAuthHeader(c.clientId, c.clientSecret),
          'Content-Type': 'application/json; charset=UTF-8',
          Accept: 'application/json',
        },
        body: JSON.stringify({ username: c.username, password: c.password }),
      });
      if (!ok || !json.access_token) {
        const classified = classifyTorobpayOauthFailure({ httpStatus: status, json });
        this.logger.warn(
          `TorobPay probe oauth failed http=${status} class=${classified.failureClass}`,
        );
        return {
          ok: false,
          stage: 'oauth',
          failureClass: classified.failureClass,
          httpStatus: status,
          message: classified.message,
          sandbox,
          meta,
        };
      }
      this.tokens.delete(c.clientId);

      try {
        const eligible = await this.fetchRaw(
          `${API_BASE}/api/online/offer/v1/eligible?amount=100000`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${String(json.access_token)}`,
              Accept: 'application/json',
            },
          },
        );
        const response = envelopeResponse(eligible.json);
        const isEligible = response.eligible === true;
        return {
          ok: true,
          stage: 'ready',
          eligible: isEligible,
          httpStatus: eligible.status,
          message: isEligible
            ? 'اتصال عملیاتی موفق بود. مشتری می‌تواند ترب‌پی را در چک‌اوت ببیند (اگر نمایش فعال باشد).'
            : 'احراز هویت موفق بود؛ برای مبلغ آزمایشی پیشنهاد اقساطی برنگشت. نمایش چک‌اوت همچنان ممکن است.',
          sandbox,
          meta,
        };
      } catch (err) {
        const norm = this.normalizeProviderError(err);
        return {
          ok: true,
          stage: 'eligible',
          failureClass: norm.retryable ? 'network' : 'unknown',
          message: 'احراز هویت موفق بود؛ بررسی پیشنهاد اقساطی در دسترس نبود.',
          sandbox,
          meta,
        };
      }
    } catch (err) {
      const norm = this.normalizeProviderError(err);
      this.logger.warn(`TorobPay probe error: ${norm.code} ${norm.message}`);
      return {
        ok: false,
        stage: 'oauth',
        failureClass: norm.retryable ? 'network' : 'unknown',
        httpStatus: norm.httpStatus,
        message: norm.message,
        sandbox,
        meta,
      };
    }
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const over = req.torobpayCreds;
    const checkout = req.torobpayCheckout;
    const phone = normalizeTorobpayMobile(checkout?.phone || req.mobile);
    const transactionId = compactTorobpayTransactionId(
      String(req.metadata?.providerId || req.orderId || ''),
    );
    if (
      !checkout?.address ||
      !checkout.postalCode ||
      !checkout.fullName ||
      !checkout.city ||
      !checkout.province
    ) {
      throw new Error(
        'برای ترب‌پی آدرس کامل چک‌اوت لازم است: استان، شهر، خیابان، کدپستی و نام گیرنده',
      );
    }

    const postalCode = normalizeTorobpayPostal(checkout.postalCode);
    if (postalCode.length !== 10) {
      throw new Error('کدپستی ۱۰ رقمی برای صدور توکن ترب‌پی الزامی است');
    }
    const address = composeTorobpayAddress({
      street: checkout.address,
      city: checkout.city,
      province: checkout.province,
    });
    const fullName = String(checkout.fullName).trim().slice(0, 80);
    if (fullName.length < 3) {
      throw new Error('برای ترب‌پی نام و نام خانوادگی گیرنده را کامل وارد کنید.');
    }
    const cart = buildTorobpayBalancedCart({
      amountIrr: req.amountIrr,
      transactionId,
      description: req.description,
    });

    const body = {
      amount: cart.amount,
      paymentMethodTypeDto: PAYMENT_METHOD,
      returnURL: req.callbackUrl,
      transactionId,
      mobile: phone,
      address,
      postalCode,
      customer_full_name: fullName,
      city: checkout.city,
      province: checkout.province,
      registration_phone_number: phone,
      cartList: cart.cartList,
    };

    const { ok, status, json } = await this.authorized(
      'POST',
      '/api/online/payment/v1/token',
      body,
      over,
    );
    const response = envelopeResponse(json);
    const paymentToken = response.paymentToken ? String(response.paymentToken) : '';
    const paymentPageUrl = response.paymentPageUrl ? String(response.paymentPageUrl) : '';
    if (!ok || !envelopeOk(json) || !paymentToken || !paymentPageUrl) {
      const detail = envelopeMessage(json, 'خطا در ایجاد توکن پرداخت ترب‌پی');
      this.logger.warn(
        `TorobPay token failed http=${status} detail=${detail.slice(0, 160)} amount=${cart.amount} streetLen=${address.length}`,
      );
      if (/\b1011\b/.test(detail) || /can't create order/i.test(detail)) {
        throw new Error(
          'ترب‌پی نتوانست سفارش را ثبت کند. آدرس را کامل‌تر بنویسید (خیابان و پلاک) و دوباره ترب‌پی را بزنید.',
        );
      }
      throw new Error(detail);
    }
    return {
      providerToken: paymentToken,
      redirectUrl: paymentPageUrl,
      rawSanitized: { paymentToken, transactionId },
    };
  }

  private settleErrorIsAlreadyDone(json: Record<string, unknown>): boolean {
    const code = Number(json.error_code ?? json.errorCode ?? json.code);
    const msg = String(json.user_message || json.message || '').toLowerCase();
    return code === 1053 || /already|ongoing|settle/i.test(msg);
  }

  async verifyReturn(req: VerifyReturnRequest): Promise<VerifyReturnResult> {
    const over = req.torobpayCreds;
    const paymentToken = String(req.providerToken || req.extra?.paymentToken || '').trim();
    if (!paymentToken) {
      return {
        success: false,
        errorMessage: 'توکن پرداخت ترب‌پی برای تایید دریافت نشد',
      };
    }
    const callbackAmount = Number(req.extra?.amount || 0);
    if (Number.isFinite(callbackAmount) && callbackAmount > 0 && callbackAmount !== req.amountIrr) {
      return {
        success: false,
        errorMessage: 'مبلغ بازگشت با مبلغ سفارش یکسان نیست',
        rawSanitized: { amount: callbackAmount, expected: req.amountIrr },
      };
    }

    try {
      const verified = await this.authorized(
        'POST',
        '/api/online/payment/v1/verify',
        { paymentToken },
        over,
      );
      const verifyOk = verified.ok && envelopeOk(verified.json);
      if (!verifyOk && !this.settleErrorIsAlreadyDone(verified.json)) {
        return {
          success: false,
          errorMessage: envelopeMessage(verified.json, 'تایید پرداخت ترب‌پی ناموفق بود'),
          rawSanitized: { stage: 'verify', httpStatus: verified.status },
        };
      }

      const settled = await this.authorized(
        'POST',
        '/api/online/payment/v1/settle',
        { paymentToken },
        over,
      );
      if (!settled.ok && !envelopeOk(settled.json) && !this.settleErrorIsAlreadyDone(settled.json)) {
        return {
          success: false,
          errorMessage: envelopeMessage(settled.json, 'تسویه نهایی ترب‌پی ناموفق بود؛ دوباره تلاش کنید'),
          rawSanitized: { stage: 'settle', httpStatus: settled.status },
        };
      }

      const response = envelopeResponse(verified.json);
      const ref =
        (response.transactionId && String(response.transactionId)) ||
        String(req.extra?.transactionId || paymentToken);
      return {
        success: true,
        providerRefId: ref,
        rawSanitized: { transactionId: ref, settled: true },
      };
    } catch (err) {
      const norm = this.normalizeProviderError(err);
      this.logger.warn(`TorobPay verify error: ${norm.code} ${norm.message}`);
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

  async refundPayment(_input: {
    providerRefId: string;
    amountIrr: number;
    merchantId: string;
    sandbox: boolean;
  }): Promise<{
    success: boolean;
    providerRefundId?: string;
    errorMessage?: string;
  }> {
    return { success: false, errorMessage: 'استرداد مستقیم ترب‌پی هنوز فعال نیست' };
  }

  async reconcile(_input: {
    since: Date;
    sandbox: boolean;
  }): Promise<{ supported: boolean; items?: unknown[] }> {
    return { supported: false };
  }
}
