import { Logger } from '@nestjs/common';
import {
  ChannelAdapter,
  ConnectorDisabledError,
  type DestinationInspection,
  type DiscoveredChat,
} from './channel-adapter';
import { isOmnichannelProviderEnabled } from '../omnichannel.constants';
import { canonicalToBaleMarkdown } from './rich-text';
import { classifyTelegramHttpError, classifyTelegramThrow, redactProviderError } from './telegram-errors';
import {
  chatsFromUpdates,
  inlineKeyboard,
  resolveProviderToken,
  telegramSendOptions,
  type OwnedImageReader,
  type UpdateLike,
} from './telegram.adapter';
import { BALE_API_DEFAULT, resolveMessengerApiBase } from '../provider-egress';
import { sanitizePhotoUrls } from '../publication-template';
import { channelDerivativeKey } from '../../upload/storage-delete';
import { isCompleteJpeg } from '../../upload/channel-image';
import {
  BALE_UPLOAD_TIMEOUT_MS,
  baleMediaUploadMode,
  buildBaleAlbumForm,
  buildBalePhotoForm,
  prepareBaleUpload,
  type PreparedBalePhoto,
} from './bale-media';
import {
  loadOwnedPhotoBytes,
  ownedProductMediaKey,
  TELEGRAM_PHOTO_FETCH_TIMEOUT_MS,
} from './telegram-media';

/**
 * Official Bale Bot API (https://docs.bale.ai). Same request/response envelope as Telegram
 * (`ok` / `result` / `description`), but:
 *  - every text is Markdown; there is no parse-mode parameter. `*bold*` needs a space on both sides.
 *  - sendPhoto/sendMessage accept only chat_id, text|photo, caption, reply_to_message_id, reply_markup.
 *  - InputMediaPhoto.caption is capped at 1024 while sendPhoto caption allows 4096.
 *  - sendMediaGroup has no reply_markup (buttons ride on a follow-up text message).
 *  - deleteMessage only works for messages younger than 48 hours.
 *  - getChatMembersCount (plural) instead of getChatMemberCount.
 * Runtime base: `resolveMessengerApiBase('BALE')` (`BALE_API_URL` or this default).
 */
export const BALE_API = 'https://tapi.bale.ai';
if (BALE_API !== BALE_API_DEFAULT) throw new Error('bale_api_default_mismatch');
export const BALE_ALBUM_CAPTION_LIMIT = 1024;
export const BALE_TEXT_LIMIT = 4096;

export function resolveBaleToken(secretRef: string): string | null {
  return resolveProviderToken('BALE', secretRef);
}

