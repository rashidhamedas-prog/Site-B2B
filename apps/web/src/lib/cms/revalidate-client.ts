import { getToken } from '@/lib/auth';
import type { CmsChannel } from './revalidate-storefront';

/** Bust ISR/data cache after a CMS save so the public home is not a year-stale CDN copy. */
export async function revalidateStorefrontAfterSave(channel: CmsChannel, pageKey: string) {
  try {
    const token = getToken();
    // Not under `/api/*` — nginx sends that prefix to Nest, not Next.
    await fetch('/admin/cms/revalidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ channel, pageKey }),
    });
  } catch {
    /* save already succeeded; stale HTML is the remaining risk */
  }
}
