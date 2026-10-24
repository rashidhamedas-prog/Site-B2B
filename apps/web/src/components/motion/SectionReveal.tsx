'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const HERO = '.storefront-hero-frame, .retail-editorial-hero, .wholesale-editorial-hero';

/**
 * Fade sections in once, only after they are confirmed below the fold.
 * Hero, in-view content, and fetchpriority=high images are never armed,
 * so the LCP element is not hidden or delayed.
 */
export function SectionReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.dataset.tnMotion = reduce ? 'off' : 'on';
    if (reduce) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('tn-revealed');
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );

    const sections = document.querySelectorAll<HTMLElement>('main > section');
    for (const el of sections) {
      if (el.matches(HERO) || el.querySelector(HERO)) continue;
      if (el.querySelector('img[fetchpriority="high"]')) continue;
      const rect = el.getBoundingClientRect();
      const alreadyVisible = rect.top < window.innerHeight * 0.88 && rect.bottom > 0;
      if (alreadyVisible) continue;
      el.classList.add('tn-reveal-arm');
      io.observe(el);
    }

    return () => io.disconnect();
  }, [pathname]);

  return null;
}
