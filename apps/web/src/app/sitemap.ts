import type { MetadataRoute } from 'next';
import {
  API_URL,
  getSeoChannel,
  RETAIL_ORIGIN,
  WHOLESALE_ORIGIN,
} from '@/lib/seo';
import { fetchSitemapPosts } from '@/lib/blog';

interface ProductRow {
  slug: string;
  updatedAt?: string;
}

interface BlogPostRow {
  slug: string;
  updatedAt?: string;
  publishedAt?: string;
  sitemapPriority?: number;
  sitemapChangeFrequency?: string;
}

async function getProducts(
  channel: 'WHOLESALE' | 'RETAIL',
): Promise<ProductRow[]> {
  try {
    const response = await fetch(
      `${API_URL}/products?limit=500&channel=${channel}`,
      {
        next: {
          revalidate: 3600,
        },
      },
    );

    if (!response.ok) {
      return [];
    }

    const json = await response.json();
    const data = json.data ?? json ?? [];

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function productEntries(
  origin: string,
  products: ProductRow[],
): MetadataRoute.Sitemap {
  return products
    .filter((product) => product?.slug)
    .map((product) => {
      const entry: MetadataRoute.Sitemap[number] = {
        url: `${origin}/products/${product.slug}`,
        changeFrequency: 'weekly',
        priority: 0.8,
      };

      if (product.updatedAt) {
        const updatedDate = new Date(product.updatedAt);

        if (!Number.isNaN(updatedDate.getTime())) {
          entry.lastModified = updatedDate;
        }
      }

      return entry;
    });
}

function blogEntries(
  origin: string,
  posts: BlogPostRow[],
): MetadataRoute.Sitemap {
  return posts
    .filter((post) => post?.slug)
    .map((post) => {
      const entry: MetadataRoute.Sitemap[number] = {
        url: `${origin}/blog/${post.slug}`,
        changeFrequency:
          (post.sitemapChangeFrequency as MetadataRoute.Sitemap[number]['changeFrequency']) ||
          'monthly',
        priority:
          typeof post.sitemapPriority === 'number'
            ? post.sitemapPriority
            : 0.55,
      };

      const dateValue = post.updatedAt || post.publishedAt;

      if (dateValue) {
        const modifiedDate = new Date(dateValue);

        if (!Number.isNaN(modifiedDate.getTime())) {
          entry.lastModified = modifiedDate;
        }
      }

      return entry;
    });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const channel = await getSeoChannel();
  const products = await getProducts(channel);
  const posts = await fetchSitemapPosts(channel);

  if (channel === 'RETAIL') {
    const origin = RETAIL_ORIGIN;

    const staticPages: MetadataRoute.Sitemap = [
      {
        url: origin,
        changeFrequency: 'daily',
        priority: 1,
      },
      {
        url: `${origin}/products`,
        changeFrequency: 'daily',
        priority: 0.9,
      },
      {
        url: `${origin}/collections`,
        changeFrequency: 'weekly',
        priority: 0.75,
      },
      {
        url: `${origin}/blog`,
        changeFrequency: 'weekly',
        priority: 0.65,
      },
      {
        url: `${origin}/about`,
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${origin}/contact`,
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: `${origin}/shipping`,
        changeFrequency: 'monthly',
        priority: 0.45,
      },
      {
        url: `${origin}/returns`,
        changeFrequency: 'monthly',
        priority: 0.45,
      },
    ];

    return [
      ...staticPages,
      ...productEntries(origin, products),
      ...blogEntries(origin, posts),
    ];
  }

  const origin = WHOLESALE_ORIGIN;

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: origin,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${origin}/products`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${origin}/linen-collection`,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${origin}/workshop`,
      changeFrequency: 'monthly',
      priority: 0.65,
    },
    {
      url: `${origin}/products/fabric/linen`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${origin}/products/fabric/cotton`,
      changeFrequency: 'weekly',
      priority: 0.65,
    },
    {
      url: `${origin}/products/fabric/crepe`,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${origin}/wholesale`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${origin}/about`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${origin}/contact`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${origin}/blog`,
      changeFrequency: 'weekly',
      priority: 0.65,
    },
    {
      url: `${origin}/shipping`,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${origin}/returns`,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${origin}/privacy`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${origin}/terms`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  return [
    ...staticPages,
    ...productEntries(origin, products),
    ...blogEntries(origin, posts),
  ];
}