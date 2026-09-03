'use client';

import { useState, useEffect } from 'react';
import { User, Building, Phone, Mail, MapPin, Save } from 'lucide-react';
import { Button, Input, Alert } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { IRAN_PROVINCES } from '@/lib/iran-provinces';

interface SavedAddress {
  id?: string;
  recipient: string;
  mobile: string;
  province: string;
  city: string;
  street: string;
  postalCode?: string;
  isDefault?: boolean;
}

interface Profile {
  userId: string;
  phone: string;
  role: string;
  email?: string;
  businessName?: string;
  ownerName?: string;
  province?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  addresses?: SavedAddress[];
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

  const [form, setForm] = useState({
    ownerName: '',
    email: '',
    businessName: '',
    province: 'خراسان رضوی',
    city: '',
    postalCode: '',
    address: '',
  });
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addrDraft, setAddrDraft] = useState<SavedAddress>({
    recipient: '',
    mobile: '',
    province: 'خراسان رضوی',
    city: '',
    street: '',
    postalCode: '',
    isDefault: false,
  });
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<Profile>('/auth/me/profile')
      .then((data) => {
        setProfile(data);
        setForm({
          ownerName: data.ownerName ?? '',
          email: data.email ?? '',
          businessName: data.businessName ?? '',
          province: data.province ?? 'خراسان رضوی',
          city: data.city ?? '',
          postalCode: data.postalCode ?? '',
          address: data.address ?? '',
        });
        setAddresses(data.addresses ?? []);
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
        <Input label="نام فروشگاه / کسب‌وکار" value={form.businessName}
          onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))}
          rightIcon={<Building className="h-4 w-4" />} />
        <Input label="ایمیل (اختیاری)" type="email" value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          placeholder="info@example.com"
          rightIcon={<Mail className="h-4 w-4" />} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">استان</label>
          <select
            className="block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.province}
            onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
          >
            {IRAN_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <Input label="شهر" value={form.city}
          onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
          rightIcon={<MapPin className="h-4 w-4" />} />
        <Input label="کدپستی" value={form.postalCode}
          onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} />
        <Input label="آدرس" value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          rightIcon={<MapPin className="h-4 w-4" />} />
        <Button variant="primary" onClick={saveProfile} loading={saving}
          rightIcon={<Save className="h-4 w-4" />}>
          ذخیره تغییرات
        </Button>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          آدرس‌های ارسال
        </h2>
        {addresses.length === 0 ? (
          <p className="text-sm text-gray-500">هنوز آدرس ارسالی ذخیره نشده. از فرم زیر اضافه کنید.</p>
        ) : (
          addresses.map((a) => (
          <div key={a.id || `${a.street}-${a.mobile}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
            <p className="font-bold">{a.recipient} — {a.mobile}{a.isDefault ? ' (پیش‌فرض)' : ''}</p>
            <p className="mt-1 text-gray-600">{a.province}، {a.city} — {a.street}</p>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                className="text-xs font-bold text-primary"
                disabled={saving}
                onClick={() => {
                  setAddrDraft(a);
                  setEditingAddressId(a.id || null);
                }}
              >
                ویرایش
              </button>
              <button
                type="button"
                className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600"
                disabled={saving}
                onClick={async () => {
                  if (typeof window !== 'undefined' && !window.confirm('این آدرس ارسال حذف شود؟')) return;
                  setSaving(true);
                  setError(null);
                  try {
                    if (a.id) {
                      const res = await apiClient.delete<{ addresses: SavedAddress[] }>(`/auth/me/addresses/${encodeURIComponent(a.id)}`);
                      setAddresses(res.addresses || []);
                    } else {
                      setAddresses((prev) => prev.filter((row) => row !== a));
                    }
                    if (editingAddressId && a.id === editingAddressId) {
                      setEditingAddressId(null);
                      setAddrDraft({
                        recipient: '',
                        mobile: '',
                        province: form.province || 'خراسان رضوی',
                        city: form.city,
                        street: '',
                        postalCode: '',
                        isDefault: false,
                      });
                    }
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : 'حذف ناموفق');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                حذف آدرس
              </button>
            </div>
          </div>
          ))
        )}
        <Input label="گیرنده" value={addrDraft.recipient}
          onChange={(e) => setAddrDraft((p) => ({ ...p, recipient: e.target.value }))} />
        <Input label="موبایل گیرنده" value={addrDraft.mobile}
          onChange={(e) => setAddrDraft((p) => ({ ...p, mobile: e.target.value }))} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">استان</label>
          <select
            className="block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            value={addrDraft.province}
            onChange={(e) => setAddrDraft((p) => ({ ...p, province: e.target.value }))}
          >
            {IRAN_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <Input label="شهر" value={addrDraft.city}
          onChange={(e) => setAddrDraft((p) => ({ ...p, city: e.target.value }))} />
        <Input label="کدپستی" value={addrDraft.postalCode || ''}
          onChange={(e) => setAddrDraft((p) => ({ ...p, postalCode: e.target.value }))} />
        <Input label="نشانی" value={addrDraft.street}
          onChange={(e) => setAddrDraft((p) => ({ ...p, street: e.target.value }))} />
        <Button
          variant="outline"
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              const res = editingAddressId
                ? await apiClient.patch<{ addresses: SavedAddress[] }>(`/auth/me/addresses/${editingAddressId}`, addrDraft)
                : await apiClient.post<{ addresses: SavedAddress[] }>('/auth/me/addresses', addrDraft);
              setAddresses(res.addresses || []);
              setSuccess(true);
              setEditingAddressId(null);
              setAddrDraft({
                recipient: '',
                mobile: '',
                province: form.province || 'خراسان رضوی',
                city: form.city,
                street: '',
                postalCode: '',
                isDefault: false,
              });
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : 'ذخیره آدرس ناموفق بود');
            } finally {
              setSaving(false);
            }
          }}
          loading={saving}
        >
          {editingAddressId ? 'ذخیره آدرس' : 'افزودن آدرس'}
        </Button>
      </div>
    </div>
  );
}
