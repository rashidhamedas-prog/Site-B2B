import type { Metadata } from 'next';
import { RegisterForm } from '@/components/portal/RegisterForm';

export const metadata: Metadata = { title: 'درخواست عضویت عمده‌فروشی' };

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-bl from-primary-dark via-primary to-primary-light flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-white text-3xl font-extrabold mb-4 backdrop-blur-sm">
            ت
          </div>
          <h1 className="text-2xl font-extrabold text-white">درخواست عضویت ترنم</h1>
          <p className="text-white/60 text-sm mt-1">اطلاعات کسب‌وکار خود را وارد کنید</p>
        </div>

        <RegisterForm />

        <p className="text-center text-sm text-white/60 mt-6">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <a href="/portal/login" className="text-secondary hover:underline font-medium">
            ورود به پنل
          </a>
        </p>
      </div>
    </div>
  );
}
