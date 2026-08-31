import {
  RETAIL_CANONICAL_ORIGIN,
  WHOLESALE_CANONICAL_ORIGIN,
} from '../product/channel-projection';
import { normalizeSalesChannel, type SalesChannel } from '../product/channel-product-projection';

export type ContentSourceType = 'BLOG_POST' | 'CMS_PAGE';

export type ContentProjection = {
  channel: SalesChannel;
  sourceType: ContentSourceType;
  sourceId: string;
  name: string | null;
  visible: boolean;
  publishable: boolean;
  rejectReason: string | null;
  content: string | null;
  url: string;
};

function originFor(channel: SalesChannel): string {
  return channel === 'RETAIL' ? RETAIL_CANONICAL_ORIGIN : WHOLESALE_CANONICAL_ORIGIN;
}

export function buildBlogProjection(
  post: {
    id?: string;
    slug?: string | null;
    title?: string | null;
    excerpt?: string | null;
    content?: string | null;
    status?: string | null;
    channel?: string | null;
  },
  requested: SalesChannel,
): ContentProjection {
  const owned = normalizeSalesChannel(post.channel);
  const status = String(post.status || '').toUpperCase();
  let rejectReason: string | null = null;
  if (status !== 'PUBLISHED') rejectReason = 'status_not_public';
  else if (owned !== requested) rejectReason = 'channel_mismatch';
  const slug = String(post.slug || '').replace(/^\/+|\/+$/g, '');
  return {
    channel: requested,
    sourceType: 'BLOG_POST',
    sourceId: String(post.id || ''),
    name: post.title ? String(post.title) : null,
    visible: rejectReason == null,
    publishable: rejectReason == null,
    rejectReason,
    content: post.excerpt || post.content || null,
    url: `${originFor(requested)}/blog/${slug}`,
  };
}

export function buildCmsProjection(
  page: {
    id?: string;
    slug?: string | null;
    title?: string | null;
    content?: string | null;
    status?: string | null;
    channel?: string | null;
    kind?: string | null;
  },
  requested: SalesChannel,
): ContentProjection {
  const owned = normalizeSalesChannel(page.channel);
  const status = String(page.status || '').toUpperCase();
  const kind = String(page.kind || 'PAGE').toUpperCase();
  let rejectReason: string | null = null;
  if (status !== 'PUBLISHED') rejectReason = 'status_not_public';
  else if (owned !== requested) rejectReason = 'channel_mismatch';
  else if (kind !== 'PAGE' && kind !== 'LANDING') rejectReason = 'kind_not_page';
  const slug = String(page.slug || '').replace(/^\/+|\/+$/g, '');
  return {
    channel: requested,
    sourceType: 'CMS_PAGE',
    sourceId: String(page.id || ''),
    name: page.title ? String(page.title) : null,
    visible: rejectReason == null,
    publishable: rejectReason == null,
    rejectReason,
    content: page.content || null,
    url: `${originFor(requested)}/${slug}`,
  };
}
