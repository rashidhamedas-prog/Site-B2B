'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle, Eye, EyeOff, Lock, Phone, Store } from 'lucide-react';
import { AuthShell, fireSideCanons, type ConfettiRef } from '@/components/auth/AuthShell';
import { BlurFade } from '@/components/auth/BlurFade';
import { GlassInput } from '@/components/auth/GlassInput';
import { GlassButton } from '@/components/ui/glass-button';
import { useAuth } from '@/lib/hooks/useAuth';
import { normalizePhone } from '@/lib/phone';
import { cn } from '@/lib/cn';

const PROVINCES = [
  'تهران',
  'اصفهان',
  'فارس',
  'خراسان رضوی',
  'آذربایجان شرقی',
  'آذربایجان غربی',
  'کرمان',
  'مازندران',
  'گیلان',
  'خوزستان',
  'سیستان و بلوچستان',
  'البرز',
  'قم',
  'قزوین',
  'کردستان',
  'کرمانشاه',
  'همدان',
  'اردبیل',
  'سمنان',
  'یزد',
  'زنجان',
  'گلستان',
  'لرستان',
  'چهارمحال و بختیاری',
  'کهگیلویه و بویراحمد',
  'خراسان شمالی',
  'خراسان جنوبی',
  'ایلام',
  'بوشهر',
  'مرکزی',
  'هرمزگان',
];

type Step = 0 | 1 | 2 | 3;

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

