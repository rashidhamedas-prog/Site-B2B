'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { DEFAULT_AUTOPLAY_MS, type HeroSlide } from '@/lib/cms/hero-slides';

export function useHeroCarousel(
  slides: HeroSlide[],
  autoplayMs = DEFAULT_AUTOPLAY_MS,
  options?: { waitForIdle?: boolean },
) {
  const count = slides.length;
  const waitForIdle = Boolean(options?.waitForIdle);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [autoplayReady, setAutoplayReady] = useState(!waitForIdle);

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

  useEffect(() => {
    if (!waitForIdle) return;
    const arm = () => setAutoplayReady(true);
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(arm, { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(arm, 2500);
    return () => window.clearTimeout(t);
  }, [waitForIdle]);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (!autoplayReady || count < 2 || paused || manualPaused || reducedMotion || autoplayMs <= 0) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayReady, autoplayMs, count, manualPaused, paused, reducedMotion]);

  return {
    index,
    slide: slides[index] ?? slides[0],
    count,
    goTo,
    goNext,
    goPrev,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    isPaused: paused || manualPaused || reducedMotion,
    togglePaused: () => setManualPaused((value) => !value),
    showControls: count > 1,
  };
}

export function HeroCarouselControls({
  count,
  index,
  onGoTo,
  onPrev,
  onNext,
  paused = false,
  onTogglePaused,
  tone = 'gold',
}: {
  count: number;
  index: number;
  onGoTo: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  paused?: boolean;
  onTogglePaused?: () => void;
  tone?: 'gold' | 'secondary';
}) {
  if (count < 2) return null;

  const active = tone === 'gold' ? 'bg-[var(--retail-gold,#C9A84C)]' : 'bg-secondary';
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
      <div className="flex items-center gap-2" role="group" aria-label="انتخاب اسلاید هیرو">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-current={i === index ? 'true' : undefined}
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
      {onTogglePaused ? (
        <button
          type="button"
          aria-label={paused ? 'ادامه پخش خودکار اسلایدها' : 'توقف پخش خودکار اسلایدها'}
          aria-pressed={paused}
          onClick={onTogglePaused}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur-sm transition hover:bg-black/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  );
}
