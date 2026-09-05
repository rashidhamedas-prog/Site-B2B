'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AboutScene } from './AboutScene';
import { ABOUT_STAGES, AboutStory } from './AboutStory';
import styles from './about.module.css';

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function rangeProgress(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / (end - start));
}

function stageFromProgress(progress: number): number {
  if (progress < 0.28) return 0;
  if (progress < 0.5) return 1;
  if (progress < 0.74) return 2;
  return 3;
}

export function AboutExperience() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 1024px)');
    const syncMode = () => {
      setEnhanced(!motion.matches && desktop.matches);
    };
    syncMode();
    motion.addEventListener('change', syncMode);
    desktop.addEventListener('change', syncMode);

    let raf = 0;
    let visible = true;

    const measure = () => {
      raf = 0;
      const el = trackRef.current;
      if (!el) return;
      if (motion.matches) {
        setProgress(0.86);
        return;
      }
      if (!desktop.matches) {
        setProgress(0.72);
        return;
      }
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const p = total > 0 ? clamp01(-rect.top / total) : 0;
      setProgress(p);
    };

    const schedule = () => {
      if (!visible && desktop.matches) return;
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    const node = trackRef.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) schedule();
      },
      { rootMargin: '160px 0px' },
    );
    if (node) io.observe(node);

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      motion.removeEventListener('change', syncMode);
      desktop.removeEventListener('change', syncMode);
      io.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const activeStage = enhanced ? stageFromProgress(progress) : 0;
  const sceneVars = enhanced
    ? ({
        '--p': String(progress),
        '--unroll': String(rangeProgress(progress, 0.02, 0.26)),
        '--cut': String(rangeProgress(progress, 0.22, 0.48)),
        '--sew': String(rangeProgress(progress, 0.46, 0.72)),
        '--ready': String(rangeProgress(progress, 0.7, 0.94)),
      } as CSSProperties)
    : undefined;

  return (
    <div
      ref={trackRef}
      className={`${styles.track} ${enhanced ? styles.enhanced : ''}`}
      style={sceneVars}
    >
      <div className={styles.sticky}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>پوشاک ترنم مشهد · تولیدی</p>
          <h1 className={styles.heroTitle}>پوشاک ترنم مشهد؛ از کارگاه تا سفارش بوتیک</h1>
          <p className={styles.lede}>
            انتخاب پارچه، برش و دوخت در کارگاه مشهد انجام می‌شود و سفارش از دفتر پخش پاساژ کیمیا به
            بوتیک می‌رسد. اگر می‌خواهید همکاری با تولیدی لباس را شروع کنید، حداقل سفارش هر مدل از ۶
            عدد است.
          </p>
          <p className={styles.scrollHint}>با اسکرول، پارچه خام به محصول ویترین تبدیل می‌شود</p>
          <AboutStory
            activeStage={Math.min(ABOUT_STAGES.length - 1, activeStage)}
            hideInactive={enhanced}
          />
        </div>
        <AboutScene />
      </div>
    </div>
  );
}
