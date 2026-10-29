'use client';

import { cn } from '@/lib/cn';

type GlassInputProps = {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  label?: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
};

export function GlassInput({ icon, trailing, className, label, htmlFor, error, children }: GlassInputProps) {
  return (
    <div className={cn('auth-field-group', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="auth-label">
          {label}
        </label>
      ) : null}
      <div className="auth-field-wrap">
        <div className={cn('auth-field', error ? 'auth-field--error' : undefined)}>
          {icon ? <div className="auth-field-icon">{icon}</div> : null}
          {children}
          {trailing ? <div className="auth-field-trailing">{trailing}</div> : null}
        </div>
      </div>
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="auth-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
