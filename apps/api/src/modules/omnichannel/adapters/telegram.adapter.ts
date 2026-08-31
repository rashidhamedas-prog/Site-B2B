import { ChannelAdapter, ConnectorDisabledError } from './channel-adapter';
import { areOmnichannelConnectorsEnabled } from '../omnichannel.constants';
import { isAllowedSecretRef } from '../omnichannel-secrets';
import { classifyTelegramHttpError, classifyTelegramThrow } from './telegram-errors';

export const TELEGRAM_API = 'https://api.telegram.org';

export function resolveTelegramToken(secretRef: string): string | null {
  const name = String(secretRef || '').trim();
  if (!isAllowedSecretRef(name) || !name.startsWith('TELEGRAM_')) return null;
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
}

/** Official Telegram Bot API — live calls only when connectors are enabled. */
export class TelegramAdapter implements ChannelAdapter {
  readonly provider = 'TELEGRAM';
  http: typeof fetch = globalThis.fetch.bind(globalThis);

  private async telegramCall<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
    const res = await this.http(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: T };
    if (!res.ok || json.ok === false) {
      const code = classifyTelegramHttpError(res.status, json.description);
      const err = new Error(code) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return json.result as T;
  }

  async validateConnection(secretRef: string): Promise<{ ok: boolean; error?: string }> {
    if (!areOmnichannelConnectorsEnabled()) throw new ConnectorDisabledError(this.provider);
    const token = resolveTelegramToken(secretRef);
    if (!token) return { ok: false, error: 'invalid_credential' };
    try {
      await this.telegramCall(token, 'getMe');
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: classifyTelegramThrow(err) };
    }
  }

  async preview(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!areOmnichannelConnectorsEnabled()) throw new ConnectorDisabledError(this.provider);
    const text = String(input.text || input.body || '');
    return { provider: this.provider, method: 'sendMessage', dryRun: true, textLength: text.length };
  }

  async create(input: Record<string, unknown>): Promise<{ providerMessageId: string }> {
    if (!areOmnichannelConnectorsEnabled()) throw new ConnectorDisabledError(this.provider);
    const token = resolveTelegramToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    if (!token) throw new Error('invalid_credential');
    if (!chatId) throw new Error('destination_missing');
    const result = await this.telegramCall<{ message_id: number }>(token, 'sendMessage', {
      chat_id: chatId,
      text: String(input.text || ''),
      disable_web_page_preview: true,
    });
    return { providerMessageId: String(result.message_id) };
  }

  async update(input: Record<string, unknown>): Promise<{ providerMessageId: string }> {
    if (!areOmnichannelConnectorsEnabled()) throw new ConnectorDisabledError(this.provider);
    const token = resolveTelegramToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    const messageId = String(input.providerMessageId || '');
    if (!token) throw new Error('invalid_credential');
    const result = await this.telegramCall<{ message_id: number }>(token, 'editMessageText', {
      chat_id: chatId,
      message_id: Number(messageId),
      text: String(input.text || ''),
    });
    return { providerMessageId: String(result.message_id) };
  }

  async delete(input: Record<string, unknown>): Promise<void> {
    if (!areOmnichannelConnectorsEnabled()) throw new ConnectorDisabledError(this.provider);
    const token = resolveTelegramToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    const messageId = String(input.providerMessageId || '');
    if (!token) throw new Error('invalid_credential');
    await this.telegramCall(token, 'deleteMessage', {
      chat_id: chatId,
      message_id: Number(messageId),
    });
  }
}
