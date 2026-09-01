'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname.replace(/\/+$/, '') === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      <AdminSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0 min-h-screen">
        <AdminHeader onMenuToggle={() => setMobileOpen(true)} />
        <main className="flex-1 w-full p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
