'use client';

import { useEffect, useRef, useState } from 'react';
import { toPersianDigits } from '@taranom/persian-utils';
import { AboutScene } from './AboutScene';
import { ABOUT_STAGES, AboutStory } from './AboutStory';
import styles from './about.module.css';

export function AboutExperience() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const [activeStage, setActiveStage] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let io: IntersectionObserver | null = null;

    const teardownIo = () => {
      io?.disconnect();
      io = null;
    };

    const setupIo = () => {
      teardownIo();
      const root = scrollerRef.current;
      const nodes = root
        ? Array.from(root.querySelectorAll<HTMLElement>('[data-step]'))
        : (stepRefs.current.filter(Boolean) as HTMLElement[]);
      if (!nodes.length) return;

      const ratios = new Map<number, number>();
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const idx = Number((entry.target as HTMLElement).dataset.step);
            if (Number.isNaN(idx)) continue;
            ratios.set(idx, entry.isIntersecting ? entry.intersectionRatio : 0);
          }
          let best = 0;
          let bestRatio = -1;
          for (const [idx, ratio] of ratios) {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              best = idx;
            }
          }
          if (bestRatio > 0) setActiveStage(best);
        },
        {
          root: null,
          rootMargin: '-28% 0px -42% 0px',
          threshold: [0, 0.25, 0.5, 0.75, 1],
        },
      );
      for (const node of nodes) io.observe(node);
    };

    const applyMotion = () => {
      const reduce = motion.matches;
      setReducedMotion(reduce);
      if (reduce) {
        teardownIo();
        setActiveStage(ABOUT_STAGES.length - 1);
        return;
      }
      setupIo();
    };

    applyMotion();
    motion.addEventListener('change', applyMotion);

    return () => {
      motion.removeEventListener('change', applyMotion);
      teardownIo();
    };
  }, []);

  return (
    <section className={styles.story} aria-labelledby="about-story-title">
      <header className={styles.intro}>
        <p className={styles.eyebrow}>پوشاک ترنم مشهد · تولیدی</p>
        <h1 id="about-story-title" className={styles.heroTitle}>
          پوشاک ترنم مشهد؛ از کارگاه تا سفارش بوتیک
        </h1>
        <p className={styles.lede}>
          انتخاب پارچه، برش و دوخت در کارگاه مشهد انجام می‌شود و سفارش از دفتر پخش پاساژ کیمیا به
          بوتیک می‌رسد. اگر می‌خواهید همکاری با تولیدی لباس را شروع کنید، حداقل سفارش هر مدل از ۶
          عدد است.
        </p>
        {!reducedMotion ? (
          <p className={styles.scrollHint}>اسکرول کنید؛ هر مرحله کارگاه روشن می‌شود</p>
        ) : null}
      </header>

      <div ref={scrollerRef} className={styles.scroller} data-reduced={reducedMotion}>
        <div className={styles.stickyGraphic}>
          <AboutScene activeStage={activeStage} />
          <ol className={styles.progress} aria-label="مراحل تولید">
            {ABOUT_STAGES.map((stage, index) => (
              <li key={stage.title} data-on={index === activeStage} data-done={index < activeStage}>
                <span className={styles.progressIndex}>{toPersianDigits(index + 1)}</span>
                <span className={styles.progressLabel}>{stage.title}</span>
              </li>
            ))}
          </ol>
        </div>

        <AboutStory activeStage={activeStage} stepRefs={stepRefs} />
      </div>
    </section>
  );
}
