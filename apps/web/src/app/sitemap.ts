import type { MetadataRoute } from 'next';

const BASE_URL = 'https://poshaktaranom.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.poshaktaranom.com/v1';

interface Product {
  slug: string;
  updatedAt: string;
}

async function getProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_URL}/products?limit=500&fields=slug,updatedAt`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/linen-collection`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.85 },
    { url: `${BASE_URL}/workshop`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/products/fabric/linen`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/wholesale`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/shipping`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/returns`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/products/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...productPages];
}