const empty: FormFields = {
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

const STEP_TITLES = [
  { title: 'مشخصات فروشگاه', sub: 'نام مجموعه و مسئول خرید' },
  { title: 'راه‌های تماس', sub: 'موبایل برای فعال‌سازی حساب' },
  { title: 'موقعیت', sub: 'استان و شهر فروشگاه' },
  { title: 'رمز عبور', sub: 'حداقل ۸ کاراکتر' },
] as const;

export function PortalRegisterAuth() {
  const { register, loading, error } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormFields>(empty);
  const [localError, setLocalError] = useState('');
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const confettiRef = useRef<ConfettiRef>(null);

  const set = (k: keyof FormFields, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const validateStep = (): boolean => {
    setLocalError('');
    if (step === 0) {
      if (!form.businessName.trim()) {
        setLocalError('نام فروشگاه الزامی است');
        return false;
      }
      if (!form.ownerName.trim()) {
        setLocalError('نام و نام خانوادگی الزامی است');
        return false;
      }
    }
    if (step === 1) {
      const phone = normalizePhone(form.phone);
      if (!/^09[0-9]{9}$/.test(phone)) {
        setLocalError('شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷)');
        return false;
      }
    }
    if (step === 2) {
      if (!form.province.trim()) {
        setLocalError('انتخاب استان الزامی است');
        return false;
      }
      if (!form.city.trim()) {
        setLocalError('نام شهر الزامی است');
        return false;
      }
    }
    if (step === 3) {
      if (form.password.length < 8) {
        setLocalError('رمز عبور حداقل ۸ کاراکتر باشد');
        return false;
      }
      if (form.password !== form.confirmPassword) {
        setLocalError('رمز عبور با تکرار آن مطابقت ندارد');
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < 3) setStep((s) => (s + 1) as Step);
  };

  const back = () => {
    setLocalError('');
    if (step > 0) setStep((s) => (s - 1) as Step);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== 3) {
      next();
      return;
    }
    if (!validateStep()) return;
    const ok = await register({
      businessName: form.businessName.trim(),
      ownerName: form.ownerName.trim(),
      phone: normalizePhone(form.phone),
      password: form.password,
      province: form.province.trim(),
      city: form.city.trim(),
      businessType: form.businessType,
      notes: form.notes.trim() || undefined,
    });
    if (ok) {
      setDone(true);
      fireSideCanons(confettiRef.current?.fire);
    }
  };

  if (done) {
    return (
      <AuthShell brandName="همکاری با ترنم" confettiRef={confettiRef}>
        <div className="w-full max-w-[320px] text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-8 w-8 text-emerald-600" aria-hidden />
          </div>
          <h2 className="text-xl font-bold text-[var(--brand-ink)]">درخواست ثبت شد</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--brand-muted)]">
            اطلاعات شما دریافت شد. تیم ترنم در اسرع وقت حساب شما را بررسی و فعال می‌کند.
          </p>
          <div className="mt-6">
            <GlassButton type="button" size="full" onClick={() => router.push('/portal/login')}>
              بازگشت به صفحه ورود
            </GlassButton>
          </div>
        </div>
      </AuthShell>
    );
  }

  const title = STEP_TITLES[step];

  return (
    <AuthShell
      brandName="همکاری با ترنم"
      confettiRef={confettiRef}
      footer={
        <p className="text-center text-sm text-[var(--brand-muted)]">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <a
            href="/portal/login"
            className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            ورود به پنل
          </a>
        </p>
      }
    >
      <div className="w-full text-center">
        <BlurFade>
          <p className="text-3xl font-extrabold tracking-tight text-[var(--brand-ink)] sm:text-4xl">
            {title.title}
          </p>
        </BlurFade>
        <BlurFade delay={0.1}>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">{title.sub}</p>
        </BlurFade>
        <div className="mt-4 flex justify-center gap-1.5" aria-label={`گام ${step + 1} از ۴`}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 w-8 rounded-full transition-colors',
                i <= step ? 'bg-[var(--color-primary)]' : 'bg-[var(--brand-border)]',
              )}
            />
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="w-full max-w-[320px] space-y-4" noValidate>
        {(localError || error) && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-[var(--brand-error,#DC2626)]">
            {localError || error}
          </p>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {step === 0 && (
              <>
                <GlassInput icon={<Store className="h-5 w-5" aria-hidden />}>
                  <input
                    value={form.businessName}
                    onChange={(e) => set('businessName', e.target.value)}
                    placeholder="نام فروشگاه / مجموعه"
                    autoComplete="organization"
                    aria-label="نام فروشگاه"
                  />
                </GlassInput>
                <GlassInput>
                  <input
                    value={form.ownerName}
                    onChange={(e) => set('ownerName', e.target.value)}
                    placeholder="نام و نام خانوادگی"
                    autoComplete="name"
                    aria-label="نام و نام خانوادگی"
                  />
                </GlassInput>
              </>
            )}

            {step === 1 && (
              <>
                <GlassInput icon={<Phone className="h-5 w-5" aria-hidden />}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="09xxxxxxxxx"
                    autoComplete="tel"
                    dir="ltr"
                    aria-label="موبایل"
                    className="text-left"
                  />
                </GlassInput>
                <GlassInput>
                  <select
                    className="auth-glass-select"
                    value={form.businessType}
                    onChange={(e) => set('businessType', e.target.value)}
                    aria-label="نوع کسب‌وکار"
                  >
                    <option value="RETAIL">خرده‌فروش</option>
                    <option value="BOUTIQUE">بوتیک</option>
                    <option value="WHOLESALE">عمده‌فروش</option>
                    <option value="ONLINE">فروشگاه آنلاین</option>
                  </select>
                </GlassInput>
              </>
            )}

            {step === 2 && (
              <>
                <GlassInput>
                  <select
                    className="auth-glass-select"
                    value={form.province}
                    onChange={(e) => set('province', e.target.value)}
                    aria-label="استان"
                  >
                    <option value="">انتخاب استان…</option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </GlassInput>
                <GlassInput>
                  <input
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    placeholder="شهر"
                    aria-label="شهر"
                  />
                </GlassInput>
                <GlassInput>
                  <input
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    placeholder="توضیحات (اختیاری)"
                    aria-label="توضیحات"
                  />
                </GlassInput>
              </>
            )}

            {step === 3 && (
              <>
                <GlassInput
                  icon={
                    <button
                      type="button"
                      aria-label={showPassword ? 'پنهان کردن رمز' : 'نمایش رمز'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="rounded-full p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  }
                >
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder="رمز عبور"
                    autoComplete="new-password"
                    aria-label="رمز عبور"
                  />
                </GlassInput>
                <GlassInput icon={<Lock className="h-5 w-5" aria-hidden />}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword', e.target.value)}
                    placeholder="تکرار رمز عبور"
                    autoComplete="new-password"
                    aria-label="تکرار رمز عبور"
                  />
                </GlassInput>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-3 pt-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--brand-muted)] hover:text-[var(--brand-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            >
              <ArrowRight className="h-4 w-4" />
              بازگشت
            </button>
          ) : (
            <span className="flex-1" />
          )}
          <div className="flex-1">
            <GlassButton type="submit" size="full" disabled={loading}>
              {step < 3 ? (
                <span className="inline-flex items-center gap-2">
                  ادامه
                  <ArrowLeft className="h-4 w-4" />
                </span>
              ) : loading ? (
                'در حال ثبت…'
              ) : (
                'ارسال درخواست'
              )}
            </GlassButton>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
