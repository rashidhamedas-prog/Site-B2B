'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { getRetailAddresses, replaceRetailAddresses } from '@/lib/retail-addresses';
import { RetailAccountDetails, type AccountProfile } from '@/components/retail/RetailAccountDetails';

export default function RetailProfilePage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<AccountProfile>('/auth/me/profile')
      .then((me) => {
        if (!me.addresses?.length) {
          const local = getRetailAddresses();
          setProfile({ ...me, addresses: local });
        } else {
          replaceRetailAddresses(
            me.addresses.map((a) => ({
              recipient: a.recipient,
              mobile: a.mobile,
              province: a.province,
              city: a.city,
              street: a.street,
              postalCode: a.postalCode || '',
            })),
          );
          setProfile(me);
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'بارگذاری مشخصات ناموفق بود'));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!profile) return <p className="text-sm text-[var(--retail-muted)]">در حال بارگذاری مشخصات…</p>;

  return <RetailAccountDetails profile={profile} section="profile" onProfileChange={setProfile} />;
}
