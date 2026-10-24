'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { toPersianDigits } from '@taranom/persian-utils';
import { trackSalesPartnerStory } from '@/lib/retail-analytics';
import styles from './storyboard.module.css';

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The flex line is as tall as the longest slide. Clip it to the active slide on mobile. */
function fitActiveSlide(region: HTMLElement | null, scroller: HTMLElement | null, index: number) {
  const list = region?.querySelector('ol');
  if (!scroller || !list) return;
  if (window.innerWidth >= 768) {
    scroller.style.height = '';
    return;
  }
  const item = list.children[index] as HTMLElement | undefined;
  if (!item) return;
  const style = getComputedStyle(list);
  const pad = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const border = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
  scroller.style.height = `${Math.ceil(item.offsetHeight + pad + border)}px`;
}

/** Mobile scroll-snap enhancer. The list itself swipes without this script. */
export function StoryCarousel({ count, children }: { count: number; children: ReactNode }) {
  const regionRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const list = regionRef.current?.querySelector('ol');
    if (!list) return;
    if (isMobile) list.tabIndex = 0;
    else list.removeAttribute('tabindex');
  }, [isMobile, count]);

  useLayoutEffect(() => {
    const fit = () => fitActiveSlide(regionRef.current, scrollerRef.current, indexRef.current);
    fit();
    const list = regionRef.current?.querySelector('ol');
    if (!list) return;
    const observer = new ResizeObserver(fit);
    observer.observe(list);
    for (const child of list.children) observer.observe(child);
    window.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [count, index, isMobile]);

  useEffect(() => {
    const region = regionRef.current;
    const list = region?.querySelector('ol');
    if (!region || !list) return;
    const items = [...list.children] as HTMLElement[];
    const seen = new Set<number>();

    const remember = (next: number) => {
      indexRef.current = next;
      setIndex(next);
      if (!seen.has(next)) {
        seen.add(next);
        trackSalesPartnerStory('sp_story_step_view', next + 1);
      }
    };

    const closest = () => {
      const box = list.getBoundingClientRect();
      const mid = box.left + box.width / 2;
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      items.forEach((item, itemIndex) => {
        const rect = item.getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width / 2 - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = itemIndex;
        }
      });
      remember(best);
    };

    const onScroll = () => {
      if (window.innerWidth >= 768) return;
      closest();
      fitActiveSlide(region, scrollerRef.current, indexRef.current);
    };
    list.addEventListener('scroll', onScroll, { passive: true });

    const view = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const itemIndex = items.indexOf(entry.target as HTMLElement);
          if (itemIndex >= 0 && !seen.has(itemIndex)) {
            seen.add(itemIndex);
            trackSalesPartnerStory('sp_story_step_view', itemIndex + 1);
          }
        }
      },
      { threshold: 0.5 },
    );
    items.forEach((item) => view.observe(item));

    if (!reducedMotion()) {
      const reveal = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add(styles.revealed);
            reveal.unobserve(entry.target);
          }
        },
        { threshold: 0.2 },
      );
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const onScreen = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
        if (onScreen) item.classList.add(styles.revealed);
        else {
          item.classList.add(styles.reveal);
          reveal.observe(item);
        }
      });
      return () => {
        list.removeEventListener('scroll', onScroll);
        view.disconnect();
        reveal.disconnect();
      };
    }

    return () => {
      list.removeEventListener('scroll', onScroll);
      view.disconnect();
    };
  }, [count]);

  const goBy = (delta: number) => {
    const list = regionRef.current?.querySelector('ol');
    if (!list) return;
    const items = [...list.children] as HTMLElement[];
    const next = Math.min(items.length - 1, Math.max(0, indexRef.current + delta));
    indexRef.current = next;
    setIndex(next);
    fitActiveSlide(regionRef.current, scrollerRef.current, next);
    items[next]?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });
  };

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isMobile) return;
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (!region.contains(document.activeElement)) return;
      event.preventDefault();
      goBy(event.key === 'ArrowLeft' ? 1 : -1);
    };
    region.addEventListener('keydown', onKey);
    return () => region.removeEventListener('keydown', onKey);
  }, [isMobile]);

  return (
    <div
      ref={regionRef}
      className={styles.region}
      {...(isMobile
        ? { role: 'region' as const, 'aria-roledescription': 'کاروسل', 'aria-label': 'مراحل همکاری' }
        : {})}
    >
      {isMobile ? (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.navBtn}
            aria-label="مرحلهٔ قبل"
            disabled={index <= 0}
            onClick={() => goBy(-1)}
          >
            قبل
          </button>
          <button
            type="button"
            className={styles.navBtn}
            aria-label="مرحلهٔ بعد"
            disabled={index >= count - 1}
            onClick={() => goBy(1)}
          >
            بعد
          </button>
        </div>
      ) : null}
      <div ref={scrollerRef} className={styles.scroller}>
        {children}
      </div>
      {isMobile ? (
        <div className={styles.dots}>
          {Array.from({ length: count }, (_, dot) => (
            <button
              key={dot}
              type="button"
              className={styles.dot}
              aria-label={`رفتن به مرحلهٔ ${toPersianDigits(dot + 1)}`}
              aria-current={dot === index ? 'step' : undefined}
              onClick={() => goBy(dot - indexRef.current)}
            >
              <span className={styles.dotMark} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Records a click on either signup link. No partner id or other personal data. */
export function SpStoryCtaBeacon() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('a[href="#apply"]')) return;
      trackSalesPartnerStory('sp_story_cta_click');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
