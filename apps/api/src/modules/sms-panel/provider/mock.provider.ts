import type {
  BulkSendResult,
  DeliveryReport,
  InboundMessage,
  SendResult,
  SmsProvider,
} from './types';

export type MockScenario =
  | 'success'
  | 'timeout'
  | 'blacklist'
  | 'invalid'
  | 'http5xx'
  | 'rate_limited'
  | 'provider';

/**
 * Deterministic, programmable mock. No network.
 * Default scenario: success.
 */
export class MockSmsProvider implements SmsProvider {
  readonly id = 'mock' as const;
  readonly capabilities = {
    maxBatch: 100,
    scheduling: false,
    inbound: true,
    dlrWebhook: false,
  };

  credit = 12_450;
  scenario: MockScenario = 'success';
  /** Per-phone override */
  phoneScenario = new Map<string, MockScenario>();
  inbound: InboundMessage[] = [];
  sent: Array<{ to: string; body: string; at: Date; key: string }> = [];
  private seq = 0;

  setScenario(s: MockScenario) {
    this.scenario = s;
  }

  setPhoneScenario(phone: string, s: MockScenario) {
    this.phoneScenario.set(phone, s);
  }

  private nextId(): string {
    this.seq += 1;
    return `mock-${this.seq}`;
  }

  private resolve(phone?: string): MockScenario {
    if (phone && this.phoneScenario.has(phone)) return this.phoneScenario.get(phone)!;
    return this.scenario;
  }

  private fromScenario(s: MockScenario, phone?: string): SendResult {
    switch (s) {
      case 'success':
        return { ok: true, providerMessageId: this.nextId(), cost: 1 };
      case 'timeout':
        return {
          ok: false,
          error: {
            code: 'TIMEOUT',
            retryable: true,
            ambiguous: true,
            message: 'mock timeout',
          },
        };
      case 'blacklist':
        return {
          ok: false,
          error: {
            code: 'BLACKLISTED',
            retryable: false,
            ambiguous: false,
            message: `blacklisted:${phone || ''}`,
          },
        };
      case 'invalid':
        return {
          ok: false,
          error: {
            code: 'INVALID_RECIPIENT',
            retryable: false,
            ambiguous: false,
            message: 'invalid recipient',
          },
        };
      case 'http5xx':
        return {
          ok: false,
          error: {
            code: 'HTTP',
            retryable: true,
            ambiguous: false,
            message: 'mock 5xx',
          },
        };
      case 'rate_limited':
        return {
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            retryable: true,
            ambiguous: false,
            message: 'mock rate limit',
          },
        };
      default:
        return {
          ok: false,
          error: {
            code: 'PROVIDER',
            retryable: false,
            ambiguous: false,
            message: 'mock provider error',
          },
        };
    }
  }

  async sendSingle(req: {
    to: string;
    body: string;
    line?: string;
    idempotencyKey: string;
  }): Promise<SendResult> {
    const result = this.fromScenario(this.resolve(req.to), req.to);
    if (result.ok) {
      this.sent.push({ to: req.to, body: req.body, at: new Date(), key: req.idempotencyKey });
      this.credit = Math.max(0, this.credit - (result.cost || 1));
    }
    return result;
  }

  async sendBulk(req: {
    to: string[];
    body: string;
    line?: string;
    idempotencyKey: string;
  }): Promise<BulkSendResult> {
    const to = req.to.slice(0, this.capabilities.maxBatch);
    const results = [];
    let anyOk = false;
    let cost = 0;
    for (const phone of to) {
      const r = await this.sendSingle({
        to: phone,
        body: req.body,
        line: req.line,
        idempotencyKey: `${req.idempotencyKey}:${phone}`,
      });
      if (r.ok) {
        anyOk = true;
        cost += r.cost || 1;
        results.push({ to: phone, messageId: r.providerMessageId });
      } else {
        results.push({ to: phone, messageId: null, error: r.error });
      }
    }
    return {
      ok: anyOk,
      results,
      packId: anyOk ? `pack-${this.nextId()}` : undefined,
      cost,
      error: anyOk ? undefined : results[0]?.error,
    };
  }

  async sendTemplate(req: {
    to: string;
    templateId: string;
    params: Record<string, string>;
  }): Promise<SendResult> {
    const body = `tpl:${req.templateId}:${JSON.stringify(req.params)}`;
    return this.sendSingle({
      to: req.to,
      body,
      idempotencyKey: `tpl:${req.templateId}:${req.to}`,
    });
  }

  async getDeliveryStatus(ids: string[]): Promise<DeliveryReport[]> {
    return ids.map((id) => ({ id, state: 'DELIVERED' as const, at: new Date() }));
  }

  async getCredit(): Promise<{ amount: number; unit: 'CREDIT' | 'IRR' | 'SMS' }> {
    return { amount: this.credit, unit: 'SMS' };
  }

  async fetchInbound(_since: Date): Promise<InboundMessage[]> {
    return [...this.inbound];
  }
}
