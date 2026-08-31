export type SitemapPostRow = {
  slug?: string | null;
  robotsIndex?: boolean;
};

/** Published + indexable posts belong in the sitemap even if sitemapEnabled was left off. */
export function mergeSitemapPosts<T extends SitemapPostRow>(
  sitemapRows: T[],
  publishedRows: T[],
): T[] {
  const bySlug = new Map<string, T>();
  for (const post of [...sitemapRows, ...publishedRows]) {
    const slug = String(post?.slug || '').trim();
    if (!slug || post.robotsIndex === false) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, post);
  }
  return [...bySlug.values()];
}
