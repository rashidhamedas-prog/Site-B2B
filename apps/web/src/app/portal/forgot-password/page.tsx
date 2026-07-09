import type { Metadata } from 'next';
import Link from 'next/link';
import { Phone } from 'lucide-react';

export const metadata: Metadata = { title: 'بازیابی رمز عبور | ترنم' };

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-bl from-primary-dark via-primary to-primary-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-white text-3xl font-extrabold mb-4 backdrop-blur-sm">
            ت
          </div>
          <h1 className="text-2xl font-extrabold text-white">بازیابی رمز عبور</h1>
          <p className="text-white/60 text-sm mt-1">برای دریافت رمز جدید با پشتیبانی تماس بگیرید</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto">
            <Phone className="h-8 w-8 text-primary" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">تماس با پشتیبانی</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              برای بازیابی رمز عبور لطفاً با تیم پشتیبانی ترنم تماس بگیرید.
              کارشناسان ما در اسرع وقت پاسخگو خواهند بود.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="tel:09152424624"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
            >
              <Phone className="h-4 w-4" />
              ۰۹۱۵ ۲۴۲ ۴۶۲۴
            </a>
            <a
              href="https://t.me/toliditaranom"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-primary text-primary font-medium hover:bg-primary-50 transition-colors"
            >
              تلگرام: toliditaranom@
            </a>
          </div>

          <p className="text-xs text-gray-400">
            ساعات پاسخگویی: شنبه تا چهارشنبه ۸ تا ۱۷
          </p>
        </div>

        <p className="text-center text-sm text-white/60 mt-6">
          رمز عبور را به یاد آوردید؟{' '}
          <Link href="/portal/login" className="text-secondary hover:underline font-medium">
            بازگشت به ورود
          </Link>
        </p>
      </div>
    </div>
  );
}
