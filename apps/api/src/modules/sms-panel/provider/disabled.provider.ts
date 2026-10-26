import type {
  BulkSendResult,
  DeliveryReport,
  InboundMessage,
  SendResult,
  SmsProvider,
} from './types';

const DISABLED = {
  code: 'DISABLED' as const,
  retryable: false,
  ambiguous: false,
  message: 'SMS provider disabled or API key missing',
};

/** Used when SMSIR is selected but no key is configured — never pretends success. */
export class DisabledSmsProvider implements SmsProvider {
  readonly id = 'disabled' as const;
  readonly capabilities = {
    maxBatch: 100,
    scheduling: false,
    inbound: false,
    dlrWebhook: false,
  };

  async sendSingle(_req?: {
    to: string;
    body: string;
    line?: string;
    idempotencyKey: string;
  }): Promise<SendResult> {
    return { ok: false, error: { ...DISABLED } };
  }

  async sendBulk(req: {
    to: string[];
    body?: string;
    line?: string;
    idempotencyKey?: string;
  }): Promise<BulkSendResult> {
    return {
      ok: false,
      results: (req.to || []).map((to) => ({ to, error: { ...DISABLED } })),
      error: { ...DISABLED },
    };
  }

  async sendTemplate(_req?: {
    to: string;
    templateId: string;
    params: Record<string, string>;
  }): Promise<SendResult> {
    return { ok: false, error: { ...DISABLED } };
  }

  async getDeliveryStatus(ids: string[]): Promise<DeliveryReport[]> {
    return ids.map((id) => ({ id, state: 'UNKNOWN' as const }));
  }

  async getCredit(): Promise<{ amount: number; unit: 'CREDIT' | 'IRR' | 'SMS' }> {
    return { amount: 0, unit: 'SMS' };
  }

  async fetchInbound(_since: Date): Promise<InboundMessage[]> {
    return [];
  }
}
