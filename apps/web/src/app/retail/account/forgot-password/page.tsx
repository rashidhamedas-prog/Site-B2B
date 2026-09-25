import { ForgotPasswordFlow } from '@/components/account/ForgotPasswordFlow';

export default function RetailForgotPasswordPage() {
  return <ForgotPasswordFlow variant="retail" loginHref="/account" successHref="/account" />;
}
