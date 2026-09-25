import type { Metadata } from 'next';
import { ForgotPasswordFlow } from '@/components/account/ForgotPasswordFlow';

export const metadata: Metadata = { title: 'بازیابی رمز عبور | ترنم' };

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordFlow
      variant="wholesale"
      loginHref="/portal/login"
      successHref="/portal/dashboard"
    />
  );
}
