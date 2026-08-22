import { getToken } from './auth';

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

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
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
          const err = new Error('خطای سرور') as Error & { status: number };
          err.status = res.status;
          throw err;
        }
      }
    }

    if (!res.ok) {
      const message = data?.message ?? data?.errors?.[0]?.message ?? 'خطای سرور';
      const err = new Error(Array.isArray(message) ? message[0] : message) as Error & { status: number };
      err.status = res.status;
      // Only auto-redirect on 401 if this is NOT a login request (avoid redirect loop)
      if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/auth/login') && !path.includes('/auth/retail')) {
        const { clearToken } = await import('./auth');
        clearToken();
        const pathName = window.location.pathname;
        if (pathName.startsWith('/admin')) {
          window.location.href = '/admin/login';
        } else if (pathName.startsWith('/retail') || pathName.startsWith('/account')) {
          window.location.href = `/account?redirect=${encodeURIComponent(pathName)}`;
        } else {
          window.location.href = '/portal/login';
        }
      }
      throw err;
    }

    return data as T;
  }

  get<T>(path: string, init?: RequestInit) {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  post<T>(path: string, body: unknown, init?: RequestInit) {
    return this.request<T>(path, { ...init, method: 'POST', body: JSON.stringify(body) });
  }

  put<T>(path: string, body: unknown, init?: RequestInit) {
    return this.request<T>(path, { ...init, method: 'PUT', body: JSON.stringify(body) });
  }

  patch<T>(path: string, body: unknown, init?: RequestInit) {
    return this.request<T>(path, { ...init, method: 'PATCH', body: JSON.stringify(body) });
  }

  delete<T>(path: string, body?: unknown, init?: RequestInit) {
    return this.request<T>(path, {
      ...init,
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async uploadImage(file: File): Promise<{ url: string; key: string }> {
    const token = getToken();
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) {
      const message = data?.message ?? 'خطا در آپلود تصویر';
      throw new Error(Array.isArray(message) ? message[0] : message);
    }
    return data;
  }

  async download(path: string, fallbackName: string): Promise<void> {
    const token = getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/auth/login')) {
      const { clearToken } = await import('./auth');
      clearToken();
      const pathName = window.location.pathname;
      if (pathName.startsWith('/admin')) window.location.href = '/admin/login';
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
