'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { canEnterAdmin } from '@/lib/admin-session';
import { getRole, getToken } from '@/lib/auth';

export function AdminSessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (canEnterAdmin(getToken(), getRole())) {
      setAllowed(true);
      return;
    }
    const next = `/admin/login?redirect=${encodeURIComponent(pathname || '/admin')}`;
    window.location.replace(next);
  }, [pathname]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        در حال بررسی نشست مدیریت…
      </div>
    );
  }

  return <>{children}</>;
}
