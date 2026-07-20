import { getToken } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
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
      if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/auth/login')) {
        const { clearToken } = await import('./auth');
        clearToken();
        const isAdmin = window.location.pathname.startsWith('/admin');
        window.location.href = isAdmin ? '/admin/login' : '/portal/login';
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

  delete<T>(path: string, init?: RequestInit) {
    return this.request<T>(path, { ...init, method: 'DELETE' });
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
}

export const apiClient = new ApiClient();
