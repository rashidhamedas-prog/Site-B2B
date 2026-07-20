'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Alert } from '@/components/ui';
import { CheckCircle } from 'lucide-react';

const PROVINCES = [
  'تهران', 'اصفهان', 'فارس', 'خراسان رضوی', 'آذربایجان شرقی', 'آذربایجان غربی',
  'کرمان', 'مازندران', 'گیلان', 'خوزستان', 'سیستان و بلوچستان', 'البرز',
  'قم', 'قزوین', 'کردستان', 'کرمانشاه', 'همدان', 'اردبیل', 'سمنان', 'یزد',
  'زنجان', 'گلستان', 'لرستان', 'چهارمحال و بختیاری', 'کهگیلویه و بویراحمد',
  'خراسان شمالی', 'خراسان جنوبی', 'ایلام', 'بوشهر', 'مرکزی', 'هرمزگان',
];

export function RegisterForm() {
  const { register, loading, error } = useAuth();
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    businessName: '', ownerName: '', phone: '', password: '', confirmPassword: '',
    province: '', city: '', businessType: 'RETAIL', notes: '',
  });
  const [localError, setLocalError] = useState('');

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!/^09[0-9]{9}$/.test(form.phone)) { setLocalError('شماره موبایل معتبر نیست'); return; }
    if (form.password.length < 6) { setLocalError('رمز عبور حداقل ۶ کاراکتر'); return; }
    if (form.password !== form.confirmPassword) { setLocalError('رمز عبور با تکرار آن مطابقت ندارد'); return; }
    if (!form.businessName || !form.ownerName || !form.province || !form.city) {
      setLocalError('لطفاً تمام فیلدهای ستاره‌دار را پر کنید'); return;
    }

    const ok = await register({
      businessName: form.businessName,
      ownerName: form.ownerName,
      phone: form.phone,
      password: form.password,
      province: form.province,
      city: form.city,
      businessType: form.businessType,
      notes: form.notes || undefined,
    });
    if (ok) setDone(true);
  };

  if (done) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">درخواست ثبت شد</h2>
        <p className="text-gray-500 text-sm mb-6">
          اطلاعات شما دریافت شد. تیم ترنم در اسرع وقت حساب شما را بررسی و فعال می‌کند.
        </p>
        <button onClick={() => router.push('/portal/login')} className="btn btn-primary btn-md w-full">
          بازگشت به صفحه ورود
        </button>
      </div>
    );
  }

  const inp = (label: string, k: string, type = 'text', placeholder = '', required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <input
        type={type} value={(form as any)[k]} onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder} required={required}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );

  return (
    <div className="card p-8">
      {(error || localError) && (
        <Alert variant="error" className="mb-5">{localError || error}</Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          {inp('نام فروشگاه/مجموعه', 'businessName', 'text', 'بوتیک گل رز', true)}
          {inp('نام و نام خانوادگی', 'ownerName', 'text', 'محمد احمدی', true)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {inp('موبایل', 'phone', 'tel', '09120000000', true)}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع کسب‌وکار</label>
            <select value={form.businessType} onChange={(e) => set('businessType', e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="RETAIL">خرده‌فروش</option>
              <option value="BOUTIQUE">بوتیک</option>
              <option value="WHOLESALE">عمده‌فروش</option>
              <option value="ONLINE">فروشگاه آنلاین</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">استان <span className="text-error">*</span></label>
            <select value={form.province} onChange={(e) => set('province', e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">انتخاب استان...</option>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {inp('شهر', 'city', 'text', 'تهران', true)}
        </div>
        {inp('توضیحات (اختیاری)', 'notes', 'text', 'مثلاً: مجتمع تجاری پارسه، طبقه 2')}
        <div className="grid grid-cols-2 gap-4">
          {inp('رمز عبور', 'password', 'password', 'حداقل ۶ کاراکتر', true)}
          {inp('تکرار رمز عبور', 'confirmPassword', 'password', 'تکرار رمز عبور', true)}
        </div>
        <button type="submit" disabled={loading}
          className="btn btn-primary btn-lg w-full mt-2">
          {loading ? 'در حال ثبت...' : 'ارسال درخواست'}
        </button>
      </form>
    </div>
  );
}
