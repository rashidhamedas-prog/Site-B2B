'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../api';
import { setToken, clearToken, getToken, getRole } from '../auth';

interface LoginPayload { phone: string; password: string }
interface RegisterPayload { phone: string; password: string; ownerName: string; businessName: string; province: string; city: string; businessType?: string; notes?: string }

export function useAuth() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      setIsLoggedIn(true);
      setRole(getRole());
    }
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{ accessToken: string; role: string }>('/auth/login', payload);
      const onAdminLogin = window.location.pathname.startsWith('/admin');

      // Admin login form must only accept ADMIN accounts — otherwise customers
      // were bounced to the portal dashboard and thought /admin was broken.
      if (onAdminLogin && res.role !== 'ADMIN') {
        setError('این حساب دسترسی به پنل مدیریت ندارد');
        return;
      }

      setToken(res.accessToken, res.role);
      setIsLoggedIn(true);
      setRole(res.role);

      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect');
      const isAdmin = res.role === 'ADMIN';
      let target = isAdmin ? '/admin' : '/portal/dashboard';

      if (redirect) {
        const wantsAdmin = redirect.startsWith('/admin');
        if ((isAdmin && wantsAdmin) || (!isAdmin && !wantsAdmin)) {
          target = redirect;
        }
      }

      // Hard navigation ensures middleware sees auth cookies (router.push can race)
      window.location.href = target;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در ورود');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const register = useCallback(async (payload: RegisterPayload) => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/auth/register', payload);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت‌نام');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setIsLoggedIn(false);
    setRole(null);
    router.push('/portal/login');
  }, [router]);

  return { isLoggedIn, role, loading, error, login, register, logout };
}
