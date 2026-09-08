import { getToken } from '@/lib/auth';
import type { CmsChannel } from './revalidate-storefront';

/** Bust ISR/data cache after a CMS save so the public home is not a year-stale CDN copy. */
export async function revalidateStorefrontAfterSave(channel: CmsChannel, pageKey: string) {
  const token = getToken();
  const res = await fetch('/api/cms/revalidate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ channel, pageKey }),
  });
  if (!res.ok) {
    throw new Error('محتوا ذخیره شد، اما تازه‌سازی ویترین ناموفق بود. دوباره ذخیره کنید.');
  }
}
