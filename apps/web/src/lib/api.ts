import { getToken } from './auth';
import {
  resolveShopperLoginUrl,
  shouldSkipAuthRedirect,
} from './shopper-auth-redirect';
import { UPLOAD_FETCH_TIMEOUT_MS, UPLOAD_TIMEOUT_MESSAGE } from './upload-image';

export type ApiRequestOptions = RequestInit & { authRedirect?: boolean };

function resolveApiBase(): string {
  // Browser on production hosts: same-origin /api (avoids CORS between .ir ↔ .com)
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('poshaktaranom.com') ||
      host.endsWith('poshaktaranom.ir')
    ) {
      // local next without nginx still needs absolute API
      if (host === 'localhost' || host === '127.0.0.1') {
        return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
      }
      return '/api/v1';
    }
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
}

class ApiClient {
  private get baseUrl() {
    return resolveApiBase();
  }

  private async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { authRedirect = true, ...fetchOptions } = options;
    const token = getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      cache: 'no-store',
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions.headers,
      },
    });

    if (res.status === 204) return undefined as T;

    let data: any = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (!res.ok) {
          const restarting = res.status === 502 || res.status === 503 || res.status === 504
            || /<!DOCTYPE|<html/i.test(text);
          const err = new Error(
            restarting
              ? 'سرور در حال به‌روزرسانی است؛ چند ثانیه بعد صفحه را تازه کنید'
              : 'خطای سرور',
          ) as Error & { status: number };
          err.status = res.status;
          throw err;
        }
      }
    }

    if (!res.ok) {
      const message = data?.message ?? data?.errors?.[0]?.message ?? 'خطای سرور';
      const err = new Error(Array.isArray(message) ? message[0] : message) as Error & {
        status: number;
        remainingSeconds?: number;
        cooldownSeconds?: number;
        retryAfter?: number;
        code?: string;
      };
      err.status = res.status;
      if (typeof data?.remainingSeconds === 'number') err.remainingSeconds = data.remainingSeconds;
      if (typeof data?.cooldownSeconds === 'number') err.cooldownSeconds = data.cooldownSeconds;
      if (typeof data?.code === 'string') err.code = data.code;
      const retryRaw = res.headers.get('Retry-After');
      if (retryRaw) {
        const n = Number(retryRaw);
        if (Number.isFinite(n) && n > 0) err.retryAfter = Math.ceil(n);
      }
      if (
        res.status === 401 &&
        typeof window !== 'undefined' &&
        authRedirect !== false &&
        !shouldSkipAuthRedirect(path)
      ) {
        const { clearToken } = await import('./auth');
        clearToken();
        window.location.href = resolveShopperLoginUrl(
          window.location.pathname,
          window.location.hostname,
          window.location.search,
        );
      }
      throw err;
    }

    return data as T;
  }

  get<T>(path: string, init?: ApiRequestOptions) {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  post<T>(path: string, body: unknown, init?: ApiRequestOptions) {
    return this.request<T>(path, { ...init, method: 'POST', body: JSON.stringify(body) });
  }

  put<T>(path: string, body: unknown, init?: ApiRequestOptions) {
    return this.request<T>(path, { ...init, method: 'PUT', body: JSON.stringify(body) });
  }

  patch<T>(path: string, body: unknown, init?: ApiRequestOptions) {
    return this.request<T>(path, { ...init, method: 'PATCH', body: JSON.stringify(body) });
  }

  delete<T>(path: string, body?: unknown, init?: ApiRequestOptions) {
    return this.request<T>(path, {
      ...init,
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async uploadImage(
    file: File,
    opts?: { profile?: 'product' | 'categoryBanner' },
  ): Promise<{ url: string; key: string }> {
    const token = getToken();
    const fd = new FormData();
    fd.append('file', file);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPLOAD_FETCH_TIMEOUT_MS);
    const profile = opts?.profile === 'categoryBanner' ? 'categoryBanner' : '';
    const uploadUrl = profile
      ? `${this.baseUrl}/upload/image?profile=${encodeURIComponent(profile)}`
      : `${this.baseUrl}/upload/image`;
    let res: Response;
    try {
      res = await fetch(uploadUrl, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
        signal: ctrl.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(UPLOAD_TIMEOUT_MESSAGE);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let data: { url?: string; key?: string; message?: string | string[] } | null = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      const raw = data?.message ?? (res.status === 413 ? 'حجم عکس بیشتر از حد مجاز است.' : 'خطا در آپلود تصویر');
      throw new Error(Array.isArray(raw) ? raw[0] : raw);
    }
    if (!data?.url) throw new Error('آپلود تمام شد ولی آدرس عکس برنگشت.');
    return { url: data.url, key: data.key || '' };
  }

  async uploadPriceImportExcel(
    file: File,
    dryRun: boolean,
  ): Promise<{
    dryRun: boolean;
    applied: number;
    totalRows: number;
    matched: number;
    changed: number;
    skipped: number;
    errors: number;
    errorSamples?: Array<{ excelRow: number; sku: string; message: string }>;
    changeSamples?: Array<{
      excelRow: number;
      sku: string;
      before: {
        wholesalePrice: number;
        retailPrice: number | null;
        wholesaleCompareAtPrice: number | null;
        retailCompareAtPrice: number | null;
      };
      after: {
        wholesalePrice: number;
        retailPrice: number | null;
        wholesaleCompareAtPrice: number | null;
        retailCompareAtPrice: number | null;
      };
    }>;
  }> {
    const token = getToken();
    const fd = new FormData();
    fd.append('file', file);
    const q = dryRun ? 'dryRun=1' : 'dryRun=0';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPLOAD_FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/products/admin/prices/import.xlsx?${q}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
        signal: ctrl.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('زمان آپلود اکسل تمام شد. دوباره تلاش کنید.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let data: { message?: string | string[] } | null = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      const raw = data?.message ?? 'خطا در آپلود اکسل قیمت';
      throw new Error(Array.isArray(raw) ? raw[0] : raw);
    }
    if (!data || typeof data !== 'object') {
      throw new Error('پاسخ سرور نامعتبر بود');
    }
    return data as {
      dryRun: boolean;
      applied: number;
      totalRows: number;
      matched: number;
      changed: number;
      skipped: number;
      errors: number;
      errorSamples?: Array<{ excelRow: number; sku: string; message: string }>;
      changeSamples?: Array<{
        excelRow: number;
        sku: string;
        before: {
          wholesalePrice: number;
          retailPrice: number | null;
          wholesaleCompareAtPrice: number | null;
          retailCompareAtPrice: number | null;
        };
        after: {
          wholesalePrice: number;
          retailPrice: number | null;
          wholesaleCompareAtPrice: number | null;
          retailCompareAtPrice: number | null;
        };
      }>;
    };
  }

  async download(
    path: string,
    fallbackName: string,
    opts?: Pick<ApiRequestOptions, 'authRedirect'>,
  ): Promise<void> {
    const authRedirect = opts?.authRedirect ?? true;
    const token = getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (
      res.status === 401 &&
      typeof window !== 'undefined' &&
      authRedirect !== false &&
      !shouldSkipAuthRedirect(path)
    ) {
      const { clearToken } = await import('./auth');
      clearToken();
      window.location.href = resolveShopperLoginUrl(
        window.location.pathname,
        window.location.hostname,
        window.location.search,
      );
      throw new Error('نشست شما منقضی شده است');
    }

    if (!res.ok) {
      let message = 'دانلود ناموفق بود';
      try {
        const data = await res.json();
        message = data?.message ?? data?.errors?.[0]?.message ?? message;
        if (Array.isArray(message)) message = message[0];
      } catch {
        /* ignore non-json */
      }
      throw new Error(message);
    }

    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
    const quoted = cd.match(/filename="([^"]+)"/i);
    const filename = star
      ? decodeURIComponent(star[1]!)
      : quoted?.[1] || fallbackName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

export const apiClient = new ApiClient();
