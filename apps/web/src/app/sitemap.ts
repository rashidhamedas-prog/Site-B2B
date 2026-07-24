import type { MetadataRoute } from 'next';
import { API_URL, getSeoChannel, RETAIL_ORIGIN, WHOLESALE_ORIGIN } from '@/lib/seo';

interface ProductRow {
  slug: string;
  updatedAt?: string;
}

interface BlogRow {
  slug: string;
  updatedAt?: string;
  publishedAt?: string;
}

async function getProducts(): Promise<ProductRow[]> {
  try {
    const res = await fetch(`${API_URL}/products?limit=500`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data ?? json ?? [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function getBlogPosts(): Promise<BlogRow[]> {
  try {
    const res = await fetch(`${API_URL}/blog/posts?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data ?? json ?? [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function productEntries(origin: string, products: ProductRow[]): MetadataRoute.Sitemap {
  return products
    .filter((p) => p?.slug)
    .map((p) => ({
      url: `${origin}/products/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const channel = await getSeoChannel();
  const products = await getProducts();

  if (channel === 'RETAIL') {
    const origin = RETAIL_ORIGIN;
    const staticPages: MetadataRoute.Sitemap = [
      { url: origin, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
      { url: `${origin}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
      { url: `${origin}/collections`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.75 },
      { url: `${origin}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
      { url: `${origin}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
      { url: `${origin}/shipping`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.45 },
      { url: `${origin}/returns`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.45 },
    ];
    return [...staticPages, ...productEntries(origin, products)];
  }

  const origin = WHOLESALE_ORIGIN;
  const posts = await getBlogPosts();

  const staticPages: MetadataRoute.Sitemap = [
    { url: origin, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${origin}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${origin}/linen-collection`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.85 },
    { url: `${origin}/workshop`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.65 },
    { url: `${origin}/products/fabric/linen`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${origin}/products/fabric/cotton`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.65 },
    { url: `${origin}/products/fabric/crepe`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${origin}/wholesale`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${origin}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${origin}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${origin}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.65 },
    { url: `${origin}/shipping`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${origin}/returns`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${origin}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${origin}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  const blogPages: MetadataRoute.Sitemap = posts
    .filter((p) => p?.slug)
    .map((p) => ({
      url: `${origin}/blog/${p.slug}`,
      lastModified: new Date(p.updatedAt || p.publishedAt || Date.now()),
      changeFrequency: 'monthly' as const,
      priority: 0.55,
    }));

  return [...staticPages, ...productEntries(origin, products), ...blogPages];
}
