import type { Metadata } from 'next';
import { PortalRegisterAuth } from '@/components/auth/PortalRegisterAuth';

export const metadata: Metadata = {
  title: 'همکاری با تولیدی لباس',
  description:
    'درخواست همکاری با تولیدی پوشاک ترنم در مشهد. بعد از بررسی، قیمت عمده باز می‌شود. حداقل سفارش هر مدل از ۶ عدد است.',
};

export default function RegisterPage() {
  return <PortalRegisterAuth />;
}
