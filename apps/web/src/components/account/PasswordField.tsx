'use client';

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required ? <span className="mr-1 text-red-600">*</span> : null}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          dir="ltr"
          className={`w-full rounded-xl border bg-white px-4 py-3 pl-11 text-sm ${
            error ? 'border-red-400' : 'border-gray-200'
          }`}
        />
        <button
          type="button"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'پنهان کردن رمز' : 'نمایش رمز'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && !error ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