/** Bale renders Markdown for every message, so even PLAIN copy must have its `*`/`_` neutralised. */
export function baleText(text: string, parseMode: unknown): string {
  return canonicalToBaleMarkdown(parseMode === 'HTML' ? text : text.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
}

type BaleChat = { id?: number | string; type?: string; title?: string; username?: string; first_name?: string };
type BaleChatMember = {
  status?: string;
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_delete_messages?: boolean;
};

export class BaleAdapter implements ChannelAdapter {
  readonly provider = 'BALE';
  private readonly logger = new Logger(BaleAdapter.name);
  http: typeof fetch = globalThis.fetch.bind(globalThis);
  /** Set by the Nest factory. Tests leave this null and stub `photoLoader` when they need bytes. */
  images: OwnedImageReader | null = null;
  photoLoader: ((url: string) => Promise<Buffer>) | null = null;

  private assertEnabled() {
    if (!isOmnichannelProviderEnabled(this.provider)) throw new ConnectorDisabledError(this.provider);
  }

  private async baleCall<T>(
    token: string,
    method: string,
    body?: Record<string, unknown> | FormData,
    timeoutMs = 12_000,
  ): Promise<T> {
    const form = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await this.http(`${resolveMessengerApiBase('BALE')}/bot${token}/${method}`, {
      method: 'POST',
      headers: form ? undefined : { 'Content-Type': 'application/json' },
      body: form ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: T };
    if (!res.ok || json.ok === false) {
      const code = classifyTelegramHttpError(res.status, json.description);
      const err = new Error(code) as Error & { status?: number; description?: string; telegramCode?: string };
      err.status = res.status;
      err.description = redactProviderError(String(json.description || ''));
      err.telegramCode = code;
      throw err;
    }
    return json.result as T;
  }

  async validateConnection(secretRef: string): Promise<{ ok: boolean; error?: string }> {
    this.assertEnabled();
    return this.probeCredential(secretRef);
  }

  async probeCredential(secretRef: string): Promise<{ ok: boolean; error?: string }> {
    const token = resolveBaleToken(secretRef);
    if (!token) return { ok: false, error: 'invalid_credential' };
    try {
      await this.baleCall(token, 'getMe');
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: classifyTelegramThrow(err) };
    }
  }

  async inspectDestination(secretRef: string, chatId: string): Promise<DestinationInspection> {
    this.assertEnabled();
    const token = resolveBaleToken(secretRef);
    const target = String(chatId || '').trim();
    if (!token) return { ok: false, error: 'invalid_credential' };
    if (!target) return { ok: false, error: 'destination_missing' };
    try {
      const me = await this.baleCall<{ id: number; username?: string }>(token, 'getMe');
      const chat = await this.baleCall<BaleChat>(token, 'getChat', { chat_id: target });
      const chatType = String(chat.type || '').toLowerCase();
      const out: DestinationInspection = {
        ok: true,
        chatType,
        title: String(chat.title || chat.first_name || '').slice(0, 120) || undefined,
        username: chat.username ? String(chat.username).slice(0, 64) : null,
        botUsername: me.username ? String(me.username).slice(0, 64) : undefined,
        memberCount: null,
        permissionCheck: 'api',
      };
      if (chatType === 'private') {
        out.botIsAdmin = false;
        out.canPost = true;
        out.canEdit = true;
        out.canDelete = true;
        return out;
      }
      try {
        const member = await this.baleCall<BaleChatMember>(token, 'getChatMember', { chat_id: target, user_id: me.id });
        const status = String(member.status || '').toLowerCase();
        const owner = status === 'creator' || status === 'owner';
        const admin = owner || status === 'administrator';
        out.botIsAdmin = admin;
        if (chatType === 'channel') {
          out.canPost = owner || (admin && member.can_post_messages === true);
          out.canEdit = owner || (admin && member.can_edit_messages === true);
        } else {
          out.canPost = admin || status === 'member';
          out.canEdit = admin;
        }
        out.canDelete = owner || (admin && member.can_delete_messages === true);
      } catch (memberErr: unknown) {
        const code = classifyTelegramThrow(memberErr);
        return {
          ...out,
          ok: false,
          botIsAdmin: false,
          canPost: false,
          canEdit: false,
          canDelete: false,
          error: code,
        };
      }
      try {
        const count = await this.baleCall<number>(token, 'getChatMembersCount', { chat_id: target });
        out.memberCount = Number.isFinite(Number(count)) ? Number(count) : null;
      } catch {
        out.memberCount = null;
      }
      return out;
    } catch (err: unknown) {
      const code = classifyTelegramThrow(err);
      const description = err && typeof err === 'object' ? String((err as { description?: string }).description || '') : '';
      return { ok: false, error: code === 'validate_failed' && /not found/i.test(description) ? 'chat_not_found' : code };
    }
  }

  async discoverChats(secretRef: string): Promise<{ ok: boolean; error?: string; chats: DiscoveredChat[] }> {
    this.assertEnabled();
    const token = resolveBaleToken(secretRef);
    if (!token) return { ok: false, error: 'invalid_credential', chats: [] };
    try {
      const updates = await this.baleCall<UpdateLike[]>(token, 'getUpdates', { limit: 100 });
      return { ok: true, chats: chatsFromUpdates(Array.isArray(updates) ? updates : []) };
    } catch (err: unknown) {
      const description = err && typeof err === 'object' ? String((err as { description?: string }).description || '') : '';
      return { ok: false, error: /webhook/i.test(description) ? 'webhook_active' : classifyTelegramThrow(err), chats: [] };
    }
  }

  async preview(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.assertEnabled();
    const photos = this.photosFrom(input);
    const method = photos.length >= 2 ? 'sendMediaGroup' : photos.length === 1 ? 'sendPhoto' : 'sendMessage';
    return { provider: this.provider, method, dryRun: true, textLength: baleText(String(input.text || ''), input.parseMode).length, photoCount: photos.length };
  }

  async create(input: Record<string, unknown>): Promise<{ providerMessageId: string; warnings?: string[] }> {
    this.assertEnabled();
    const warnings: string[] = [];
    const token = resolveBaleToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    if (!token) throw new Error('invalid_credential');
    if (!chatId) throw new Error('destination_missing');
    const text = baleText(String(input.text || ''), input.parseMode).slice(0, BALE_TEXT_LIMIT);
    const photos = this.photosFrom(input);
    const opts = telegramSendOptions(input);
    const keyboard = inlineKeyboard(opts.buttons);
    const ids: string[] = [];
    let keyboardAttached = false;
    let overflow = '';
    const uploadMode = photos.length > 0 && baleMediaUploadMode() === 'upload';

    if (uploadMode) {
      const prepared = await this.prepareOwnedPhotosForUpload(photos, warnings);
      if (prepared.length >= 2) {
        const caption = text.length <= BALE_ALBUM_CAPTION_LIMIT ? text : '';
        overflow = caption ? '' : text;
        const result = await this.baleCall<Array<{ message_id: number }>>(
          token,
          'sendMediaGroup',
          buildBaleAlbumForm({ chatId, photos: prepared, caption: caption || undefined }),
          BALE_UPLOAD_TIMEOUT_MS,
        );
        ids.push(...(result || []).map((row) => String(row.message_id)).filter((id) => id && id !== 'undefined'));
      } else if (prepared.length === 1) {
        const result = await this.baleCall<{ message_id: number }>(
          token,
          'sendPhoto',
          buildBalePhotoForm({
            chatId,
            photo: prepared[0],
            caption: text || undefined,
            replyMarkup: keyboard,
          }),
          BALE_UPLOAD_TIMEOUT_MS,
        );
        keyboardAttached = !!keyboard;
        ids.push(String(result.message_id));
      } else if (photos.length) {
        // Every photo was skipped (undecodable) — text-only fallback.
        const result = await this.baleCall<{ message_id: number }>(token, 'sendMessage', {
          chat_id: chatId,
          text,
          ...(keyboard ? { reply_markup: keyboard } : {}),
        });
        keyboardAttached = !!keyboard;
        ids.push(String(result.message_id));
      }
    } else if (photos.length >= 2) {
      const caption = text.length <= BALE_ALBUM_CAPTION_LIMIT ? text : '';
      overflow = caption ? '' : text;
      const result = await this.baleCall<Array<{ message_id: number }>>(token, 'sendMediaGroup', {
        chat_id: chatId,
        media: photos.map((url, index) => ({ type: 'photo', media: url, ...(index === 0 && caption ? { caption } : {}) })),
      }, 20_000);
      ids.push(...(result || []).map((row) => String(row.message_id)).filter((id) => id && id !== 'undefined'));
    } else if (photos.length === 1) {
      const result = await this.baleCall<{ message_id: number }>(token, 'sendPhoto', {
        chat_id: chatId,
        photo: photos[0],
        ...(text ? { caption: text } : {}),
        ...(keyboard ? { reply_markup: keyboard } : {}),
      }, 20_000);
      keyboardAttached = !!keyboard;
      ids.push(String(result.message_id));
    } else {
      const result = await this.baleCall<{ message_id: number }>(token, 'sendMessage', {
        chat_id: chatId,
        text,
        ...(keyboard ? { reply_markup: keyboard } : {}),
      });
      keyboardAttached = !!keyboard;
      ids.push(String(result.message_id));
    }
    if (overflow || (keyboard && !keyboardAttached)) {
      const extra = await this.baleCall<{ message_id: number }>(token, 'sendMessage', {
        chat_id: chatId,
        text: overflow || String(opts.buttons[0]?.label || '🔗'),
        ...(keyboard && !keyboardAttached ? { reply_markup: keyboard } : {}),
      });
      ids.push(String(extra.message_id));
    }
    return {
      providerMessageId: ids.filter(Boolean).join(','),
      ...(warnings.length ? { warnings } : {}),
    };
  }

  async update(input: Record<string, unknown>): Promise<{ providerMessageId: string }> {
    this.assertEnabled();
    const token = resolveBaleToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    const allIds = String(input.providerMessageId || '').split(',').map((id) => id.trim()).filter(Boolean);
    const messageId = allIds[0] || '';
    if (!token) throw new Error('invalid_credential');
    if (!messageId) throw new Error('provider_message_missing');
    const photos = this.photosFrom(input);
    const text = baleText(String(input.text || ''), input.parseMode);
    const keyboard = inlineKeyboard(telegramSendOptions(input).buttons);
    const method = photos.length ? 'editMessageCaption' : 'editMessageText';
    const result = await this.baleCall<{ message_id: number }>(token, method, {
      chat_id: chatId,
      message_id: Number(messageId),
      ...(photos.length
        ? { caption: text.slice(0, photos.length >= 2 ? BALE_ALBUM_CAPTION_LIMIT : BALE_TEXT_LIMIT) }
        : { text: text.slice(0, BALE_TEXT_LIMIT) }),
      ...(keyboard && photos.length <= 1 ? { reply_markup: keyboard } : {}),
    });
    const edited = String(result?.message_id || messageId);
    return { providerMessageId: [edited, ...allIds.slice(1)].join(',') };
  }

  /** Messages older than 48 h cannot be deleted on Bale; that surfaces as `delete_window_expired`. */
  async delete(input: Record<string, unknown>): Promise<void> {
    this.assertEnabled();
    const token = resolveBaleToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    if (!token) throw new Error('invalid_credential');
    const ids = String(input.providerMessageId || '').split(',').map((id) => id.trim()).filter(Boolean);
    for (const messageId of ids) {
      try {
        await this.baleCall(token, 'deleteMessage', { chat_id: chatId, message_id: Number(messageId) });
      } catch (err: unknown) {
        const description = err && typeof err === 'object' ? String((err as { description?: string }).description || '') : '';
        if (/not found|MESSAGE_ID_INVALID/i.test(description)) continue;
        if (/can't be deleted|too old|48/i.test(description)) throw new Error('delete_window_expired');
        throw err;
      }
    }
  }

  private photosFrom(input: Record<string, unknown>): string[] {
    const channel = input.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    return sanitizePhotoUrls(channel, input.photoUrls);
  }

  private async prepareOwnedPhotosForUpload(
    urls: string[],
    warnings: string[],
  ): Promise<PreparedBalePhoto[]> {
    const out: PreparedBalePhoto[] = [];
    for (const url of urls) {
      try {
        out.push(await this.prepareOneOwnedPhoto(url));
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        const warning = `photo_skipped:${url}:${reason}`;
        warnings.push(warning);
        this.logger.warn(warning);
      }
    }
    return out;
  }

  private async prepareOneOwnedPhoto(url: string): Promise<PreparedBalePhoto> {
    const reader = this.images?.ready ? this.images : null;
    const mainKey = ownedProductMediaKey(url);
    const channelKey = mainKey ? channelDerivativeKey(mainKey) : null;
    if (channelKey && reader) {
      try {
        const channelBytes = await reader.readOwnedImage(channelKey);
        if (channelBytes?.length && isCompleteJpeg(channelBytes)) {
          return { bytes: channelBytes, contentType: 'image/jpeg', filename: 'photo.jpg' };
        }
      } catch {
        // Fall back to main object + encode.
      }
    }
    const raw = await this.loadPhoto(url);
    return prepareBaleUpload(raw);
  }

  private loadPhoto(url: string): Promise<Buffer> {
    if (this.photoLoader) return this.photoLoader(url);
    const reader = this.images?.ready ? this.images : null;
    return loadOwnedPhotoBytes(url, {
      readStorage: reader ? (key) => reader.readOwnedImage(key) : undefined,
      fetchImpl: this.http,
      timeoutMs: TELEGRAM_PHOTO_FETCH_TIMEOUT_MS,
    });
  }

  /**
   * PR-14 order-bot: getUpdates with acknowledged offset (unlike discoverChats).
   * Only used when orderBotEnabled; never invents chat ids.
   */
  async fetchOrderBotUpdates(
    secretRef: string,
    offset?: number | null,
  ): Promise<{ ok: boolean; error?: string; updates: UpdateLike[]; nextOffset: number | null }> {
    this.assertEnabled();
    const token = resolveBaleToken(secretRef);
    if (!token) return { ok: false, error: 'invalid_credential', updates: [], nextOffset: null };
    try {
      const body: Record<string, unknown> = { limit: 50 };
      if (offset != null && Number.isFinite(Number(offset))) body.offset = Number(offset);
      const updates = await this.baleCall<UpdateLike[]>(token, 'getUpdates', body);
      const list = Array.isArray(updates) ? updates : [];
      let nextOffset: number | null = null;
      for (const u of list) {
        const id = Number((u as { update_id?: number }).update_id);
        if (Number.isFinite(id)) nextOffset = Math.max(nextOffset ?? 0, id + 1);
      }
      return { ok: true, updates: list, nextOffset };
    } catch (err: unknown) {
      const description = err && typeof err === 'object' ? String((err as { description?: string }).description || '') : '';
      return {
        ok: false,
        error: /webhook/i.test(description) ? 'webhook_active' : classifyTelegramThrow(err),
        updates: [],
        nextOffset: null,
      };
    }
  }

  /** Documented setWebhook helper — secret never logged. */
  async setOrderBotWebhook(
    secretRef: string,
    url: string,
    secretToken: string,
  ): Promise<{ ok: boolean; error?: string }> {
    this.assertEnabled();
    const token = resolveBaleToken(secretRef);
    if (!token) return { ok: false, error: 'invalid_credential' };
    const hookUrl = String(url || '').trim();
    if (!hookUrl.startsWith('https://')) return { ok: false, error: 'invalid_webhook_url' };
    try {
      await this.baleCall(token, 'setWebhook', {
        url: hookUrl,
        ...(secretToken ? { secret_token: String(secretToken).slice(0, 256) } : {}),
      });
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: classifyTelegramThrow(err) };
    }
  }
}
