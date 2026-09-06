import {
  OMNICHANNEL_PROVIDERS,
  defaultSecretRefFor,
  isOmnichannelProviderEnabled,
  type OmnichannelProvider,
} from './omnichannel.constants';

/**
 * What each official Bot API can do with a product post. Read from the vendors' docs on
 * 2026-09-06 (docs.bale.ai, rubika.ir/botapi, core.telegram.org/bots/api). The admin console
 * reads this through `GET /omnichannel/status` so the UI never hard-codes platform rules.
 */
export type ProviderCapabilities = {
  provider: OmnichannelProvider;
  /** Persian display name. */
  label: string;
  /** Where the bot is created. */
  botFactory: string;
  apiBase: string;
  /** How the bot's text is formatted on the wire. */
  textFormat: 'HTML' | 'MARKDOWN' | 'METADATA';
  /** Bold survives on photo captions (Rubika sendFile has no metadata field). */
  boldOnCaption: boolean;
  album: boolean;
  albumLimit: number;
  captionLimit: number;
  textLimit: number;
  /** Inline URL buttons under the post; 'text-link' means they are appended as link lines. */
  buttons: 'inline' | 'text-link';
  /** Buttons under an album (sendMediaGroup has no reply_markup anywhere). */
  buttonsOnAlbum: false;
  silent: boolean;
  protectContent: boolean;
  captionAbove: boolean;
  linkPreviewToggle: boolean;
  editCaption: boolean;
  editText: boolean;
  /** Hours after which deleteMessage is refused; null = no documented limit for admins. */
  deleteWindowHours: number | null;
  /** getChatMember-style permission check exists; otherwise a test post proves posting rights. */
  permissionCheck: 'api' | 'test_post';
  /** Recent-updates lookup to discover chat ids. */
  discoverChats: boolean;
  chatIdHint: string;
  /** Sample chat ids the admin can recognise. */
  chatIdExamples: string[];
};

export const PROVIDER_CAPABILITIES: Record<OmnichannelProvider, ProviderCapabilities> = {
  TELEGRAM: {
    provider: 'TELEGRAM',
    label: 'تلگرام',
    botFactory: '@BotFather در تلگرام',
    apiBase: 'https://api.telegram.org',
    textFormat: 'HTML',
    boldOnCaption: true,
    album: true,
    albumLimit: 10,
    captionLimit: 1024,
    textLimit: 4096,
    buttons: 'inline',
    buttonsOnAlbum: false,
    silent: true,
    protectContent: true,
    captionAbove: true,
    linkPreviewToggle: true,
    editCaption: true,
    editText: true,
    deleteWindowHours: null,
    permissionCheck: 'api',
    discoverChats: true,
    chatIdHint: 'برای کانال عمومی @username، برای کانال خصوصی شناسه عددی مثل -1001234567890',
    chatIdExamples: ['@toliditaranom', '-1001234567890'],
  },
  BALE: {
    provider: 'BALE',
    label: 'بله',
    botFactory: '@botfather در بله',
    apiBase: 'https://tapi.bale.ai',
    textFormat: 'MARKDOWN',
    boldOnCaption: true,
    album: true,
    albumLimit: 10,
    captionLimit: 1024,
    textLimit: 4096,
    buttons: 'inline',
    buttonsOnAlbum: false,
    silent: false,
    protectContent: false,
    captionAbove: false,
    linkPreviewToggle: false,
    editCaption: true,
    editText: true,
    deleteWindowHours: 48,
    permissionCheck: 'api',
    discoverChats: true,
    chatIdHint: 'برای کانال عمومی @username، برای کانال خصوصی شناسه عددی؛ ربات باید در کانال ادمین باشد',
    chatIdExamples: ['@toliditaranom', '1234567890'],
  },
  RUBIKA: {
    provider: 'RUBIKA',
    label: 'روبیکا',
    botFactory: '@BotFather در روبیکا',
    apiBase: 'https://botapi.rubika.ir/v3',
    textFormat: 'METADATA',
    boldOnCaption: false,
    album: false,
    albumLimit: 1,
    captionLimit: 4096,
    textLimit: 4096,
    buttons: 'text-link',
    buttonsOnAlbum: false,
    silent: true,
    protectContent: false,
    captionAbove: false,
    linkPreviewToggle: false,
    editCaption: false,
    editText: true,
    deleteWindowHours: null,
    permissionCheck: 'test_post',
    discoverChats: true,
    chatIdHint: 'شناسه کانال روبیکا با c0 شروع می‌شود؛ یک پیام از کانال را برای ربات فوروارد کنید و «پیدا کردن شناسه» را بزنید',
    chatIdExamples: ['c0AbCdEf0123456789'],
  },
};

export function capabilitiesFor(provider: string): ProviderCapabilities {
  return PROVIDER_CAPABILITIES[(provider as OmnichannelProvider) in PROVIDER_CAPABILITIES ? (provider as OmnichannelProvider) : 'TELEGRAM'];
}

export type ProviderReadiness = ProviderCapabilities & {
  /** Global connectors flag AND not in OMNICHANNEL_DISABLED_PROVIDERS. */
  enabled: boolean;
  /** The conventional `${PROVIDER}_BOT_TOKEN` env has a non-empty value on this server. Never the value. */
  tokenConfigured: boolean;
  defaultSecretRef: string;
};

/** True when the named env var exists and is non-empty; the value itself never leaves the process. */
export function secretRefConfigured(secretRef: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const name = String(secretRef || '').trim();
  if (!/^(TELEGRAM|BALE|RUBIKA)_[A-Z0-9_]{1,80}$/.test(name)) return false;
  return String(env[name] || '').trim().length > 0;
}

/** Boolean-only readiness for the admin console. */
export function providerReadiness(env: NodeJS.ProcessEnv = process.env): ProviderReadiness[] {
  return OMNICHANNEL_PROVIDERS.map((provider) => ({
    ...PROVIDER_CAPABILITIES[provider],
    enabled: isOmnichannelProviderEnabled(provider),
    tokenConfigured: secretRefConfigured(defaultSecretRefFor(provider), env),
    defaultSecretRef: defaultSecretRefFor(provider),
  }));
}
