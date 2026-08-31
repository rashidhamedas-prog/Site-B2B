'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { KeyRound, Plus, Save, Shield, UserCheck, UserX, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { STAFF_ROLE_LABELS, STAFF_ROLES, type StaffRole } from '@/lib/staff-access';
import { normalizePhone } from '@/lib/phone';

interface StaffUser {
  id: string;
  phone: string;
  email?: string | null;
  role: string;
  blogRole?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

const BLOG_ROLES = [
  'SUPER_ADMIN',
  'SEO_MANAGER',
  'CONTENT_MANAGER',
  'EDITOR',
  'AUTHOR',
  'REVIEWER',
  'VIEWER',
] as const;

const emptyForm = { phone: '', email: '', password: '', role: 'ADMIN' as StaffRole, blogRole: '' };
const fieldClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

export function AdminUsers() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [edit, setEdit] = useState<StaffUser | null>(null);
  const [resetFor, setResetFor] = useState<StaffUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ email: '', role: 'ADMIN' as StaffRole, blogRole: '' });
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  const load = useCallback(async (search?: string) => {
    setLoading(true);
    setListError('');
    try {
      const qs = search?.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
      const res = await apiClient.get<{ data: StaffUser[] }>(`/users${qs}`);
      setUsers(res.data ?? []);
    } catch (e: unknown) {
      setUsers([]);
      setListError(e instanceof Error ? e.message : 'بارگذاری کاربران ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.phone || !form.password) {
      setError('شماره و رمز الزامی است');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/users', {
        phone: normalizePhone(form.phone),
        email: form.email || undefined,
        password: form.password,
        role: form.role,
        blogRole: form.blogRole || undefined,
      });
      setShowCreate(false);
      setForm(emptyForm);
      load(q);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در ایجاد کاربر');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!edit) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.patch(`/users/${edit.id}`, {
        email: editForm.email || undefined,
        role: editForm.role,
        blogRole: editForm.blogRole || null,
      });
      setEdit(null);
      load(q);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در ویرایش');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: StaffUser) => {
    setError('');
    try {
      await apiClient.patch(`/users/${u.id}`, { isActive: !u.isActive });
      load(q);
    } catch (e: unknown) {
      setListError(e instanceof Error ? e.message : 'تغییر وضعیت ناموفق بود');
    }
  };

  const handleReset = async () => {
    if (!resetFor || newPassword.length < 8) {
      setError('رمز جدید حداقل ۸ کاراکتر');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/users/${resetFor.id}/reset-password`, { password: newPassword });
      setResetFor(null);
      setNewPassword('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'بازنشانی رمز ناموفق بود');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">کاربران سیستم</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            ادمین و نقش‌های داخلی — مشتریان در بخش CRM هستند
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setShowCreate(true);
          }}
          className="btn btn-primary btn-md flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          افزودن کاربر
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') load(q);
          }}
          placeholder="جستجو شماره یا ایمیل"
          className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <button type="button" onClick={() => load(q)} className="btn btn-outline btn-md">
          جستجو
        </button>
      </div>

      {listError ? <p className="text-sm text-error">{listError}</p> : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['شماره', 'ایمیل', 'نقش', 'وبلاگ', 'آخرین ورود', 'وضعیت', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="skeleton h-4 w-24 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                : users.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                        کاربری یافت نشد
                      </td>
                    </tr>
                    )
                  : users.map((u) => {
                      const label = STAFF_ROLE_LABELS[u.role as StaffRole] ?? u.role;
                      return (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">{u.phone}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{u.email || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary">
                              <Shield className="h-3 w-3" />
                              {label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{u.blogRole || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {u.lastLoginAt
                              ? new Date(u.lastLoginAt).toLocaleDateString('fa-IR')
                              : 'هرگز'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                              )}
                            >
                              {u.isActive ? 'فعال' : 'غیرفعال'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setError('');
                                  setEdit(u);
                                  setEditForm({
                                    email: u.email || '',
                                    role: (STAFF_ROLES as readonly string[]).includes(u.role)
                                      ? (u.role as StaffRole)
                                      : 'ADMIN',
                                    blogRole: u.blogRole || '',
                                  });
                                }}
                                className="text-xs text-primary hover:underline"
                              >
                                ویرایش
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setError('');
                                  setNewPassword('');
                                  setResetFor(u);
                                }}
                                className="text-gray-400 hover:text-primary"
                                title="بازنشانی رمز"
                              >
                                <KeyRound className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleActive(u)}
                                className={u.isActive ? 'text-error' : 'text-success'}
                                title={u.isActive ? 'غیرفعال' : 'فعال'}
                              >
                                {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? (
        <Modal title="افزودن کاربر سیستم" onClose={() => setShowCreate(false)}>
          <Field label="شماره موبایل">
            <input
              type="tel"
              dir="ltr"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className={fieldClass}
            />
          </Field>
          <Field label="ایمیل (اختیاری)">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className={fieldClass}
            />
          </Field>
          <Field label="رمز عبور (حداقل ۸ کاراکتر)">
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className={fieldClass}
            />
          </Field>
          <RoleSelect value={form.role} onChange={(role) => setForm((p) => ({ ...p, role }))} />
          <BlogSelect value={form.blogRole} onChange={(blogRole) => setForm((p) => ({ ...p, blogRole }))} />
          {error ? <p className="text-xs text-error">{error}</p> : null}
          <ModalActions
            saving={saving}
            onCancel={() => setShowCreate(false)}
            onSave={handleCreate}
            saveLabel="افزودن"
          />
        </Modal>
      ) : null}

      {edit ? (
        <Modal title={`ویرایش ${edit.phone}`} onClose={() => setEdit(null)}>
          <Field label="ایمیل">
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              className={fieldClass}
            />
          </Field>
          <RoleSelect value={editForm.role} onChange={(role) => setEditForm((p) => ({ ...p, role }))} />
          <BlogSelect
            value={editForm.blogRole}
            onChange={(blogRole) => setEditForm((p) => ({ ...p, blogRole }))}
          />
          {error ? <p className="text-xs text-error">{error}</p> : null}
          <ModalActions
            saving={saving}
            onCancel={() => setEdit(null)}
            onSave={handleEdit}
            saveLabel="ذخیره"
          />
        </Modal>
      ) : null}

      {resetFor ? (
        <Modal title={`رمز جدید برای ${resetFor.phone}`} onClose={() => setResetFor(null)}>
          <Field label="رمز عبور جدید">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={fieldClass}
            />
          </Field>
          {error ? <p className="text-xs text-error">{error}</p> : null}
          <ModalActions
            saving={saving}
            onCancel={() => setResetFor(null)}
            onSave={handleReset}
            saveLabel="بازنشانی"
          />
        </Modal>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function RoleSelect({ value, onChange }: { value: StaffRole; onChange: (r: StaffRole) => void }) {
  return (
    <Field label="نقش">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StaffRole)}
        className={fieldClass}
      >
        {STAFF_ROLES.map((r) => (
          <option key={r} value={r}>
            {STAFF_ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </Field>
  );
}

function BlogSelect({ value, onChange }: { value: string; onChange: (r: string) => void }) {
  return (
    <Field label="نقش وبلاگ (اختیاری)">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
        <option value="">پیش‌فرض (سازگار با ادمین)</option>
        {BLOG_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label="بستن">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        <div className="space-y-4 p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  saving,
  onCancel,
  onSave,
  saveLabel,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <div className="-mx-6 -mb-6 flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
      <button type="button" onClick={onCancel} className="btn btn-outline btn-md">
        انصراف
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="btn btn-primary btn-md flex items-center gap-2"
      >
        <Save className="h-4 w-4" />
        {saving ? 'ذخیره...' : saveLabel}
      </button>
    </div>
  );
}
