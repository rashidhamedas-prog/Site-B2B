import type { Metadata } from 'next';
import { LoginForm } from '@/components/portal/LoginForm';

export const metadata: Metadata = { title: 'ورود به پنل مشتری' };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-bl from-primary-dark via-primary to-primary-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white/95 border border-white/20 p-2 mb-4 shadow-xl">
            <img src="/logo-512.png" alt="لوگوی پوشاک ترنم" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">پنل مشتری ترنم</h1>
          <p className="text-white/60 text-sm mt-1">برای ادامه وارد شوید</p>
        </div>

        <LoginForm />

        <p className="text-center text-sm text-white/60 mt-6">
          هنوز ثبت‌نام نکرده‌اید؟{' '}
          <a href="/portal/register" className="text-secondary hover:underline font-medium">
            درخواست عضویت
          </a>
        </p>
      </div>
    </div>
  );
}
