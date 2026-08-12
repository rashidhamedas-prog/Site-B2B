import { Injectable } from '@nestjs/common';
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

/**
 * Fail-closed adapter for DISABLED / NOT_APPROVED / BNPL-blocked providers.
 * Never fabricates success, tokens, or sandbox BNPL APIs.
 */
@Injectable()
export class DisabledPaymentAdapter implements PaymentProviderAdapter {
  constructor(readonly code: string = 'DISABLED') {}

  getCapabilities(): ProviderCapabilities {
    return {
      pay: false,
      bnpl: false,
      refund: false,
      partialRefund: false,
      webhook: false,
    };
  }

  private fail(): never {
    throw new Error(`درگاه ${this.code} غیرفعال یا تأییدنشده است`);
  }

  async createPayment(_req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    this.fail();
  }

  async verifyReturn(_req: VerifyReturnRequest): Promise<VerifyReturnResult> {
    this.fail();
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
    this.fail();
  }

  async cancelPayment(
    _providerToken: string,
    _cfg: ProviderConfig,
  ): Promise<{ cancelled: boolean }> {
    this.fail();
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
    this.fail();
  }

  async reconcile(_input: {
    since: Date;
    sandbox: boolean;
  }): Promise<{ supported: boolean; items?: unknown[] }> {
    return { supported: false };
  }

  normalizeProviderError(err: unknown): NormalizedProviderError {
    return {
      code: 'PROVIDER_DISABLED',
      retryable: false,
      message: err instanceof Error ? err.message : 'درگاه غیرفعال است',
    };
  }
}
