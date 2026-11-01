'use client';

import { useEffect, useRef } from 'react';

const MOTION_QUERY = '(min-width:1024px) and (prefers-reduced-motion: no-preference)';

/** S2 crossfade. GSAP is only fetched on wide screens with motion allowed; no React state. */
export function AboutProcessMotion() {
  const markerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = markerRef.current?.closest<HTMLElement>('[data-about-process]');
    if (!section || !window.matchMedia(MOTION_QUERY).matches) return;

    let cancelled = false;
    let revert: (() => void) | undefined;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERY, () => {
        const steps = gsap.utils.toArray<HTMLElement>('[data-about-step]', section);
        for (const step of steps) {
          const img = step.querySelector('[data-about-step-img]');
          if (!img) continue;
          gsap.fromTo(
            img,
            { opacity: 0.35, scale: 1.03 },
            {
              opacity: 1,
              scale: 1,
              ease: 'none',
              scrollTrigger: { trigger: step, start: 'top 85%', end: 'top 45%', scrub: true },
            },
          );
          gsap.to(img, {
            opacity: 0.35,
            ease: 'none',
            immediateRender: false,
            scrollTrigger: { trigger: step, start: 'bottom 45%', end: 'bottom 10%', scrub: true },
          });
        }
        document.documentElement.dataset.aboutMotion = 'gsap';
        return () => {
          delete document.documentElement.dataset.aboutMotion;
        };
      });
      revert = () => mm.revert();
    })();

    return () => {
      cancelled = true;
      revert?.();
    };
  }, []);

  return <span ref={markerRef} hidden />;
}
