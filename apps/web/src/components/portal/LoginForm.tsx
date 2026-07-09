'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Phone } from 'lucide-react';
import { Button, Input, Alert } from '@/components/ui';
import { useAuth } from '@/lib/hooks/useAuth';

const schema = z.object({
  phone: z.string().regex(/^09[0-9]{9}$/, 'فرمت شماره موبایل صحیح نیست'),
  password: z.string().min(6, 'رمز عبور حداقل ۶ کاراکتر'),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading, error } = useAuth();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = (data: FormData) => login(data);

  return (
    <div className="card p-8">
      {error && (
        <Alert variant="error" className="mb-5" dismissible>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Input
          label="شماره موبایل"
          type="tel"
          placeholder="09xxxxxxxxx"
          required
          error={errors.phone?.message}
          rightIcon={<Phone className="h-4 w-4" />}
          {...register('phone')}
        />

        <div className="relative">
          <Input
            label="رمز عبور"
            type={showPassword ? 'text' : 'password'}
            placeholder="رمز عبور خود را وارد کنید"
            required
            error={errors.password?.message}
            rightIcon={<Lock className="h-4 w-4" />}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3 top-[38px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded border-gray-300" />
            <span className="text-gray-600">مرا به خاطر بسپار</span>
          </label>
          <a href="/portal/forgot-password" className="text-primary hover:underline">فراموشی رمز</a>
        </div>

        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          ورود به پنل
        </Button>
      </form>
    </div>
  );
}
