'use client';

import { useState } from 'react';
import { Eye, EyeOff, Lock, Phone, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';

export function AdminLoginForm() {
  const { login, loading, error } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ phone, password });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo card */}
      <div className="text-center mb-8">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white/95 p-2 shadow-xl shadow-primary/30 mb-4">
          <img src="/logo-512.png" alt="لوگوی پوشاک ترنم" className="h-full w-full object-contain" />
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-1">پنل مدیریت ترنم</h1>
        <p className="text-gray-400 text-sm">ورود اختصاصی مدیران سیستم</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-800/60 backdrop-blur-xl rounded-3xl p-8 space-y-5 shadow-2xl border border-white/5">
        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-red-500 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">شماره موبایل</label>
          <div className="relative">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09152424624"
              required
              dir="ltr"
              className="w-full bg-gray-700/50 border border-gray-600 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-left"
            />
            <Phone className="absolute left-4 top-4 h-4 w-4 text-gray-500" />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">رمز عبور</label>
            <button type="button" className="text-xs text-primary hover:text-primary-light transition-colors">
              فراموشی رمز؟
            </button>
          </div>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-gray-700/50 border border-gray-600 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <Lock className="absolute right-4 top-4 h-4 w-4 text-gray-500" />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute left-4 top-4 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-primary to-primary-light hover:from-primary-dark hover:to-primary disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              در حال ورود...
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              ورود امن به پنل مدیریت
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-6 text-center space-y-3">
        <div className="flex items-center justify-center gap-3 text-gray-600 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-success" />
            <span>اتصال امن SSL</span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            <span>رمزگذاری end-to-end</span>
          </div>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="h-3 w-3 rtl-flip" />
          بازگشت به سایت
        </Link>
      </div>
    </div>
  );
}
