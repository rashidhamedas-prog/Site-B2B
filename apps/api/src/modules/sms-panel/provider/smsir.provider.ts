import {
  smsIrRequest,
  type SmsTransportConfig,
  type SmsTransportResult,
} from '../../notification/sms-transport';
import type {
  BulkSendResult,
  DeliveryReport,
  InboundMessage,
  SendError,
  SendResult,
  SmsProvider,
} from './types';

export interface SmsIrProviderConfig {
  apiKey: string;
  linePromo?: string;
  lineService?: string;
  transport?: SmsTransportConfig;
  fetchImpl?: typeof fetch;
}

function mapTransportError(result: SmsTransportResult): SendError {
  const code = result.errorCode || 'PROVIDER';
  const retryable =
    code === 'TIMEOUT' ||
    code === 'NETWORK' ||
    code === 'HTTP' ||
    (typeof result.statusCode === 'number' && result.statusCode >= 500);
  const ambiguous = code === 'TIMEOUT' || code === 'NETWORK';
  return {
    code: code === 'DISABLED' ? 'PROVIDER' : (code as SendError['code']),
    retryable,
    ambiguous,
    message: result.errorMessage || code,
  };
}

function messageIdError(id: unknown): SendError | null {
  if (id === 0 || id === '0') {
    return {
      code: 'BLACKLISTED',
      retryable: false,
      ambiguous: false,
      message: 'provider blacklist (messageId=0)',
    };
  }
  if (id == null) {
    return {
      code: 'INVALID_RECIPIENT',
      retryable: false,
      ambiguous: false,
      message: 'invalid recipient (messageId=null)',
    };
  }
  return null;
}

export function packDeliveryPath(packId: string): string {
  return `/send/pack/${encodeURIComponent(packId)}`;
}

export class SmsIrProvider implements SmsProvider {
  readonly id = 'smsir' as const;
  readonly capabilities = {
    maxBatch: 100,
    scheduling: false,
    inbound: true,
    dlrWebhook: false,
  };

  constructor(private readonly cfg: SmsIrProviderConfig) {}

  async sendSingle(req: {
    to: string;
    body: string;
    line?: string;
    idempotencyKey: string;
  }): Promise<SendResult> {
    const bulk = await this.sendBulk({
      to: [req.to],
      body: req.body,
      line: req.line,
      idempotencyKey: req.idempotencyKey,
    });
    const first = bulk.results[0];
    if (first?.error) return { ok: false, error: first.error, packId: bulk.packId };
    if (!bulk.ok) return { ok: false, error: bulk.error, packId: bulk.packId };
    return {
      ok: true,
      providerMessageId: first?.messageId ? String(first.messageId) : undefined,
      packId: bulk.packId,
      cost: bulk.cost,
    };
  }

  async sendBulk(req: {
    to: string[];
    body: string;
    line?: string;
    idempotencyKey: string;
  }): Promise<BulkSendResult> {
    if (req.to.length > this.capabilities.maxBatch) {
      throw new Error(`SMS_BULK_TOO_LARGE: max ${this.capabilities.maxBatch}`);
    }
    const mobiles = req.to;
    if (!req.line) {
      return {
        ok: false,
        results: mobiles.map((to) => ({
          to,
          error: {
            code: 'PROVIDER',
            retryable: false,
            ambiguous: false,
            message: 'LINE_NOT_CONFIGURED',
          },
        })),
        error: {
          code: 'PROVIDER',
          retryable: false,
          ambiguous: false,
          message: 'LINE_NOT_CONFIGURED',
        },
      };
    }
    const result = await smsIrRequest(
      'POST',
      '/send/bulk',
      this.cfg.apiKey,
      {
        lineNumber: req.line,
        messageText: req.body,
        mobiles,
      },
      this.cfg.transport || {},
      this.cfg.fetchImpl || fetch,
    );

    if (!result.ok) {
      return { ok: false, results: mobiles.map((to) => ({ to, error: mapTransportError(result) })), error: mapTransportError(result) };
    }

    const body = result.body as any;
    const ids: Array<string | number | null> = Array.isArray(body?.data?.messageIds)
      ? body.data.messageIds
      : Array.isArray(body?.messageIds)
        ? body.messageIds
        : [];
    const packId =
      body?.data?.packId != null
        ? String(body.data.packId)
        : body?.packId != null
          ? String(body.packId)
          : undefined;
    const costRaw = body?.data?.cost ?? body?.cost;
    const cost = typeof costRaw === 'number' ? costRaw : undefined;

    const results: BulkSendResult['results'] = mobiles.map((to, i) => {
      const mid = ids[i];
      const err = messageIdError(mid);
      if (err) return { to, messageId: mid == null ? null : String(mid), error: err };
      return { to, messageId: mid != null ? String(mid) : undefined };
    });
    const anyOk = results.some((r) => !r.error);
    return { ok: anyOk, results, packId, cost };
  }

