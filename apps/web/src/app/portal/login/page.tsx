import type { Metadata } from 'next';
import { PortalLoginAuth } from '@/components/auth/PortalLoginAuth';

export const metadata: Metadata = { title: 'ورود به پنل مشتری' };

export default function LoginPage() {
  return <PortalLoginAuth />;
}
