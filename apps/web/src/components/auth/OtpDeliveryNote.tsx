'use client';

import { formatOtpValidity } from '@/lib/sms-cooldown';
import { cn } from '@/lib/cn';

type Props = {
  secondsLeft: number;
  pending?: boolean;
  className?: string;
};

/** Code lifetime. The resend countdown is a separate, shorter clock. */
export function OtpDeliveryNote({ secondsLeft, pending = false, className }: Props) {
  if (secondsLeft <= 0) {
    return (
      <p className={cn('text-center text-sm leading-6 text-stone-600', className)} role="status">
        اعتبار این کد تمام شده. ارسال دوباره را بزنید.
      </p>
    );
  }
  const label = formatOtpValidity(secondsLeft);
  return (
    <p className={cn('text-center text-sm leading-6 text-stone-600', className)} role="status">
      {pending
        ? `سرویس پیامک دیر جواب داد. اگر کد رسید، تا ${label} دیگر معتبر است.`
        : `کد تا ${label} دیگر معتبر است. صفر شدن «ارسال دوباره» فقط فاصلهٔ دو پیامک است.`}
    </p>
  );
}
