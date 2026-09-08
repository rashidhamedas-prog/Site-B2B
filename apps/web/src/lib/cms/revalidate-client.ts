import { getToken } from '@/lib/auth';
import type { CmsChannel } from './revalidate-storefront';

export type RevalidateResult = {
  ok: boolean;
  status?: number;
  paths?: string[];
  error?: string;
};

/** Bust ISR/data cache after a CMS save so .ir/.com are not stuck on year-SWR HIT. */
export async function revalidateStorefrontAfterSave(
  channel: CmsChannel,
  pageKey: string,
): Promise<RevalidateResult> {
  try {
    const token = getToken();
    // Not under `/api/*` — nginx sends that prefix to Nest, not Next.
    const res = await fetch('/admin/cms/revalidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ channel, pageKey }),
    });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: res.status === 401 || res.status === 307 ? 'نشست ادمین برای تازه‌سازی ویترین کافی نیست' : `HTTP ${res.status}`,
      };
    }
    const data = (await res.json().catch(() => null)) as { ok?: boolean; paths?: string[] } | null;
    return { ok: data?.ok !== false, status: res.status, paths: data?.paths };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' };
  }
}
