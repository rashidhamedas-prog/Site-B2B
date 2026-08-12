/**
 * Provider-agnostic payment adapter contract.
 * Checkout/Order/Orchestrator depend on this — never on a concrete PSP SDK.
 * Amounts are integer IRR (Rial). No BNPL fake APIs belong here.
 */

export type PaymentChannel = 'WHOLESALE' | 'RETAIL';

export type ProviderCapabilities = {
  pay: boolean;
  bnpl: boolean;
  refund: boolean;
  partialRefund: boolean;
  webhook: boolean;
};

export type CreatePaymentRequest = {
  amountIrr: number;
  callbackUrl: string;
  description: string;
  merchantId: string;
  sandbox: boolean;
  mobile?: string;
  email?: string;
  orderId?: string;
  metadata?: Record<string, string | undefined>;
};

export type CreatePaymentResult = {
  providerToken: string;
  redirectUrl: string;
  rawSanitized?: Record<string, unknown>;
};

export type VerifyReturnRequest = {
  amountIrr: number;
  providerToken: string;
  merchantId: string;
  sandbox: boolean;
};

export type VerifyReturnResult = {
  success: boolean;
  alreadyVerified?: boolean;
  providerRefId?: string;
  code?: number;
  rawSanitized?: Record<string, unknown>;
  errorMessage?: string;
};

export type ProviderConfig = {
  merchantId: string;
  sandbox: boolean;
};

export type NormalizedProviderError = {
  code: string;
  retryable: boolean;
  message: string;
  httpStatus?: number;
};

export interface PaymentProviderAdapter {
  readonly code: string;

  getCapabilities(): ProviderCapabilities;

  createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult>;

  verifyReturn(req: VerifyReturnRequest): Promise<VerifyReturnResult>;

  processWebhook(
    payload: unknown,
  ): Promise<{ supported: boolean; processed?: boolean }>;

  getPaymentStatus(
    providerToken: string,
    cfg: ProviderConfig,
  ): Promise<{ status: string }>;

  cancelPayment(
    providerToken: string,
    cfg: ProviderConfig,
  ): Promise<{ cancelled: boolean }>;

  refundPayment(input: {
    providerRefId: string;
    amountIrr: number;
    merchantId: string;
    sandbox: boolean;
  }): Promise<{
    success: boolean;
    providerRefundId?: string;
    errorMessage?: string;
  }>;

  reconcile(input: {
    since: Date;
    sandbox: boolean;
  }): Promise<{ supported: boolean; items?: unknown[] }>;

  normalizeProviderError(err: unknown): NormalizedProviderError;
}
