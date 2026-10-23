import { RETAIL_ORIGIN, WHOLESALE_ORIGIN } from './seo-origins';

/** Private paths shared by `*` and OAI-SearchBot. Do not add a separate Googlebot group. */
export const COMMON_DISALLOW = [
  '/admin/',
  '/portal/',
  '/partners/',
  '/api/',
  '/retail',
  '/retail/',
  '/cart',
  '/checkout',
  '/account',
  '/login',
  '/payment/',
  '/blog/search',
  '/blog/preview',
];

export const ROBOTS_ALLOW = ['/', '/api/v1/feeds/'];

export type RobotsRule = {
  userAgent: string;
  allow: string[];
  disallow: string[];
};

/**
 * Draft A (locked 2026-10-23): explicit OAI-SearchBot with the same allow/disallow as `*`.
 * GPTBot and Google-Extended stay inherited from `*` — no Disallow group for them.
 */
export function buildRobotsRules(): RobotsRule[] {
  const shared = {
    allow: ROBOTS_ALLOW,
    disallow: COMMON_DISALLOW,
  };
  return [
    { userAgent: 'OAI-SearchBot', ...shared },
    { userAgent: '*', ...shared },
  ];
}

export function robotsSitemap(channel: 'WHOLESALE' | 'RETAIL'): string {
  const origin = channel === 'RETAIL' ? RETAIL_ORIGIN : WHOLESALE_ORIGIN;
  return `${origin}/sitemap.xml`;
}
