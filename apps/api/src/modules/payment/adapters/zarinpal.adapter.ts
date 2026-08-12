import { Injectable, Logger } from '@nestjs/common';
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

/** Official ZarinPal v4 REST bases — no guessed/legacy endpoints. */
const REQUEST_TIMEOUT_MS = 15_000;
/** Max retries after the first attempt for safe/transient errors only. */
const MAX_RETRIES = 2;

@Injectable()
export class ZarinPalAdapter implements PaymentProviderAdapter {
  readonly code = 'ZARINPAL';
  private readonly logger = new Logger(ZarinPalAdapter.name);

  getCapabilities(): ProviderCapabilities {
    return {
      pay: true,
      bnpl: false,
      refund: false,
      partialRefund: false,
      webhook: false,
    };
  }

  private bases(sandbox: boolean) {
    return {
      apiBase: sandbox
        ? 'https://sandbox.zarinpal.com/pg/v4/payment'
        : 'https://payment.zarinpal.com/pg/v4/payment',
      startPayBase: sandbox
        ? 'https://sandbox.zarinpal.com/pg/StartPay'
        : 'https://payment.zarinpal.com/pg/StartPay',
    };
  }

  normalizeProviderError(err: unknown): NormalizedProviderError {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'خطای درگاه پرداخت';
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

  private async fetchJson(
    url: string,
    body: Record<string, unknown>,
    attempt = 0,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok && res.status >= 500 && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        return this.fetchJson(url, body, attempt + 1);
      }
      const json = (await res.json()) as Record<string, unknown>;
      return json;
    } catch (err) {
      const norm = this.normalizeProviderError(err);
      if (norm.retryable && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        return this.fetchJson(url, body, attempt + 1);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const { apiBase, startPayBase } = this.bases(req.sandbox);
    const json = await this.fetchJson(`${apiBase}/request.json`, {
      merchant_id: req.merchantId,
      amount: req.amountIrr,
      callback_url: req.callbackUrl,
      description: req.description,
      metadata: {
        mobile: req.mobile,
        email: req.email,
        orderId: req.orderId,
        ...(req.metadata || {}),
      },
    });
    const data = (json?.data ?? {}) as Record<string, unknown>;
    const authority = data.authority;
    const code = data.code;
    if (!authority || (code !== 100 && code !== 101)) {
      const errors = json?.errors as
        | { message?: string }
        | Array<{ message?: string }>
        | undefined;
      const errMsg =
        (errors && !Array.isArray(errors) ? errors.message : undefined) ??
        (Array.isArray(errors) ? errors[0]?.message : undefined) ??
        'خطا در ایجاد تراکنش پرداخت';
      throw new Error(String(errMsg));
    }
    const token = String(authority);
    return {
      providerToken: token,
      redirectUrl: `${startPayBase}/${token}`,
      rawSanitized: { code, authority: token },
    };
  }

  async verifyReturn(req: VerifyReturnRequest): Promise<VerifyReturnResult> {
    const { apiBase } = this.bases(req.sandbox);
    try {
      const json = await this.fetchJson(`${apiBase}/verify.json`, {
        merchant_id: req.merchantId,
        amount: req.amountIrr,
        authority: req.providerToken,
      });
      const data = (json?.data ?? {}) as Record<string, unknown>;
      const code = data.code as number | undefined;
      if (code === 100 || code === 101) {
        return {
          success: true,
          alreadyVerified: code === 101,
          providerRefId: String(data.ref_id ?? ''),
          code,
          rawSanitized: { code, ref_id: data.ref_id },
        };
      }
      const errors = json?.errors as { message?: string } | undefined;
      return {
        success: false,
        code,
        errorMessage: errors?.message ?? 'تایید پرداخت ناموفق بود',
        rawSanitized: { code },
      };
    } catch (err) {
      const norm = this.normalizeProviderError(err);
      this.logger.warn(`ZarinPal verify error: ${norm.code} ${norm.message}`);
      return { success: false, errorMessage: norm.message };
    }
  }

  async processWebhook(
    _payload: unknown,
  ): Promise<{ supported: boolean; processed?: boolean }> {
    // ZarinPal retail flow uses return-URL verify; no webhook contract wired.
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
    return { success: false, errorMessage: 'refund_not_supported_by_adapter' };
  }

  async reconcile(_input: {
    since: Date;
    sandbox: boolean;
  }): Promise<{ supported: boolean; items?: unknown[] }> {
    return { supported: false };
  }
}
