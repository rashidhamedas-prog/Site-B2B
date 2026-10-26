export type SmsProviderId = 'smsir' | 'mock' | string;

export type SendErrorCode =
  | 'TIMEOUT'
  | 'NETWORK'
  | 'HTTP'
  | 'PROVIDER'
  | 'INVALID_RECIPIENT'
  | 'BLACKLISTED'
  | 'RATE_LIMITED'
  | 'PARSE'
  | 'DISABLED';

export interface SendError {
  code: SendErrorCode;
  retryable: boolean;
  ambiguous: boolean;
  message: string;
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  packId?: string;
  /** Provider cost treated as SMS parts (not IRR). */
  cost?: number;
  error?: SendError;
}

export interface BulkSendResult {
  ok: boolean;
  results: Array<{ to: string; messageId?: string | null | undefined; error?: SendError }>;
  packId?: string;
  cost?: number;
  error?: SendError;
}

export interface DeliveryReport {
  id: string;
  state: 'UNKNOWN' | 'DELIVERED' | 'UNDELIVERED' | 'PENDING' | 'FAILED';
  at?: Date;
  raw?: unknown;
}

export interface InboundMessage {
  providerId: string;
  from: string;
  body: string;
  receivedAt: Date;
}

export interface SmsProvider {
  readonly id: SmsProviderId;
  sendSingle(req: {
    to: string;
    body: string;
    line?: string;
    idempotencyKey: string;
  }): Promise<SendResult>;
  sendBulk(req: {
    to: string[];
    body: string;
    line?: string;
    idempotencyKey: string;
  }): Promise<BulkSendResult>;
  sendTemplate(req: {
    to: string;
    templateId: string;
    params: Record<string, string>;
  }): Promise<SendResult>;
  getDeliveryStatus(ids: string[]): Promise<DeliveryReport[]>;
  getCredit(): Promise<{ amount: number; unit: 'CREDIT' | 'IRR' | 'SMS' }>;
  fetchInbound(since: Date): Promise<InboundMessage[]>;
  readonly capabilities: {
    maxBatch: number;
    scheduling: boolean;
    inbound: boolean;
    dlrWebhook: boolean;
  };
}
