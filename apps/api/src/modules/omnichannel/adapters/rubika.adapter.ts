import {
  ChannelAdapter,
  ConnectorDisabledError,
  type DestinationInspection,
  type DiscoveredChat,
} from './channel-adapter';
import { isOmnichannelProviderEnabled } from '../omnichannel.constants';
import { redactProviderError } from './telegram-errors';
import { resolveProviderToken, telegramSendOptions } from './telegram.adapter';
import {
  RUBIKA_METADATA_LIMIT,
  canonicalToPlain,
  canonicalToRubika,
  type RubikaMetadataPart,
} from './rich-text';
import { sanitizePhotoUrls, type TemplateButton } from '../publication-template';

/**
 * Official Rubika Bot API v3 (https://rubika.ir/botapi). Verified against the docs on 2026-09-06:
 *  - POST https://botapi.rubika.ir/v3/{token}/{method}; body JSON; reply `{ status, data }`.
 *  - sendMessage(chat_id, text, metadata{meta_data_parts[]}, inline_keypad, disable_notification).
 *    metadata offsets are UTF-16 (JS string units), max 30 parts, one bad part fails the message.
 *  - Photos: requestSendFile{type:'Image'} → upload_url → multipart `file` → file_id → sendFile.
 *    sendFile has no metadata field, so captions are plain. No album method exists.
 *  - editMessageText(chat_id, message_id, text) and deleteMessage(chat_id, message_id).
 *  - getChat(chat_id) → chat{chat_type: User|Group|Channel, title, username}; no getChatMember,
 *    so posting rights are proven with a test post.
 *  - getUpdates(limit, offset_id) → { updates[{chat_id, new_message}], next_offset_id }.
 *  - Button model documents no URL field, so buttons become `🔗 label: url` lines with a Link part.
 */
export const RUBIKA_API = 'https://botapi.rubika.ir/v3';
export const RUBIKA_TEXT_LIMIT = 4096;
export const RUBIKA_IMAGE_LIMIT_BYTES = 10 * 1024 * 1024;

export function resolveRubikaToken(secretRef: string): string | null {
  return resolveProviderToken('RUBIKA', secretRef);
}

/** Channel/group/user is encoded in the id prefix (c0…, g0…, u0…, b0…). */
export function rubikaChatTypeFromId(chatId: string): string {
  const id = String(chatId || '').trim();
  if (/^c0/i.test(id)) return 'channel';
  if (/^g0/i.test(id)) return 'group';
  if (/^u0/i.test(id)) return 'private';
  if (/^b0/i.test(id)) return 'bot';
  return 'unknown';
}

export type RubikaMessage = { text: string; parts: RubikaMetadataPart[] };

/**
 * Canonical HTML → Rubika text + metadata. Buttons are appended as `🔗 label: url` lines where
 * the label carries an official `Link` part; the raw URL stays visible so it survives clients
 * that ignore metadata. Parts are dropped (never truncated) past the 30-part limit.
 */
export function rubikaMessage(text: string, parseMode: unknown, buttons: TemplateButton[]): RubikaMessage {
  const base = parseMode === 'HTML' ? canonicalToRubika(text) : { text: String(text || ''), parts: [] as RubikaMetadataPart[] };
  let body = base.text;
  const parts = [...base.parts];
  for (const button of buttons) {
    const prefix = `${body ? '\n\n' : ''}🔗 `;
    const labelStart = body.length + prefix.length;
    body += `${prefix}${button.label}: ${button.url}`;
    if (parts.length < RUBIKA_METADATA_LIMIT) {
      parts.push({ type: 'Link', from_index: labelStart, length: button.label.length, link_url: button.url });
    }
  }
  if (body.length > RUBIKA_TEXT_LIMIT) {
    body = body.slice(0, RUBIKA_TEXT_LIMIT);
    return { text: body, parts: parts.filter((part) => part.from_index + part.length <= body.length) };
  }
  return { text: body, parts };
}

