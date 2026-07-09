import type { Metadata } from 'next';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = { title: 'ورود به پنل مدیریت | ترنم' };

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        {/* Grid pattern */}
        <svg className="absolute inset-0 h-full w-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <AdminLoginForm />
      </div>

      {/* Bottom version */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-[10px] text-gray-700">
          پوشاک ترنم · نسخه ۱.۰ · <ShieldCheck className="inline h-3 w-3" /> امنیت تضمینی
        </p>
      </div>
    </div>
  );
}
