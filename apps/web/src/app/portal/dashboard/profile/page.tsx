'use client';

import { useState, useEffect } from 'react';
import { User, Building, Phone, Mail, MapPin, Save, Lock } from 'lucide-react';
import { Button, Input, Alert } from '@/components/ui';
import { apiClient } from '@/lib/api';

interface Profile {
  userId: string;
  phone: string;
  role: string;
  businessName?: string;
  ownerName?: string;
  segment?: string;
  customerCode?: string;
  creditLimit?: number;
  totalSpent?: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ ownerName: '', email: '' });
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    apiClient.get<Profile>('/auth/me/profile')
      .then((data) => {
        setProfile(data);
        setForm({ ownerName: data.ownerName ?? '', email: '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch('/auth/me/profile', form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در ذخیره');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="card p-6 space-y-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-10 rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">پروفایل من</h1>
        <p className="text-sm text-gray-500 mt-1">اطلاعات حساب کاربری شما</p>
      </div>

      {success && <Alert variant="success">اطلاعات با موفقیت ذخیره شد.</Alert>}
      {error && <Alert variant="error" dismissible onDismiss={() => setError(null)}>{error}</Alert>}

      {/* Account info (read-only) */}
      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Building className="h-4 w-4 text-primary" />
          اطلاعات حساب
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray-400 mb-1">کد مشتری</p>
            <p className="font-mono text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{profile?.customerCode ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">سطح مشتری</p>
            <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{profile?.segment ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">نام کسب‌وکار</p>
            <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{profile?.businessName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">شماره موبایل</p>
            <p className="text-sm font-mono text-gray-900 bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2">
              <Phone className="h-3 w-3 text-gray-400" />{profile?.phone}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray-400 mb-1">سقف اعتبار</p>
            <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
              {profile?.creditLimit ? `${(profile.creditLimit / 10).toLocaleString('fa-IR')} تومان` : 'ندارد'}
            </p>
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          ویرایش اطلاعات
        </h2>
        <Input label="نام صاحب کسب‌وکار" value={form.ownerName}
          onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))}
          rightIcon={<User className="h-4 w-4" />} />
        <Input label="ایمیل (اختیاری)" type="email" value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          placeholder="info@example.com"
          rightIcon={<Mail className="h-4 w-4" />} />
        <Button variant="primary" onClick={saveProfile} loading={saving}
          rightIcon={<Save className="h-4 w-4" />}>
          ذخیره تغییرات
        </Button>
      </div>

      {/* Change password */}
      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          تغییر رمز عبور
        </h2>
        <Input label="رمز عبور فعلی" type="password" value={pwForm.current}
          onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} />
        <Input label="رمز عبور جدید" type="password" value={pwForm.next}
          onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))} />
        <Input label="تکرار رمز عبور جدید" type="password" value={pwForm.confirm}
          onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} />
        <Button variant="outline" onClick={async () => {
          if (pwForm.next !== pwForm.confirm) { setError('رمزهای جدید مطابقت ندارند'); return; }
          setSaving(true);
          try {
            await apiClient.patch('/auth/me/password', { current: pwForm.current, password: pwForm.next });
            setSuccess(true);
            setPwForm({ current: '', next: '', confirm: '' });
          } catch (e: unknown) { setError(e instanceof Error ? e.message : 'خطا'); }
          finally { setSaving(false); }
        }} loading={saving}>
          تغییر رمز عبور
        </Button>
      </div>
    </div>
  );
}
