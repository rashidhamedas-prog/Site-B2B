'use client';

import { useEffect, useState } from 'react';

/** Keep a panel mounted through its exit. Duration matches --motion-duration-slow. */
export function usePresence(open: boolean, duration = 280) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (open) {
      setMounted(true);
      if (reduce) {
        setShown(true);
        return;
      }
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    if (reduce) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), duration);
    return () => window.clearTimeout(timer);
  }, [open, duration]);

  return { mounted, shown };
}