  async sendTemplate(req: {
    to: string;
    templateId: string;
    params: Record<string, string>;
  }): Promise<SendResult> {
    const parameters = Object.entries(req.params).map(([name, value]) => ({
      name: name.toUpperCase() === 'CODE' ? 'CODE' : name,
      value: String(value).slice(0, 25),
    }));
    const result = await smsIrRequest(
      'POST',
      '/send/verify',
      this.cfg.apiKey,
      {
        mobile: req.to,
        templateId: Number(req.templateId) || req.templateId,
        parameters,
      },
      this.cfg.transport || {},
      this.cfg.fetchImpl || fetch,
    );
    if (!result.ok) return { ok: false, error: mapTransportError(result) };
    const body = result.body as any;
    const mid = body?.data?.messageId ?? body?.messageId;
    const err = messageIdError(mid);
    if (err) return { ok: false, error: err };
    return {
      ok: true,
      providerMessageId: mid != null ? String(mid) : undefined,
      cost: typeof body?.data?.cost === 'number' ? body.data.cost : 1,
    };
  }

  async getDeliveryStatus(ids: string[]): Promise<DeliveryReport[]> {
    const out: DeliveryReport[] = [];
    for (const id of ids) {
      const path = `/send/${encodeURIComponent(id)}`;
      const result = await smsIrRequest(
        'GET',
        path,
        this.cfg.apiKey,
        undefined,
        this.cfg.transport || {},
        this.cfg.fetchImpl || fetch,
      );
      if (!result.ok) {
        out.push({ id, state: 'UNKNOWN' });
        continue;
      }
      const body = result.body as any;
      const stateRaw = String(body?.data?.deliveryState || body?.data?.state || '').toLowerCase();
      let state: DeliveryReport['state'] = 'PENDING';
      if (stateRaw.includes('deliver')) state = 'DELIVERED';
      else if (stateRaw.includes('undeliver') || stateRaw.includes('fail')) state = 'UNDELIVERED';
      out.push({ id, state, raw: body });
    }
    return out;
  }

  async getPackDelivery(packId: string): Promise<DeliveryReport[]> {
    const result = await smsIrRequest(
      'GET',
      packDeliveryPath(packId),
      this.cfg.apiKey,
      undefined,
      this.cfg.transport || {},
      this.cfg.fetchImpl || fetch,
    );
    if (!result.ok) {
      throw new Error('DLR_PACK_UNAVAILABLE');
    }
    const body = result.body as any;
    const rows: any[] = Array.isArray(body?.data) ? body.data : body?.data ? [body.data] : [];
    return rows.map((row) => {
      const stateRaw = String(row?.deliveryState || row?.state || '').toLowerCase();
      let state: DeliveryReport['state'] = 'PENDING';
      if (stateRaw.includes('deliver') && !stateRaw.includes('undeliver')) state = 'DELIVERED';
      else if (stateRaw.includes('undeliver') || stateRaw.includes('fail')) state = 'UNDELIVERED';
      else state = 'UNKNOWN';
      return { id: String(row?.messageId || row?.id || packId), state, raw: row };
    });
  }

  async getCredit(): Promise<{ amount: number; unit: 'CREDIT' | 'IRR' | 'SMS' }> {
    const result = await smsIrRequest(
      'GET',
      '/credit',
      this.cfg.apiKey,
      undefined,
      this.cfg.transport || {},
      this.cfg.fetchImpl || fetch,
    );
    if (!result.ok) return { amount: 0, unit: 'SMS' };
    const body = result.body as any;
    const amount = Number(body?.data ?? body?.credit ?? 0) || 0;
    return { amount, unit: 'SMS' };
  }

  async fetchInbound(since: Date): Promise<InboundMessage[]> {
    const result = await smsIrRequest(
      'GET',
      '/receive/live',
      this.cfg.apiKey,
      undefined,
      this.cfg.transport || {},
      this.cfg.fetchImpl || fetch,
    );
    if (!result.ok) return [];
    const body = result.body as any;
    const rows: any[] = Array.isArray(body?.data) ? body.data : [];
    const sinceMs = since.getTime();
    return rows
      .map((r) => ({
        providerId: String(r?.messageId ?? r?.id ?? `${r?.mobile}-${r?.receivedDateTime}`),
        from: String(r?.mobile || r?.from || ''),
        body: String(r?.messageText || r?.body || ''),
        receivedAt: r?.receivedDateTime ? new Date(r.receivedDateTime) : new Date(),
      }))
      .filter((m) => m.receivedAt.getTime() >= sinceMs);
  }
}
