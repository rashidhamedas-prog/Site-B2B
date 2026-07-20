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

/** Normalize Persian/Arabic digits to ASCII so phone validation accepts them. */
function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - '۰'.charCodeAt(0)))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - '٠'.charCodeAt(0)));
}

type FormFields = {
  businessName: string;
  ownerName: string;
  phone: string;
  password: string;
  confirmPassword: string;
  province: string;
  city: string;
  businessType: string;
  notes: string;
};

type FieldKey = keyof FormFields;

const emptyForm: FormFields = {
  businessName: '',
  ownerName: '',
  phone: '',
  password: '',
  confirmPassword: '',
  province: '',
  city: '',
  businessType: 'RETAIL',
  notes: '',
};

export function RegisterForm() {
  const { register, loading, error } = useAuth();
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState<FormFields>(emptyForm);
  const [localError, setLocalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const set = (k: FieldKey, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setFieldErrors((p) => {
      if (!p[k]) return p;
      const next = { ...p };
      delete next[k];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    const businessName = form.businessName.trim();
    const ownerName = form.ownerName.trim();
    const province = form.province.trim();
    const city = form.city.trim();
    const phone = toAsciiDigits(form.phone.trim());
    const password = form.password;
    const confirmPassword = form.confirmPassword;
    const errors: Partial<Record<FieldKey, string>> = {};

    if (!businessName) errors.businessName = 'نام فروشگاه الزامی است';
    if (!ownerName) errors.ownerName = 'نام و نام خانوادگی الزامی است';
    if (!province) errors.province = 'انتخاب استان الزامی است';
    if (!city) errors.city = 'نام شهر الزامی است';
    if (!phone) errors.phone = 'شماره موبایل الزامی است';
    else if (!/^09[0-9]{9}$/.test(phone)) errors.phone = 'شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷)';
    if (!password) errors.password = 'رمز عبور الزامی است';
    else if (password.length < 6) errors.password = 'رمز عبور حداقل ۶ کاراکتر';
    if (!confirmPassword) errors.confirmPassword = 'تکرار رمز عبور الزامی است';
    else if (password !== confirmPassword) errors.confirmPassword = 'رمز عبور با تکرار آن مطابقت ندارد';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setLocalError('لطفاً فیلدهای مشخص‌شده را اصلاح کنید');
      return;
    }

    const ok = await register({
      businessName,
      ownerName,
      phone,
      password,
      province,
      city,
      businessType: form.businessType,
      notes: form.notes.trim() || undefined,
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

  const fieldClass = (key: FieldKey) =>
    `w-full rounded-xl border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
      fieldErrors[key] ? 'border-error' : 'border-gray-200'
    }`;

  const inp = (
    label: string,
    k: FieldKey,
    type = 'text',
    placeholder = '',
    required = false,
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-error">*</span>}
      </label>
      <input
        type={type}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={k === 'password' || k === 'confirmPassword' ? 'new-password' : undefined}
        className={fieldClass(k)}
      />
      {fieldErrors[k] && <p className="mt-1 text-xs text-error">{fieldErrors[k]}</p>}
    </div>
  );

  return (
    <div className="card p-8">
      {(error || localError) && (
        <Alert variant="error" className="mb-5">{localError || error}</Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          {inp('نام فروشگاه/مجموعه', 'businessName', 'text', 'مثلاً بوتیک گل رز', true)}
          {inp('نام و نام خانوادگی', 'ownerName', 'text', 'مثلاً محمد احمدی', true)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {inp('موبایل', 'phone', 'tel', '۰۹۱۲۱۲۳۴۵۶۷', true)}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع کسب‌وکار</label>
            <select
              value={form.businessType}
              onChange={(e) => set('businessType', e.target.value)}
              className={fieldClass('businessType')}
            >
              <option value="RETAIL">خرده‌فروش</option>
              <option value="BOUTIQUE">بوتیک</option>
              <option value="WHOLESALE">عمده‌فروش</option>
              <option value="ONLINE">فروشگاه آنلاین</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              استان <span className="text-error">*</span>
            </label>
            <select
              value={form.province}
              onChange={(e) => set('province', e.target.value)}
              className={fieldClass('province')}
            >
              <option value="">انتخاب استان...</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {fieldErrors.province && (
              <p className="mt-1 text-xs text-error">{fieldErrors.province}</p>
            )}
          </div>
          {inp('شهر', 'city', 'text', 'نام شهر را وارد کنید', true)}
        </div>
        {inp('توضیحات (اختیاری)', 'notes', 'text', 'مثلاً: مجتمع تجاری پارسه، طبقه ۲')}
        <div className="grid grid-cols-2 gap-4">
          {inp('رمز عبور', 'password', 'password', 'حداقل ۶ کاراکتر', true)}
          {inp('تکرار رمز عبور', 'confirmPassword', 'password', 'تکرار رمز عبور', true)}
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full mt-2">
          {loading ? 'در حال ثبت...' : 'ارسال درخواست'}
        </button>
      </form>
    </div>
  );
}
