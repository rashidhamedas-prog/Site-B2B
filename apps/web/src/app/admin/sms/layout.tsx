'use client';

import { AdminSmsShell } from '@/components/admin/sms/AdminSmsShell';

export default function SmsLayout({ children }: { children: React.ReactNode }) {
  return <AdminSmsShell>{children}</AdminSmsShell>;
}
