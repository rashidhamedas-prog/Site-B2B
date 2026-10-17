'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { SpAlert, SpCard, spField } from './SalesPartnerShell';
import { SpButton, spChipClass } from './SpUi';

export type SmsChannel = '' | 'instagram' | 'telegram' | 'rubika' | 'bale';

export type SmsProfile = {
  shopName: string;
  greeting: string;
  channel: SmsChannel;
  handle: string;
  preview: string;
  channels: { id: SmsChannel; label: string }[];
};

const EMPTY: SmsProfile = {
  shopName: '',
  greeting: '',
  channel: '',
  handle: '',
  preview: '',
  channels: [],
};

export function SalesPartnerSmsIdentity({
  onDirty,
  onSaved,
}: {
  onDirty?: (dirty: boolean) => void;
  onSaved?: (profile: SmsProfile) => void;
}) {
  const [profile, setProfile] = useState<SmsProfile>(EMPTY);
  const [shopName, setShopName] = useState('');
  const [greeting, setGreeting] = useState('');
  const [channel, setChannel] = useState<SmsChannel>('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<SmsProfile>('/sales-partners/me/sms-profile')
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setShopName(next.shopName);
        setGreeting(next.greeting);
        setChannel(next.channel || '');
        setHandle(next.handle);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری معرفی پیامک ناموفق بود');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = shopName !== profile.shopName
    || greeting !== profile.greeting
    || channel !== (profile.channel || '')
    || handle !== profile.handle;

  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const next = await apiClient.patch<SmsProfile>('/sales-partners/me/sms-profile', {
        shopName,
        greeting,
        channel,
        handle,
      });
      setProfile(next);
      setShopName(next.shopName);
      setGreeting(next.greeting);
      setChannel(next.channel || '');
      setHandle(next.handle);
      onSaved?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره معرفی پیامک ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  const channels = profile.channels.length
    ? profile.channels
    : [
        { id: 'instagram' as const, label: 'اینستاگرام' },
        { id: 'telegram' as const, label: 'تلگرام' },
        { id: 'rubika' as const, label: 'روبیکا' },
        { id: 'bale' as const, label: 'بله' },
      ];

  return (
    <SpCard className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-stone-900">معرفی شما در پیامک مشتری</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          فقط نام فروشگاه، یک جملهٔ کوتاه و شناسهٔ پیج یا کانال مال شماست. جملهٔ تأیید، نام پوشاک ترنم و لینک پرداخت را
          خود فروشگاه می‌نویسد و عوض نمی‌شود.
        </p>
      </div>
      {error ? <SpAlert>{error}</SpAlert> : null}
      {loading ? <p className="text-sm text-stone-500">در حال خواندن معرفی ذخیره‌شده…</p> : null}
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="sp-sms-shop">
          نام فروشگاه
        </label>
        <input
          id="sp-sms-shop"
          className={spField}
          value={shopName}
          maxLength={32}
          placeholder="مثلاً مزون سارا"
          onChange={(event) => setShopName(event.target.value)}
        />
        <p className="mt-1 text-xs text-stone-500">اگر خالی بماند، نام حساب شما در پیامک می‌آید. لینک و نام ترنم پذیرفته نمی‌شود.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="sp-sms-greet">
          جملهٔ معرفی (اختیاری)
        </label>
        <input
          id="sp-sms-greet"
          className={spField}
          value={greeting}
          maxLength={40}
          placeholder="مثلاً سلام، سبد شما آماده است"
          onChange={(event) => setGreeting(event.target.value)}
        />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium" id="sp-sms-channel-label">پیج یا کانال</p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="sp-sms-channel-label">
          <button type="button" className={spChipClass(channel === '')} aria-pressed={channel === ''} onClick={() => { setChannel(''); setHandle(''); }}>
            ندارد
          </button>
          {channels.map((item) => (
            <button
              key={item.id}
              type="button"
              className={spChipClass(channel === item.id)}
              aria-pressed={channel === item.id}
              onClick={() => setChannel(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {channel ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="sp-sms-handle">
            شناسه
          </label>
          <input
            id="sp-sms-handle"
            className={spField}
            dir="ltr"
            value={handle}
            maxLength={24}
            placeholder="@shop_name"
            autoComplete="off"
            onChange={(event) => setHandle(event.target.value)}
          />
          <p className="mt-1 text-xs text-stone-500">فقط شناسه، بدون آدرس سایت. مثلاً sara.shop</p>
        </div>
      ) : null}
      <SpButton disabled={busy || loading || !dirty} onClick={() => void save()}>
        {busy ? 'در حال ذخیره…' : 'ذخیره معرفی'}
      </SpButton>
      {profile.preview ? (
        <div>
          <p className="mb-1.5 text-sm font-medium" id="sp-sms-preview-label">نمونهٔ پیامک ذخیره‌شده</p>
          <pre
            aria-labelledby="sp-sms-preview-label"
            className="whitespace-pre-wrap rounded-2xl bg-[#f6f3ee] p-3 text-sm leading-7 text-stone-800"
          >
            {profile.preview}
          </pre>
          <p className="mt-1 text-xs text-stone-500">لینک واقعی فقط هنگام ارسال ساخته می‌شود و در نمونه با «…» آمده است.</p>
        </div>
      ) : null}
    </SpCard>
  );
}
