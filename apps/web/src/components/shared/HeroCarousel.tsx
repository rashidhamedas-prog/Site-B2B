'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DEFAULT_AUTOPLAY_MS, type HeroSlide } from '@/lib/cms/hero-slides';

export function useHeroCarousel(slides: HeroSlide[], autoplayMs = DEFAULT_AUTOPLAY_MS) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    setIndex((i) => (count === 0 ? 0 : Math.min(i, count - 1)));
  }, [count]);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion || autoplayMs <= 0) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayMs, count, paused, reducedMotion]);

  return {
    index,
    slide: slides[index] ?? slides[0],
    count,
    goTo,
    goNext,
    goPrev,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    showControls: count > 1,
  };
}

export function HeroCarouselControls({
  count,
  index,
  onGoTo,
  onPrev,
  onNext,
  tone = 'gold',
}: {
  count: number;
  index: number;
  onGoTo: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  tone?: 'gold' | 'secondary';
}) {
  if (count < 2) return null;

  const active =
    tone === 'gold' ? 'bg-[var(--retail-gold,#C9A84C)]' : 'bg-secondary';
  const idle = 'bg-white/35 hover:bg-white/55';

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-5 z-20 flex items-center justify-center gap-3 sm:bottom-7">
      <button
        type="button"
        aria-label="اسلاید قبلی"
        onClick={onPrev}
        className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-sm transition hover:bg-black/35 md:inline-flex"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2" role="tablist" aria-label="اسلایدهای هیرو">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`اسلاید ${i + 1}`}
            onClick={() => onGoTo(i)}
            className={`h-2 cursor-pointer rounded-full transition-all ${
              i === index ? `w-7 ${active}` : `w-2 ${idle}`
            }`}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label="اسلاید بعدی"
        onClick={onNext}
        className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-sm transition hover:bg-black/35 md:inline-flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}
