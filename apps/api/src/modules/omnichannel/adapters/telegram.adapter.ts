import {
  ChannelAdapter,
  ConnectorDisabledError,
  type DestinationInspection,
  type DiscoveredChat,
} from './channel-adapter';
import { isOmnichannelProviderEnabled } from '../omnichannel.constants';
import { isAllowedSecretRef } from '../omnichannel-secrets';
import { isVaultStrictMessengers, peekVaultToken } from '../omnichannel-token-vault';
import { classifyTelegramHttpError, classifyTelegramThrow, redactProviderError } from './telegram-errors';
import {
  TELEGRAM_CAPTION_LIMIT,
  publicButtonUrl,
  sanitizePhotoUrls,
  type TemplateButton,
} from '../publication-template';
import {
  TELEGRAM_PHOTO_CONCURRENCY,
  TELEGRAM_PHOTO_FETCH_TIMEOUT_MS,
  TELEGRAM_UPLOAD_TIMEOUT_MS,
  buildTelegramAlbumForm,
  buildTelegramPhotoForm,
  loadOwnedPhotoBytes,
  mapLimit,
  prepareTelegramUpload,
  telegramMediaUploadMode,
  type PreparedTelegramPhoto,
} from './telegram-media';

/** MinIO reader. The adapter does not import StorageService, so unit tests can construct it alone. */
export interface OwnedImageReader {
  ready: boolean;
  readOwnedImage(key: string): Promise<Buffer>;
}

/** Official Bot API host. Used when `TELEGRAM_API_URL` is unset or blank. */
export const TELEGRAM_API = 'https://api.telegram.org';

/**
 * Base for every Bot API method. Blank env keeps TELEGRAM_API.
 * Trailing slashes are removed so the request stays `{base}/bot{token}/{method}`.
 * The value is the prefix before `/bot`, not a full method URL.
 */
export function telegramApiBase(source: { TELEGRAM_API_URL?: string | undefined } = process.env): string {
  const raw = String(source.TELEGRAM_API_URL ?? '').trim();
  if (!raw) return TELEGRAM_API;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('telegram_api_url_invalid');
  }
  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('telegram_api_url_invalid');
  }
  return parsed.toString().replace(/\/+$/, '');
}

/**
 * Env-name indirection shared by every provider: `${PROVIDER}_…` names only.
 * Admin-saved vault overlay wins (owner just pasted a token); env is the fallback.
 * When `OMNICHANNEL_VAULT_STRICT_MESSENGERS` is on, BALE/RUBIKA refuse env-only
 * (fail closed → null). Telegram always keeps vault-then-env (structure-ready only).
 * The plaintext never leaves this process.
 */
export function resolveProviderToken(provider: string, secretRef: string): string | null {
  const name = String(secretRef || '').trim();
  if (!isAllowedSecretRef(name) || !name.startsWith(`${provider}_`)) return null;
  const fromVault = peekVaultToken(name);
  if (fromVault) return fromVault;
  if (isVaultStrictMessengers() && (provider === 'BALE' || provider === 'RUBIKA')) {
    return null;
  }
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
}

export function resolveTelegramToken(secretRef: string): string | null {
  return resolveProviderToken('TELEGRAM', secretRef);
}

export type UpdateLike = {
  message?: { chat?: TelegramChat; forward_from_chat?: TelegramChat; sender_chat?: TelegramChat };
  channel_post?: { chat?: TelegramChat };
  my_chat_member?: { chat?: TelegramChat };
};

/** Pure: chats worth showing an admin, newest first, de-duplicated by id. Private user chats are skipped. */
export function chatsFromUpdates(updates: UpdateLike[]): DiscoveredChat[] {
  const out = new Map<string, DiscoveredChat>();
  const add = (chat: TelegramChat | undefined, via: DiscoveredChat['via']) => {
    if (!chat || chat.id == null) return;
    const chatType = String(chat.type || '').toLowerCase();
    if (chatType === 'private') return;
    const chatId = String(chat.id);
    if (out.has(chatId)) return;
    out.set(chatId, {
      chatId,
      chatType,
      title: String(chat.title || '').slice(0, 120) || undefined,
      username: chat.username ? String(chat.username).slice(0, 64) : null,
      via,
    });
  };
  for (const update of [...updates].reverse()) {
    add(update.channel_post?.chat, 'channel_post');
    add(update.message?.forward_from_chat, 'forward');
    add(update.message?.sender_chat, 'channel_post');
    add(update.my_chat_member?.chat, 'member');
    add(update.message?.chat, 'message');
  }
  return [...out.values()];
}

export type TelegramSendOptions = {
  parseMode: 'HTML' | undefined;
  buttons: TemplateButton[];
  silent: boolean;
  protectContent: boolean;
  captionAbove: boolean;
  linkPreview: boolean;
};

