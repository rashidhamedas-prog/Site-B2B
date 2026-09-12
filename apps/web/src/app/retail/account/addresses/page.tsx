'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { getRetailAddresses, replaceRetailAddresses, toRetailAddress } from '@/lib/retail-addresses';
import { RetailAccountDetails, type AccountProfile } from '@/components/retail/RetailAccountDetails';

export default function RetailAddressesPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<AccountProfile>('/auth/me/profile')
      .then((me) => {
        if (me.addresses?.length) {
          replaceRetailAddresses(me.addresses.map(toRetailAddress));
          setProfile(me);
        } else {
          setProfile({ ...me, addresses: getRetailAddresses() });
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری آدرس‌ها ناموفق بود'));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!profile) return <p className="text-sm text-[var(--retail-muted)]">در حال بارگذاری آدرس‌ها…</p>;

  return <RetailAccountDetails profile={profile} section="addresses" onProfileChange={setProfile} />;
}