/** Plain caption for sendFile (no metadata support): bold stripped, link lines kept. */
export function rubikaCaption(text: string, parseMode: unknown, buttons: TemplateButton[]): string {
  const plain = parseMode === 'HTML' ? canonicalToPlain(text) : String(text || '');
  const lines = buttons.map((button) => `🔗 ${button.label}: ${button.url}`);
  return `${plain}${plain && lines.length ? '\n\n' : ''}${lines.join('\n')}`.slice(0, RUBIKA_TEXT_LIMIT);
}

/** `status` other than OK is the failure signal; HTTP code is a fallback for gateways. */
export function classifyRubikaFailure(httpStatus: number, status: string | undefined): string {
  const code = String(status || '').toUpperCase();
  if (httpStatus === 401 || httpStatus === 403 || /INVALID_ACCESS|UNAUTHORIZED|INVALID_AUTH|TOKEN/.test(code)) return 'invalid_credential';
  if (httpStatus === 429 || /TOO_REQUESTS|RATE/.test(code)) return 'rate_limited';
  if (httpStatus >= 500 || /INTERNAL|SERVER/.test(code)) return 'provider_unavailable';
  if (httpStatus === 404) return 'validate_failed';
  if (/INVALID_INPUT|NOT_FOUND|INVALID_CHAT|CHAT/.test(code)) return 'validate_failed';
  return httpStatus >= 400 || code ? 'validate_failed' : 'provider_unavailable';
}

export function classifyRubikaThrow(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err || '');
  if (/invalid_credential|rate_limited|provider_unavailable|validate_failed|chat_not_found|destination_missing/.test(message)) return message;
  if (/abort|timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(message)) return 'provider_unavailable';
  return 'provider_unavailable';
}

type RubikaChat = {
  chat_id?: string;
  chat_type?: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  username?: string;
};
type RubikaBot = { bot_id?: string; bot_title?: string; username?: string };
type RubikaUpdate = { type?: string; chat_id?: string; new_message?: { sender_type?: string; forwarded_from?: { type_from?: string; from_chat_id?: string } } };

export class RubikaAdapter implements ChannelAdapter {
  readonly provider = 'RUBIKA';
  http: typeof fetch = globalThis.fetch.bind(globalThis);

  private assertEnabled() {
    if (!isOmnichannelProviderEnabled(this.provider)) throw new ConnectorDisabledError(this.provider);
  }

