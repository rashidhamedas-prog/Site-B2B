import { ForgotPasswordFlow } from '@/components/account/ForgotPasswordFlow';

export default function RetailForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-extrabold">بازیابی رمز عبور</h1>
      <p className="mt-2 text-sm text-[var(--retail-muted)]">
        کد پیامکی می‌فرستیم تا رمز تازه بگذارید. اگر حسابی با این شماره نباشد، باز هم همین پیام را می‌بینید.
      </p>
      <div className="mt-8">
        <ForgotPasswordFlow variant="retail" loginHref="/account" successHref="/account" />
      </div>
    </div>
  );
}
