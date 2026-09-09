export const OMNICHANNEL_PROVIDERS = ['TELEGRAM', 'BALE', 'RUBIKA'] as const;
export type OmnichannelProvider = (typeof OMNICHANNEL_PROVIDERS)[number];

export const OMNICHANNEL_CHANNELS = ['RETAIL', 'WHOLESALE'] as const;
export type OmnichannelChannel = (typeof OMNICHANNEL_CHANNELS)[number];

export const CONNECTION_STATUSES = ['DISABLED', 'ACTIVE', 'ERROR'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const OUTBOX_STATUSES = ['PENDING', 'PROCESSING', 'DONE', 'DEAD'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const PUBLICATION_SOURCE_TYPES = ['PRODUCT', 'BLOG_POST', 'CMS_PAGE'] as const;
export type PublicationSourceType = (typeof PUBLICATION_SOURCE_TYPES)[number];

export const PUBLICATION_STATUSES = [
  'DRAFT',
  'READY',
  'PARTIAL',
  'PUBLISHED',
  'FAILED',
  'WITHDRAWN',
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const DELIVERY_ACTIONS = ['CREATE', 'UPDATE', 'DELETE'] as const;
export type DeliveryAction = (typeof DELIVERY_ACTIONS)[number];

export const OOS_POLICIES = ['UPDATE', 'HIDE', 'DELETE'] as const;
export type OosPolicy = (typeof OOS_POLICIES)[number];

export const DELIVERY_STATUSES = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'RETRY', 'DEAD'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const FORBIDDEN_SECRET_KEYS = [
  'secret',
  'token',
  'password',
  'botToken',
  'accessToken',
  'apiKey',
  'api_key',
  'privateKey',
  'credential',
  'credentials',
  'myToken',
] as const;

export function isOmnichannelAutoPublishEnabled(): boolean {
  return process.env.OMNICHANNEL_AUTO_PUBLISH === 'true';
}

export function areOmnichannelConnectorsEnabled(): boolean {
  return process.env.OMNICHANNEL_CONNECTORS_ENABLED === 'true';
}

export function isOmnichannelProvider(value: unknown): value is OmnichannelProvider {
  return typeof value === 'string' && (OMNICHANNEL_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Per-provider kill switch on top of the global connectors flag:
 * `OMNICHANNEL_DISABLED_PROVIDERS=RUBIKA,BALE`. Default: every provider follows the global flag.
 */
export function isOmnichannelProviderEnabled(provider: string): boolean {
  if (!areOmnichannelConnectorsEnabled() || !isOmnichannelProvider(provider)) return false;
  const disabled = String(process.env.OMNICHANNEL_DISABLED_PROVIDERS || '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return !disabled.includes(provider);
}

/** Conventional env name for a provider's bot token; admins may register any `${PROVIDER}_…` name. */
export function defaultSecretRefFor(provider: OmnichannelProvider): string {
  return `${provider}_BOT_TOKEN`;
}

/** Producer default on; set OMNICHANNEL_OUTBOX_PRODUCER=false to stop new events. */
export function isOmnichannelOutboxProducerEnabled(): boolean {
  return process.env.OMNICHANNEL_OUTBOX_PRODUCER !== 'false';
}

export const OUTBOX_EVENT_TYPES = {
  PRODUCT_CREATED: 'product.created',
  PRODUCT_CONTENT_CHANGED: 'product.content_changed',
  PRODUCT_PRICE_CHANGED: 'product.price_changed',
  PRODUCT_STOCK_CHANGED: 'product.stock_changed',
  PRODUCT_VISIBILITY_CHANGED: 'product.visibility_changed',
  PRODUCT_MEDIA_CHANGED: 'product.media_changed',
  PRODUCT_WITHDRAWN: 'product.withdrawn',
  BLOG_PUBLISHED: 'blog.published',
  CMS_PUBLISHED: 'cms.published',
  ORDER_CREATED_NOTIFICATION: 'order.created.notification',
  ORDER_STATUS_CHANGED_NOTIFICATION: 'order.status_changed.notification',
  FULFILLMENT_PENDING_ACCEPT_NOTIFICATION: 'fulfillment.pending_accept.notification',
  AFFILIATE_POSTBACK_REQUESTED: 'affiliate.postback.requested',
  SEARCH_REINDEX_REQUESTED: 'search.reindex.requested',
  PUBLICATION_DELIVER_REQUESTED: 'publication.deliver.requested',
  CUSTOMER_REGISTERED_MARKETING: 'customer.registered.marketing',
  CUSTOMER_APPROVED_MARKETING: 'customer.approved.marketing',
  MARKETING_SEND_REQUESTED: 'marketing.send.requested',
  MARKETING_CAMPAIGN_DISPATCH: 'marketing.campaign.dispatch',
} as const;

export const AUTO_PUBLISH_CANDIDATE_EVENTS = [
  OUTBOX_EVENT_TYPES.PRODUCT_CREATED,
  OUTBOX_EVENT_TYPES.PRODUCT_CONTENT_CHANGED,
  OUTBOX_EVENT_TYPES.PRODUCT_PRICE_CHANGED,
  OUTBOX_EVENT_TYPES.PRODUCT_VISIBILITY_CHANGED,
  OUTBOX_EVENT_TYPES.PRODUCT_MEDIA_CHANGED,
  OUTBOX_EVENT_TYPES.PRODUCT_WITHDRAWN,
  OUTBOX_EVENT_TYPES.BLOG_PUBLISHED,
  OUTBOX_EVENT_TYPES.CMS_PUBLISHED,
] as const;
export type AutoPublishEventType = (typeof AUTO_PUBLISH_CANDIDATE_EVENTS)[number];

export const DEFAULT_RETRY_SLA_SECONDS = 3600;
export const DEFAULT_OUTBOX_RETENTION_DAYS = 90;
export const RETRY_SLA_MIN_SECONDS = 60;
export const RETRY_SLA_MAX_SECONDS = 86_400;
export const OUTBOX_RETENTION_MIN_DAYS = 7;
export const OUTBOX_RETENTION_MAX_DAYS = 365;

/**
 * Channel automation. OFF = catalog events only refresh local drafts (today's behavior).
 * CANARY = auto-deliver to the canary destinations only. LIVE = every enabled, verified
 * destination (any provider) of that sales channel. Default stays OFF until the owner flips it.
 */
export const AUTO_PUBLISH_MODES = ['OFF', 'CANARY', 'LIVE'] as const;
export type AutoPublishMode = (typeof AUTO_PUBLISH_MODES)[number];
export const DEFAULT_AUTO_PUBLISH_MODE: AutoPublishMode = 'OFF';

export const WITHDRAW_ACTIONS = ['DELETE', 'KEEP'] as const;
export type WithdrawAction = (typeof WITHDRAW_ACTIONS)[number];
export const DEFAULT_WITHDRAW_ACTION: WithdrawAction = 'DELETE';

export const AUTO_DAILY_CAP_MIN = 1;
export const AUTO_DAILY_CAP_MAX = 200;
export const DEFAULT_AUTO_DAILY_CAP = 20;
export const AUTO_MIN_GAP_MIN_SECONDS = 0;
export const AUTO_MIN_GAP_MAX_SECONDS = 3600;
export const DEFAULT_AUTO_MIN_GAP_SECONDS = 90;
/** Quiet hours are Tehran wall-clock hours 0..23; null disables. */
export const TEHRAN_UTC_OFFSET_MINUTES = 210;

export const OUTBOX_FORBIDDEN_PAYLOAD_KEYS = [
  'jwt', 'token', 'password', 'secret', 'authorization', 'cookie',
  'phone', 'mobile', 'email', 'nationalId', 'cardNumber',
] as const;
