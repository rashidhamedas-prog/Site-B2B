import { ChannelAdapter, ConnectorDisabledError } from './channel-adapter';
import { areOmnichannelConnectorsEnabled } from '../omnichannel.constants';
import { isAllowedSecretRef } from '../omnichannel-secrets';
import { classifyTelegramHttpError, classifyTelegramThrow } from './telegram-errors';
import {
  TELEGRAM_CAPTION_LIMIT,
  sanitizePhotoUrls,
} from '../publication-template';

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

  private async telegramCall<T>(
    token: string,
    method: string,
    body?: Record<string, unknown>,
    timeoutMs = 12_000,
  ): Promise<T> {
    const res = await this.http(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
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
    const photos = this.photosFrom(input);
    const method = photos.length >= 2 ? 'sendMediaGroup' : photos.length === 1 ? 'sendPhoto' : 'sendMessage';
    return { provider: this.provider, method, dryRun: true, textLength: text.length, photoCount: photos.length };
  }

  async create(input: Record<string, unknown>): Promise<{ providerMessageId: string }> {
    if (!areOmnichannelConnectorsEnabled()) throw new ConnectorDisabledError(this.provider);
    const token = resolveTelegramToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    if (!token) throw new Error('invalid_credential');
    if (!chatId) throw new Error('destination_missing');
    const text = String(input.text || '');
    const photos = this.photosFrom(input);
    const caption = text && text.length <= TELEGRAM_CAPTION_LIMIT ? text : '';
    const overflow = text && !caption ? text : '';
    const ids: string[] = [];
    if (photos.length >= 2) {
      const result = await this.telegramCall<Array<{ message_id: number }>>(token, 'sendMediaGroup', {
        chat_id: chatId,
        media: photos.map((url, index) => ({
          type: 'photo',
          media: url,
          ...(index === 0 && caption ? { caption } : {}),
        })),
      }, 20_000);
      ids.push(...(result || []).map((row) => String(row.message_id)).filter((id) => id && id !== 'undefined'));
    } else if (photos.length === 1) {
      const result = await this.telegramCall<{ message_id: number }>(token, 'sendPhoto', {
        chat_id: chatId,
        photo: photos[0],
        ...(caption ? { caption } : {}),
      }, 20_000);
      ids.push(String(result.message_id));
    } else {
      const result = await this.telegramCall<{ message_id: number }>(token, 'sendMessage', {
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      });
      ids.push(String(result.message_id));
    }
    if (overflow) {
      const extra = await this.telegramCall<{ message_id: number }>(token, 'sendMessage', {
        chat_id: chatId,
        text: overflow,
        disable_web_page_preview: true,
      });
      ids.push(String(extra.message_id));
    }
    return { providerMessageId: ids.filter(Boolean).join(',') };
  }

  async update(input: Record<string, unknown>): Promise<{ providerMessageId: string }> {
    if (!areOmnichannelConnectorsEnabled()) throw new ConnectorDisabledError(this.provider);
    const token = resolveTelegramToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    const messageId = String(input.providerMessageId || '').split(',')[0];
    if (!token) throw new Error('invalid_credential');
    const photos = this.photosFrom(input);
    const text = String(input.text || '');
    const method = photos.length ? 'editMessageCaption' : 'editMessageText';
    const result = await this.telegramCall<{ message_id: number }>(token, method, {
      chat_id: chatId,
      message_id: Number(messageId),
      ...(photos.length ? { caption: text.slice(0, TELEGRAM_CAPTION_LIMIT) } : { text }),
    });
    return { providerMessageId: String(result.message_id) };
  }

  async delete(input: Record<string, unknown>): Promise<void> {
    if (!areOmnichannelConnectorsEnabled()) throw new ConnectorDisabledError(this.provider);
    const token = resolveTelegramToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    if (!token) throw new Error('invalid_credential');
    const ids = String(input.providerMessageId || '').split(',').map((id) => id.trim()).filter(Boolean);
    for (const messageId of ids) {
      await this.telegramCall(token, 'deleteMessage', {
        chat_id: chatId,
        message_id: Number(messageId),
      });
    }
  }

  private photosFrom(input: Record<string, unknown>): string[] {
    const channel = input.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    return sanitizePhotoUrls(channel, input.photoUrls);
  }
}
