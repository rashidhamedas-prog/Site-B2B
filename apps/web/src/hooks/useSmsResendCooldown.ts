'use client';

import { useCallback, useEffect, useState } from 'react';

/** Server-driven SMS/OTP resend countdown (UI only — enforcement is on API). */
export function useSmsResendCooldown(initialSeconds = 0) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil(initialSeconds)));

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = window.setTimeout(() => setSecondsLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [secondsLeft]);

  const start = useCallback((seconds: number) => {
    setSecondsLeft(Math.max(0, Math.ceil(seconds)));
  }, []);

  const reset = useCallback(() => setSecondsLeft(0), []);

  return {
    secondsLeft,
    canResend: secondsLeft <= 0,
    start,
    reset,
  };
}
