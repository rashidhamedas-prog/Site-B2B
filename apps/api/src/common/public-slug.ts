import { BadRequestException } from '@nestjs/common';
import { asciiSlug } from './ascii-slug';

export const RESERVED_PUBLIC_SLUGS = new Set([
  'admin',
  'api',
  'cart',
  'checkout',
  'login',
  'register',
  'profile',
  'account',
  'orders',
  'search',
  'blog',
  'about',
  'contact',
  'products',
  'category',
  'categories',
  'wholesale',
  'portal',
  'payment',
  'feeds',
  'sitemap',
  'robots',
  'privacy',
  'terms',
  'shipping',
  'returns',
  'workshop',
  'collections',
]);

export function normalizePublicSlug(raw: string, fallback = 'item'): string {
  const trimmed = String(raw || '').trim().toLowerCase();
  if (!trimmed) {
    throw new BadRequestException('slug الزامی است');
  }
  if (/[?#/]/.test(trimmed) || /\s/.test(trimmed)) {
    throw new BadRequestException('slug نباید فاصله یا کاراکتر ? # / داشته باشد');
  }
  const slug = asciiSlug(trimmed, fallback);
  if (!slug) {
    throw new BadRequestException('slug نامعتبر است');
  }
  if (RESERVED_PUBLIC_SLUGS.has(slug)) {
    throw new BadRequestException(`این مسیر رزرو شده است: ${slug}`);
  }
  return slug;
}