/** Official parameter names only; anything unknown is dropped. */
export function telegramSendOptions(input: Record<string, unknown>): TelegramSendOptions {
  const buttons: TemplateButton[] = [];
  if (Array.isArray(input.buttons)) {
    for (const item of input.buttons) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const label = String(row.label || '').trim().slice(0, 40);
      const url = publicButtonUrl(String(row.url || ''));
      if (label && url) buttons.push({ label, url });
      if (buttons.length >= 4) break;
    }
  }
  return {
    parseMode: input.parseMode === 'HTML' ? 'HTML' : undefined,
    buttons,
    silent: input.silent === true,
    protectContent: input.protectContent === true,
    captionAbove: input.captionAbove === true,
    linkPreview: input.linkPreview === true,
  };
}

export function inlineKeyboard(buttons: TemplateButton[]): { inline_keyboard: Array<Array<{ text: string; url: string }>> } | undefined {
  if (!buttons.length) return undefined;
  return { inline_keyboard: buttons.map((button) => [{ text: button.label, url: button.url }]) };
}

export type TelegramDestinationInspection = DestinationInspection;

type TelegramChat = { id?: number | string; type?: string; title?: string; username?: string; first_name?: string };
type TelegramChatMember = {
  status?: string;
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_delete_messages?: boolean;
};

/** Official Telegram Bot API — live calls only when connectors are enabled. */
export class TelegramAdapter implements ChannelAdapter {
  readonly provider = 'TELEGRAM';
  http: typeof fetch = globalThis.fetch.bind(globalThis);
  /** Set by the Nest factory. Tests leave this null and stub `photoLoader` when they need bytes. */
  images: OwnedImageReader | null = null;
  photoLoader: ((url: string) => Promise<Buffer>) | null = null;

  protected assertEnabled() {
    if (!isOmnichannelProviderEnabled(this.provider)) throw new ConnectorDisabledError(this.provider);
  }

  /**
   * Recent updates (no offset → nothing is acknowledged) so the admin can copy a channel id the
   * bot has already seen. Fails with `webhook_active` when getUpdates is blocked by a webhook.
   */
  async discoverChats(secretRef: string): Promise<{ ok: boolean; error?: string; chats: DiscoveredChat[] }> {
    this.assertEnabled();
    const token = resolveTelegramToken(secretRef);
    if (!token) return { ok: false, error: 'invalid_credential', chats: [] };
    try {
      const updates = await this.telegramCall<UpdateLike[]>(token, 'getUpdates', {
        limit: 100,
        allowed_updates: ['message', 'channel_post', 'my_chat_member'],
      });
      return { ok: true, chats: chatsFromUpdates(Array.isArray(updates) ? updates : []) };
    } catch (err: unknown) {
      const code = classifyTelegramThrow(err);
      const description = err && typeof err === 'object' ? String((err as { description?: string }).description || '') : '';
      return { ok: false, error: /webhook/i.test(description) ? 'webhook_active' : code, chats: [] };
    }
  }

