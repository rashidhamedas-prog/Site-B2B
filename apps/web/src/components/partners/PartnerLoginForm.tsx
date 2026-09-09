'use client';

import { useState } from 'react';
import { Eye, EyeOff, Lock, Phone } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

export function PartnerLoginForm() {
  const { login, loading, error } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void login({ phone, password, purpose: 'vendor' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="partner-phone" className="mb-2 block text-sm font-medium text-gray-800">
          شماره موبایلی که با آن دعوت شدید
        </label>
        <div className="relative">
          <input
            id="partner-phone"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0915…"
            required
            dir="ltr"
            className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Phone className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
        </div>
      </div>
      <div>
        <label htmlFor="partner-password" className="mb-2 block text-sm font-medium text-gray-800">
          رمز موقت
        </label>
        <div className="relative">
          <input
            id="partner-password"
            type={showPass ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Lock className="pointer-events-none absolute right-4 top-3.5 h-4 w-4 text-gray-400" />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute left-3 top-2 inline-flex min-h-11 min-w-11 items-center justify-center text-gray-500"
            aria-label={showPass ? 'پنهان کردن رمز' : 'نمایش رمز'}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? 'در حال ورود…' : 'ورود به پنل همکار'}
      </button>
    </form>
  );
}
