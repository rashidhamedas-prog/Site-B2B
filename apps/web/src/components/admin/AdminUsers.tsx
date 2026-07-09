'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Save, UserCheck, UserX, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

interface User {
  id: string;
  phone: string;
  email?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  ADMIN:    { label: 'ادمین',    color: 'bg-primary-100 text-primary' },
  MANAGER:  { label: 'مدیر',     color: 'bg-blue-100 text-blue-700' },
  CUSTOMER: { label: 'مشتری',   color: 'bg-gray-100 text-gray-600' },
};

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ phone: '', email: '', password: '', role: 'ADMIN' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: User[] }>('/users?limit=50');
      setUsers(res.data);
    } catch {
      // endpoint may not exist yet — show empty state
      setUsers([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.phone || !form.password) { setError('شماره و رمز الزامی است'); return; }
    setSaving(true); setError('');
    try {
      await apiClient.post('/users', form);
      setShowCreate(false);
      setForm({ phone: '', email: '', password: '', role: 'ADMIN' });
      load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'خطا'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await apiClient.patch(`/users/${id}`, { isActive: !current });
      load();
    } catch {}
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">کاربران سیستم</h2>
          <p className="text-sm text-gray-500 mt-0.5">مدیریت ادمین‌ها و دسترسی‌ها</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-md flex items-center gap-2">
          <Plus className="h-4 w-4" />افزودن ادمین
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['شماره موبایل', 'ایمیل', 'نقش', 'آخرین ورود', 'وضعیت', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-24" /></td>
              ))}</tr>
            )) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                کاربری یافت نشد — endpoint <code>/v1/users</code> باید اضافه شود
              </td></tr>
            ) : users.filter((u) => u.role !== 'CUSTOMER').map((u) => {
              const r = ROLE_MAP[u.role] ?? { label: u.role, color: 'bg-gray-100 text-gray-600' };
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{u.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', r.color)}>
                      <Shield className="h-3 w-3" />{r.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('fa-IR') : 'هرگز'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {u.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(u.id, u.isActive)}
                      className={cn('text-xs hover:underline', u.isActive ? 'text-error' : 'text-success')}>
                      {u.isActive ? <UserX className="h-4 w-4 inline" /> : <UserCheck className="h-4 w-4 inline" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">افزودن ادمین جدید</h3>
              <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { key: 'phone', label: 'شماره موبایل', type: 'tel' },
                { key: 'email', label: 'ایمیل (اختیاری)', type: 'email' },
                { key: 'password', label: 'رمز عبور', type: 'password' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type} value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">نقش</label>
                <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="ADMIN">ادمین</option>
                  <option value="MANAGER">مدیر</option>
                </select>
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowCreate(false)} className="btn btn-outline btn-md">انصراف</button>
              <button onClick={handleCreate} disabled={saving} className="btn btn-primary btn-md flex items-center gap-2">
                <Save className="h-4 w-4" />{saving ? 'ذخیره...' : 'افزودن'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
