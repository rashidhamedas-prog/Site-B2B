import type { Metadata } from 'next';
import { ForgotPasswordFlow } from '@/components/account/ForgotPasswordFlow';

export const metadata: Metadata = { title: 'بازیابی رمز عبور | ترنم' };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-bl from-primary-dark via-primary to-primary-light p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-3xl font-extrabold text-white backdrop-blur-sm">
            ت
          </div>
          <h1 className="text-2xl font-extrabold text-white">بازیابی رمز عبور</h1>
          <p className="mt-1 text-sm text-white/60">کد پیامکی می‌فرستیم تا رمز تازه بگذارید</p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <ForgotPasswordFlow
            variant="wholesale"
            loginHref="/portal/login"
            successHref="/portal/dashboard"
          />
        </div>
      </div>
    </div>
  );
}
