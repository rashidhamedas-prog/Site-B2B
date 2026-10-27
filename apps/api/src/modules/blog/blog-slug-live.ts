/** Helpers for live-only blog slug uniqueness (soft-deleted rows may share a slug). */

export const BLOG_SLUG_LIVE_CONFLICT = 'اسلاگ در این سایت تکراری است';

export const BLOG_CATEGORY_SLUG_LIVE_CONFLICT = 'اسلاگ دسته تکراری است';

export const BLOG_RESTORE_SLUG_CONFLICT =
  'اسلاگ این مطلب الان توسط یک مقاله فعال استفاده می‌شود؛ ابتدا اسلاگ مقاله فعال را تغییر دهید یا آن را حذف کنید، سپس بازیابی کنید';

export function blogArticlePath(slug: string): string {
  return `/blog/${slug}`;
}

/** True when a soft-deleted row holds the slug and no live row blocks reuse. */
export function softDeletedSlugHint(opts: {
  liveExists: boolean;
  softDeletedId?: string | null;
}): string | null {
  if (opts.liveExists) return null;
  if (!opts.softDeletedId) return null;
  return `reusing slug previously held by soft-deleted post ${opts.softDeletedId}`;
}