  private async telegramCall<T>(
    token: string,
    method: string,
    body?: Record<string, unknown> | FormData,
    timeoutMs = 12_000,
  ): Promise<T> {
    const form = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await this.http(`${telegramApiBase()}/bot${token}/${method}`, {
      method: 'POST',
      // FormData must set its own multipart boundary. A manual Content-Type drops it.
      headers: form ? undefined : { 'Content-Type': 'application/json' },
      body: form ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: T };
    if (!res.ok || json.ok === false) {
      const description = redactProviderError(String(json.description || ''));
      const code = classifyTelegramHttpError(res.status, json.description);
      // Known codes stay as Error.message (worker treats `duplicate` as success-noop).
      // Only opaque validate_failed uses the Telegram description so DEAD rows are actionable.
      const err = new Error(code === 'validate_failed' && description ? description : code) as Error & {
        status?: number;
        description?: string;
        telegramCode?: string;
      };
      err.status = res.status;
      err.description = description;
      err.telegramCode = code;
      throw err;
    }
    return json.result as T;
  }

  /**
   * getChat + getChatMember(bot) + getChatMemberCount. Returns only what admin needs to see;
   * private canary chats have no admin concept, so canPost is true when the chat resolves.
   */
  async inspectDestination(secretRef: string, chatId: string): Promise<TelegramDestinationInspection> {
    this.assertEnabled();
    const token = resolveTelegramToken(secretRef);
    const target = String(chatId || '').trim();
    if (!token) return { ok: false, error: 'invalid_credential' };
    if (!target) return { ok: false, error: 'destination_missing' };
    try {
      const me = await this.telegramCall<{ id: number; username?: string }>(token, 'getMe');
      const chat = await this.telegramCall<TelegramChat>(token, 'getChat', { chat_id: target });
      const chatType = String(chat.type || '').toLowerCase();
      const out: TelegramDestinationInspection = {
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
        const member = await this.telegramCall<TelegramChatMember>(token, 'getChatMember', {
          chat_id: target,
          user_id: me.id,
        });
        const status = String(member.status || '');
        const admin = status === 'administrator' || status === 'creator';
        out.botIsAdmin = admin;
        if (chatType === 'channel') {
          out.canPost = status === 'creator' || (admin && member.can_post_messages === true);
          out.canEdit = status === 'creator' || (admin && member.can_edit_messages === true);
        } else {
          out.canPost = admin || status === 'member';
          out.canEdit = admin;
        }
        out.canDelete = status === 'creator' || (admin && member.can_delete_messages === true);
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
        const count = await this.telegramCall<number>(token, 'getChatMemberCount', { chat_id: target });
        out.memberCount = Number.isFinite(Number(count)) ? Number(count) : null;
      } catch {
        out.memberCount = null;
      }
      return out;
    } catch (err: unknown) {
      const code = classifyTelegramThrow(err);
      const description = err && typeof err === 'object' ? String((err as { description?: string }).description || '') : '';
      return {
        ok: false,
        error: code === 'validate_failed' && /chat not found/i.test(description) ? 'chat_not_found' : code,
      };
    }
  }

  async validateConnection(secretRef: string): Promise<{ ok: boolean; error?: string }> {
    this.assertEnabled();
    return this.probeCredential(secretRef);
  }

  async probeCredential(secretRef: string): Promise<{ ok: boolean; error?: string }> {
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
    this.assertEnabled();
    const text = String(input.text || input.body || '');
    const photos = this.photosFrom(input);
    const method = photos.length >= 2 ? 'sendMediaGroup' : photos.length === 1 ? 'sendPhoto' : 'sendMessage';
    return { provider: this.provider, method, dryRun: true, textLength: text.length, photoCount: photos.length };
  }

  async create(input: Record<string, unknown>): Promise<{ providerMessageId: string }> {
    this.assertEnabled();
    const token = resolveTelegramToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    if (!token) throw new Error('invalid_credential');
    if (!chatId) throw new Error('destination_missing');
    const text = String(input.text || '');
    const photos = this.photosFrom(input);
    const opts = telegramSendOptions(input);
    const common = {
      ...(opts.silent ? { disable_notification: true } : {}),
      ...(opts.protectContent ? { protect_content: true } : {}),
    };
    const parse = opts.parseMode ? { parse_mode: opts.parseMode } : {};
    const keyboard = inlineKeyboard(opts.buttons);
    const caption = text && text.length <= TELEGRAM_CAPTION_LIMIT ? text : '';
    const overflow = text && !caption ? text : '';
    const ids: string[] = [];
    let keyboardAttached = false;
    if (photos.length && telegramMediaUploadMode() === 'upload') {
      const prepared = await this.prepareOwnedPhotos(photos);
      if (prepared.length >= 2) {
        const result = await this.telegramCall<Array<{ message_id: number }>>(
          token,
          'sendMediaGroup',
          buildTelegramAlbumForm({
            chatId,
            photos: prepared,
            caption: caption || undefined,
            parseMode: opts.parseMode,
            silent: opts.silent,
            protectContent: opts.protectContent,
          }),
          TELEGRAM_UPLOAD_TIMEOUT_MS,
        );
        ids.push(...(result || []).map((row) => String(row.message_id)).filter((id) => id && id !== 'undefined'));
      } else if (prepared.length === 1) {
        const result = await this.telegramCall<{ message_id: number }>(
          token,
          'sendPhoto',
          buildTelegramPhotoForm({
            chatId,
            photo: prepared[0],
            caption: caption || undefined,
            parseMode: opts.parseMode,
            captionAbove: Boolean(caption && opts.captionAbove),
            silent: opts.silent,
            protectContent: opts.protectContent,
            replyMarkup: keyboard,
          }),
          TELEGRAM_UPLOAD_TIMEOUT_MS,
        );
        keyboardAttached = !!keyboard;
        ids.push(String(result.message_id));
      }
    } else if (photos.length >= 2) {
      // Albums cannot carry reply_markup (Bot API); buttons ride on the overflow message if any.
      // Do NOT set show_caption_above_media on InputMediaPhoto albums — live WHOLESALE DEAD rows
      // were 100% multi-photo + captionAbove=true (validate_failed), while single sendPhoto with
      // captionAbove and albums without captionAbove succeeded.
      const result = await this.telegramCall<Array<{ message_id: number }>>(token, 'sendMediaGroup', {
        chat_id: chatId,
        ...common,
        media: photos.map((url, index) => ({
          type: 'photo',
          media: url,
          ...(index === 0 && caption ? { caption, ...parse } : {}),
        })),
      }, 20_000);
      ids.push(...(result || []).map((row) => String(row.message_id)).filter((id) => id && id !== 'undefined'));
    } else if (photos.length === 1) {
      const result = await this.telegramCall<{ message_id: number }>(token, 'sendPhoto', {
        chat_id: chatId,
        photo: photos[0],
        ...common,
        ...(caption ? { caption, ...parse } : {}),
        ...(caption && opts.captionAbove ? { show_caption_above_media: true } : {}),
        ...(keyboard ? { reply_markup: keyboard } : {}),
      }, 20_000);
      keyboardAttached = !!keyboard;
      ids.push(String(result.message_id));
    } else {
      const result = await this.telegramCall<{ message_id: number }>(token, 'sendMessage', {
        chat_id: chatId,
        text,
        ...common,
        ...parse,
        link_preview_options: { is_disabled: !opts.linkPreview },
        ...(keyboard ? { reply_markup: keyboard } : {}),
      });
      keyboardAttached = !!keyboard;
      ids.push(String(result.message_id));
    }
    if (overflow) {
      const extra = await this.telegramCall<{ message_id: number }>(token, 'sendMessage', {
        chat_id: chatId,
        text: overflow,
        ...common,
        ...parse,
        link_preview_options: { is_disabled: true },
        ...(keyboard && !keyboardAttached ? { reply_markup: keyboard } : {}),
      });
      ids.push(String(extra.message_id));
    }
    return { providerMessageId: ids.filter(Boolean).join(',') };
  }

  /**
   * Edits the first message of the post. Telegram answers "message is not modified" (400) when
   * nothing changed; callers treat that `duplicate` code as success.
   */
  async update(input: Record<string, unknown>): Promise<{ providerMessageId: string }> {
    this.assertEnabled();
    const token = resolveTelegramToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    const allIds = String(input.providerMessageId || '').split(',').map((id) => id.trim()).filter(Boolean);
    const messageId = allIds[0] || '';
    if (!token) throw new Error('invalid_credential');
    if (!messageId) throw new Error('provider_message_missing');
    const photos = this.photosFrom(input);
    const text = String(input.text || '');
    const opts = telegramSendOptions(input);
    const parse = opts.parseMode ? { parse_mode: opts.parseMode } : {};
    const keyboard = inlineKeyboard(opts.buttons);
    const method = photos.length ? 'editMessageCaption' : 'editMessageText';
    const result = await this.telegramCall<{ message_id: number }>(token, method, {
      chat_id: chatId,
      message_id: Number(messageId),
      ...parse,
      ...(photos.length
        ? { caption: text.slice(0, TELEGRAM_CAPTION_LIMIT) }
        : { text, link_preview_options: { is_disabled: !opts.linkPreview } }),
      ...(keyboard && photos.length <= 1 ? { reply_markup: keyboard } : {}),
    });
    const edited = String(result?.message_id || messageId);
    return { providerMessageId: [edited, ...allIds.slice(1)].join(',') };
  }

  /** Already-deleted messages are a no-op so withdraw stays idempotent across retries. */
  async delete(input: Record<string, unknown>): Promise<void> {
    this.assertEnabled();
    const token = resolveTelegramToken(String(input.secretRef || ''));
    const chatId = String(input.chatId || input.destinationKey || '');
    if (!token) throw new Error('invalid_credential');
    const ids = String(input.providerMessageId || '').split(',').map((id) => id.trim()).filter(Boolean);
    for (const messageId of ids) {
      try {
        await this.telegramCall(token, 'deleteMessage', {
          chat_id: chatId,
          message_id: Number(messageId),
        });
      } catch (err: unknown) {
        const description = err && typeof err === 'object' ? String((err as { description?: string }).description || '') : '';
        if (/message to delete not found|message can't be deleted|MESSAGE_ID_INVALID/i.test(description)) continue;
        throw err;
      }
    }
  }

  private photosFrom(input: Record<string, unknown>): string[] {
    const channel = input.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';
    return sanitizePhotoUrls(channel, input.photoUrls);
  }

  /** MinIO key when the URL is `/media/…`, otherwise same-origin HTTPS. Sharp turns WebP into JPEG. */
  private async prepareOwnedPhotos(urls: string[]): Promise<PreparedTelegramPhoto[]> {
    const raws = await mapLimit(urls, TELEGRAM_PHOTO_CONCURRENCY, (url) => this.loadPhoto(url));
    return mapLimit(raws, TELEGRAM_PHOTO_CONCURRENCY, (raw) => prepareTelegramUpload(raw));
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
}