  private async rubikaCall<T>(
    token: string,
    method: string,
    body: Record<string, unknown> = {},
    timeoutMs = 12_000,
  ): Promise<T> {
    const res = await this.http(`${RUBIKA_API}/${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await res.json().catch(() => ({}))) as { status?: string; data?: T; dev_message?: string; message?: string };
    const status = String(json.status || '').toUpperCase();
    if (!res.ok || (status && status !== 'OK')) {
      const code = classifyRubikaFailure(res.status, status);
      const err = new Error(code) as Error & { status?: number; description?: string };
      err.status = res.status;
      err.description = redactProviderError(`${status} ${json.dev_message || json.message || ''}`.trim());
      throw err;
    }
    return (json.data ?? (json as unknown)) as T;
  }

  async validateConnection(secretRef: string): Promise<{ ok: boolean; error?: string }> {
    this.assertEnabled();
    return this.probeCredential(secretRef);
  }

  async probeCredential(secretRef: string): Promise<{ ok: boolean; error?: string }> {
    const token = resolveRubikaToken(secretRef);
    if (!token) return { ok: false, error: 'invalid_credential' };
    try {
      await this.rubikaCall<{ bot?: RubikaBot }>(token, 'getMe');
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: classifyRubikaThrow(err) };
    }
  }

  /** getChat only: Rubika has no getChatMember, so the admin proves posting rights with a test post. */
  async inspectDestination(secretRef: string, chatId: string): Promise<DestinationInspection> {
    this.assertEnabled();
    const token = resolveRubikaToken(secretRef);
    const target = String(chatId || '').trim();
    if (!token) return { ok: false, error: 'invalid_credential' };
    if (!target) return { ok: false, error: 'destination_missing' };
    try {
      const me = await this.rubikaCall<{ bot?: RubikaBot }>(token, 'getMe');
      const result = await this.rubikaCall<{ chat?: RubikaChat }>(token, 'getChat', { chat_id: target });
      const chat = result.chat || {};
      const chatType = String(chat.chat_type || '').toLowerCase() || rubikaChatTypeFromId(target);
      const isPrivate = chatType === 'user' || chatType === 'private';
      return {
        ok: true,
        chatType: isPrivate ? 'private' : chatType,
        title: String(chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || '').slice(0, 120) || undefined,
        username: chat.username ? String(chat.username).slice(0, 64) : null,
        botUsername: me.bot?.username ? String(me.bot.username).slice(0, 64) : undefined,
        memberCount: null,
        botIsAdmin: isPrivate ? false : undefined,
        canPost: isPrivate ? true : undefined,
        canEdit: isPrivate ? true : undefined,
        canDelete: isPrivate ? true : undefined,
        permissionCheck: isPrivate ? 'api' : 'test_post',
      };
    } catch (err: unknown) {
      const code = classifyRubikaThrow(err);
      return { ok: false, error: code === 'validate_failed' ? 'chat_not_found' : code };
    }
  }

  /** Recent updates → unique non-user chat ids; titles resolved with getChat for the first few. */
  async discoverChats(secretRef: string): Promise<{ ok: boolean; error?: string; chats: DiscoveredChat[] }> {
    this.assertEnabled();
    const token = resolveRubikaToken(secretRef);
    if (!token) return { ok: false, error: 'invalid_credential', chats: [] };
    try {
      const result = await this.rubikaCall<{ updates?: RubikaUpdate[] }>(token, 'getUpdates', { limit: 100 });
      const seen = new Map<string, DiscoveredChat>();
      for (const update of [...(result.updates || [])].reverse()) {
        const forwarded = update.new_message?.forwarded_from;
        if (forwarded?.from_chat_id && String(forwarded.type_from || '').toLowerCase() === 'channel') {
          const id = String(forwarded.from_chat_id);
          if (!seen.has(id)) seen.set(id, { chatId: id, chatType: 'channel', via: 'forward', username: null });
        }
        const id = String(update.chat_id || '').trim();
        if (!id || seen.has(id)) continue;
        const chatType = rubikaChatTypeFromId(id);
        if (chatType === 'private' || chatType === 'bot') continue;
        seen.set(id, { chatId: id, chatType, via: 'message', username: null });
      }
      const chats = [...seen.values()];
      await Promise.all(
        chats.slice(0, 6).map(async (row) => {
          try {
            const info = await this.rubikaCall<{ chat?: RubikaChat }>(token, 'getChat', { chat_id: row.chatId });
            row.title = String(info.chat?.title || '').slice(0, 120) || undefined;
            row.username = info.chat?.username ? String(info.chat.username).slice(0, 64) : null;
            if (info.chat?.chat_type) row.chatType = String(info.chat.chat_type).toLowerCase();
          } catch {
            /* title is optional */
          }
        }),
      );
      return { ok: true, chats };
    } catch (err: unknown) {
      return { ok: false, error: classifyRubikaThrow(err), chats: [] };
    }
  }

  async preview(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.assertEnabled();
    const photos = this.photosFrom(input);
    const opts = telegramSendOptions(input);
    const message = rubikaMessage(String(input.text || ''), input.parseMode, opts.buttons);
    return {
      provider: this.provider,
      method: photos.length ? 'sendFile' : 'sendMessage',
      dryRun: true,
      textLength: message.text.length,
      metadataParts: photos.length ? 0 : message.parts.length,
      photoCount: Math.min(photos.length, 1),
      droppedPhotos: Math.max(0, photos.length - 1),
    };
  }

  async create(input: Record<string, unknown>): Promise<{ providerMessageId: string }> {
    this.assertEnabled();
    const token = resolveRubikaToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    if (!token) throw new Error('invalid_credential');
    if (!chatId) throw new Error('destination_missing');
    const opts = telegramSendOptions(input);
    const photos = this.photosFrom(input);
    const silent = opts.silent ? { disable_notification: true } : {};
    if (photos.length) {
      const fileId = await this.uploadImage(token, photos[0]);
      if (fileId) {
        const sent = await this.rubikaCall<{ message_id?: string }>(token, 'sendFile', {
          chat_id: chatId,
          file_id: fileId,
          text: rubikaCaption(String(input.text || ''), input.parseMode, opts.buttons),
          ...silent,
        }, 20_000);
        return { providerMessageId: String(sent.message_id || '') };
      }
    }
    const message = rubikaMessage(String(input.text || ''), input.parseMode, opts.buttons);
    const sent = await this.rubikaCall<{ message_id?: string }>(token, 'sendMessage', {
      chat_id: chatId,
      text: message.text,
      ...(message.parts.length ? { metadata: { meta_data_parts: message.parts } } : {}),
      ...silent,
    });
    return { providerMessageId: String(sent.message_id || '') };
  }

  /**
   * editMessageText carries no metadata, so an edit keeps the words and drops bold; for file
   * messages it edits the caption text the same way (Message.text is the caption in the docs).
   */
  async update(input: Record<string, unknown>): Promise<{ providerMessageId: string }> {
    this.assertEnabled();
    const token = resolveRubikaToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    const messageId = String(input.providerMessageId || '').split(',')[0]?.trim() || '';
    if (!token) throw new Error('invalid_credential');
    if (!messageId) throw new Error('provider_message_missing');
    const opts = telegramSendOptions(input);
    await this.rubikaCall(token, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: rubikaCaption(String(input.text || ''), input.parseMode, opts.buttons),
    });
    return { providerMessageId: messageId };
  }

  async delete(input: Record<string, unknown>): Promise<void> {
    this.assertEnabled();
    const token = resolveRubikaToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    if (!token) throw new Error('invalid_credential');
    const ids = String(input.providerMessageId || '').split(',').map((id) => id.trim()).filter(Boolean);
    for (const messageId of ids) {
      try {
        await this.rubikaCall(token, 'deleteMessage', { chat_id: chatId, message_id: messageId });
      } catch (err: unknown) {
        const description = err && typeof err === 'object' ? String((err as { description?: string }).description || '') : '';
        if (/NOT_FOUND|INVALID_INPUT/i.test(description)) continue;
        throw err;
      }
    }
  }

  /** Download our own public image, then requestSendFile → upload_url → multipart → file_id. */
  private async uploadImage(token: string, url: string): Promise<string | null> {
    const source = await this.http(url, { signal: AbortSignal.timeout(15_000) });
    if (!source.ok) return null;
    const contentType = String(source.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!/^image\/(jpeg|jpg|png|gif|webp)$/i.test(contentType)) return null;
    const bytes = new Uint8Array(await source.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > RUBIKA_IMAGE_LIMIT_BYTES) return null;
    const ticket = await this.rubikaCall<{ upload_url?: string }>(token, 'requestSendFile', { type: 'Image' });
    const uploadUrl = String(ticket.upload_url || '');
    if (!/^https:\/\//i.test(uploadUrl)) return null;
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: contentType }), `photo.${ext}`);
    const res = await this.http(uploadUrl, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
    const json = (await res.json().catch(() => ({}))) as { status?: string; data?: { file_id?: string }; file_id?: string };
    if (!res.ok) throw new Error(classifyRubikaFailure(res.status, json.status));
    const fileId = String(json.data?.file_id || json.file_id || '').trim();
    return fileId || null;
  }

  private photosFrom(input: Record<string, unknown>): string[] {
    const channel = input.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    return sanitizePhotoUrls(channel, input.photoUrls);
  }
}
