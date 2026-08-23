'use client';

import { useEffect } from 'react';
import { ga4EnvFor, ensureGtagStub, type GoogleChannel } from '@/lib/google';

type MetricName = 'LCP' | 'CLS' | 'INP' | 'FID';

/** Set by GoogleAnalytics once the channel measurement ID is resolved (env or admin). */
let resolvedGa4Id = '';

export function setGa4RumiMeasurementId(id: string) {
  resolvedGa4Id = id || '';
}

function activeMeasurementId(channel: GoogleChannel): string {
  return resolvedGa4Id || ga4EnvFor(channel);
}

function roundForGa4(name: MetricName, value: number): number {
  // GA4 event values must be integers; CLS is scaled ×1000 (common CWV→GA4 pattern).
  return name === 'CLS' ? Math.round(value * 1000) : Math.round(value);
}

function reportMetric(name: MetricName, value: number, measurementId: string) {
  if (typeof window === 'undefined') return;
  if (!Number.isFinite(value) || value < 0) return;
  ensureGtagStub();
  if (typeof window.gtag !== 'function') return;

  const payload: Record<string, unknown> = {
    event_category: 'Web Vitals',
    value: roundForGa4(name, value),
    metric_value: value,
    non_interaction: true,
  };
  if (measurementId) payload.send_to = measurementId;

  window.gtag('event', name, payload);
}

function onHiddenOnce(cb: () => void): () => void {
  let sent = false;
  const fire = () => {
    if (sent) return;
    sent = true;
    cb();
  };
  const onVis = () => {
    if (document.visibilityState === 'hidden') fire();
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', fire);
  return () => {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', fire);
  };
}

function observeWebVitals(channel: GoogleChannel): () => void {
  const cleanups: Array<() => void> = [];
  const idOf = () => activeMeasurementId(channel);

  // LCP — final value on page hide (buffered catches early paints even after idle start).
  try {
    let lcp = 0;
    const po = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) lcp = last.startTime;
    });
    po.observe({ type: 'largest-contentful-paint', buffered: true });
    cleanups.push(() => po.disconnect());
    cleanups.push(
      onHiddenOnce(() => {
        if (lcp > 0) reportMetric('LCP', lcp, idOf());
      }),
    );
  } catch {
    /* unsupported */
  }

  // CLS — accumulate session window; report on hide.
  try {
    let cls = 0;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (!shift.hadRecentInput) cls += shift.value ?? 0;
      }
    });
    po.observe({ type: 'layout-shift', buffered: true });
    cleanups.push(() => po.disconnect());
    cleanups.push(
      onHiddenOnce(() => {
        reportMetric('CLS', cls, idOf());
      }),
    );
  } catch {
    /* unsupported */
  }

  // INP (event timing) with FID fallback.
  let usedInp = false;
  try {
    let inp = 0;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const ev = entry as PerformanceEventTiming;
        if (typeof ev.duration === 'number' && ev.duration > inp) inp = ev.duration;
      }
    });
    po.observe({
      type: 'event',
      buffered: true,
      // durationThreshold is valid for PerformanceObserverInit + event timing
      durationThreshold: 40,
    } as PerformanceObserverInit);
    usedInp = true;
    cleanups.push(() => po.disconnect());
    cleanups.push(
      onHiddenOnce(() => {
        if (inp > 0) reportMetric('INP', inp, idOf());
      }),
    );
  } catch {
    usedInp = false;
  }

  if (!usedInp) {
    try {
      const po = new PerformanceObserver((list) => {
        const first = list.getEntries()[0] as PerformanceEventTiming | undefined;
        if (!first || typeof first.processingStart !== 'number') return;
        reportMetric('FID', first.processingStart - first.startTime, idOf());
      });
      po.observe({ type: 'first-input', buffered: true });
      cleanups.push(() => po.disconnect());
    } catch {
      /* unsupported */
    }
  }

  return () => {
    for (const c of cleanups) c();
  };
}

function runWhenIdle(fn: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(fn, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, 2800);
  return () => window.clearTimeout(t);
}

const startedChannels = new Set<GoogleChannel>();

/**
 * Lightweight Core Web Vitals → GA4 RUM via native PerformanceObserver (no web-vitals dep).
 * Starts after idle / timeout — never on the landing critical path.
 * Mount once per channel next to GoogleAnalytics (via GoogleAnalyticsProvider).
 */
export function WebVitalsReporter({ channel }: { channel: GoogleChannel }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (startedChannels.has(channel)) return;
    startedChannels.add(channel);

    let stopObservers: (() => void) | undefined;
    const cancelIdle = runWhenIdle(() => {
      stopObservers = observeWebVitals(channel);
    });

    return () => {
      cancelIdle();
      stopObservers?.();
      startedChannels.delete(channel);
    };
  }, [channel]);

  return null;
}
