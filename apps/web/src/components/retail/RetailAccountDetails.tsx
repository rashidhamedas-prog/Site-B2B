'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { IRAN_PROVINCES } from '@/lib/iran-provinces';
import { ShippingAddressForm } from '@/components/checkout/ShippingAddressForm';
import {
  replaceRetailAddresses,
  saveRetailAddress,
  sameRetailAddress,
  toRetailAddress,
  type RetailAddress,
} from '@/lib/retail-addresses';
import { emptyShippingAddress, hydrateShippingAddress, toSavedAddressPayload } from '@/lib/shipping-address';

export type ProfileAddress = RetailAddress & { id?: string; isDefault?: boolean };

export type AccountProfile = {
  ownerName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  province?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  addresses?: ProfileAddress[];
};

const emptyAddress = (): ProfileAddress => ({
  ...emptyShippingAddress(),
  isDefault: false,
});

function toLocal(a: ProfileAddress): RetailAddress {
  return toRetailAddress(a);
}

export function RetailAccountDetails({
  profile,
  onProfileChange,
  section = 'all',
}: {
  profile: AccountProfile;
  onProfileChange: (next: AccountProfile) => void;
  section?: 'profile' | 'addresses' | 'all';
}) {
  const [form, setForm] = useState({
    ownerName: profile.ownerName || '',
    email: profile.email || '',
    province: profile.province || 'خراسان رضوی',
    city: profile.city || '',
    postalCode: profile.postalCode || '',
    address: profile.address || '',
  });
  const [addresses, setAddresses] = useState<ProfileAddress[]>(profile.addresses || []);
  const [draft, setDraft] = useState<ProfileAddress>(emptyAddress());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    setForm({
      ownerName: profile.ownerName || '',
      email: profile.email || '',
      province: profile.province || 'خراسان رضوی',
      city: profile.city || '',
      postalCode: profile.postalCode || '',
      address: profile.address || '',
    });
    setAddresses(profile.addresses || []);
  }, [profile]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await apiClient.patch('/auth/me/profile', form);
      onProfileChange({ ...profile, ...form });
      setMsg('مشخصات ذخیره شد');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'ذخیره مشخصات ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  const persistAddresses = (list: ProfileAddress[]) => {
    setAddresses(list);
    replaceRetailAddresses(list.map(toLocal));
    onProfileChange({ ...profile, addresses: list });
  };

  const saveAddress = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const payload = toSavedAddressPayload(draft, { isDefault: draft.isDefault });
      const res = editingId
        ? await apiClient.patch<{ addresses: ProfileAddress[] }>(`/auth/me/addresses/${editingId}`, payload)
        : await apiClient.post<{ addresses: ProfileAddress[] }>('/auth/me/addresses', payload);
      persistAddresses(res.addresses || []);
      saveRetailAddress(toLocal(payload));
      setDraft(emptyAddress());
      setEditingId(null);
      setMsg(editingId ? 'آدرس ویرایش شد' : 'آدرس اضافه شد');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'ذخیره آدرس ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  const removeAddress = async (addr: ProfileAddress) => {
    if (typeof window !== 'undefined' && !window.confirm('این آدرس ارسال حذف شود؟')) return;
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      if (addr.id) {
        const res = await apiClient.delete<{ addresses: ProfileAddress[] }>(`/auth/me/addresses/${addr.id}`);
        persistAddresses(res.addresses || []);
      } else {
        persistAddresses(addresses.filter((a) => a !== addr));
      }
      if (editingId && (addr.id === editingId || sameRetailAddress(draft, addr))) {
        setDraft(emptyAddress());
        setEditingId(null);
      }
      setMsg('آدرس حذف شد');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'حذف آدرس ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {section === 'profile' || section === 'all' ? (
      <form onSubmit={saveProfile} className="space-y-3 rounded-2xl border border-[var(--retail-border)] bg-white p-4">
        <h2 className="text-lg font-bold">مشخصات حساب</h2>
        {profile.phone ? (
          <p className="text-sm text-[var(--retail-muted)]">موبایل ورود: {profile.phone}</p>
        ) : null}
        <input
          className="w-full rounded-xl border px-4 py-3 text-sm"
          placeholder="نام و نام خانوادگی"
          value={form.ownerName}
          onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))}
        />
        <input
          className="w-full rounded-xl border px-4 py-3 text-sm"
          placeholder="ایمیل (اختیاری)"
          type="email"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="w-full rounded-xl border px-4 py-3 text-sm"
            value={form.province}
            onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))}
          >
            {IRAN_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            className="w-full rounded-xl border px-4 py-3 text-sm"
            placeholder="شهر"
            value={form.city}
            onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
          />
        </div>
        <input
          className="w-full rounded-xl border px-4 py-3 text-sm"
          placeholder="کدپستی"
          value={form.postalCode}
          onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
        />
        <textarea
          className="w-full rounded-xl border px-4 py-3 text-sm"
          placeholder="آدرس کامل"
          rows={3}
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[var(--retail-primary)] px-5 py-2.5 text-sm font-extrabold text-white"
        >
          ذخیره مشخصات
        </button>
      </form>
      ) : null}

      {section === 'addresses' || section === 'all' ? (
      <div className="space-y-3">
        <h2 className="text-lg font-bold">آدرس‌های ارسال</h2>
        {addresses.length === 0 ? (
          <p className="text-sm text-[var(--retail-muted)]">هنوز آدرسی ذخیره نشده. از فرم زیر اضافه کنید.</p>
        ) : (
          addresses.map((a) => (
            <div key={a.id || `${a.street}-${a.mobile}`} className="rounded-2xl border border-[var(--retail-border)] bg-white p-4 text-sm">
              <p className="font-bold">
                {a.recipient} — {a.mobile}
                {a.isDefault ? <span className="mr-2 text-xs text-[var(--retail-primary)]">پیش‌فرض</span> : null}
              </p>
              <p className="mt-1 text-[var(--retail-muted)]">
                {a.province}، {a.city}
                {a.postalCode ? `، کدپستی ${a.postalCode}` : ''}
              </p>
              <p className="mt-1">{a.street}</p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className="text-xs font-bold text-[var(--retail-primary)]"
                  disabled={busy}
                  onClick={() => {
                    setDraft({ ...hydrateShippingAddress(a), id: a.id, isDefault: Boolean(a.isDefault) });
                    setEditingId(a.id || null);
                  }}
                >
                  ویرایش
                </button>
                <button
                  type="button"
                  className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-600"
                  disabled={busy}
                  onClick={() => void removeAddress(a)}
                >
                  حذف آدرس
                </button>
              </div>
            </div>
          ))
        )}

        <form onSubmit={saveAddress} className="space-y-3 rounded-2xl border border-dashed border-[var(--retail-border)] bg-white p-4">
          <h3 className="font-bold">{editingId ? 'ویرایش آدرس' : 'افزودن آدرس جدید'}</h3>
          <ShippingAddressForm
            appearance="retail"
            value={draft}
            onChange={(next) => setDraft((p) => ({ ...p, ...next }))}
            mode="standard"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(draft.isDefault)}
              onChange={(e) => setDraft((p) => ({ ...p, isDefault: e.target.checked }))}
            />
            آدرس پیش‌فرض
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-[var(--retail-gold)] px-5 py-2.5 text-sm font-extrabold text-white"
            >
              {editingId ? 'ذخیره آدرس' : 'افزودن آدرس'}
            </button>
            {editingId ? (
              <button
                type="button"
                className="rounded-full border px-5 py-2.5 text-sm font-bold"
                onClick={() => {
                  setDraft(emptyAddress());
                  setEditingId(null);
                }}
              >
                انصراف
              </button>
            ) : null}
          </div>
        </form>
      </div>
      ) : null}

      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
