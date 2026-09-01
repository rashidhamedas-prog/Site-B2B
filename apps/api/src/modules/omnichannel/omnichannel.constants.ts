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
  AFFILIATE_POSTBACK_REQUESTED: 'affiliate.postback.requested',
  SEARCH_REINDEX_REQUESTED: 'search.reindex.requested',
  PUBLICATION_DELIVER_REQUESTED: 'publication.deliver.requested',
} as const;

export const OUTBOX_FORBIDDEN_PAYLOAD_KEYS = [
  'jwt', 'token', 'password', 'secret', 'authorization', 'cookie',
  'phone', 'mobile', 'email', 'nationalId', 'cardNumber',
] as const;
