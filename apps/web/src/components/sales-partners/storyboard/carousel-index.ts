/** Index rules for the mobile storyboard slider. Scroll position is not an input mid-animation. */

export interface CarouselNav {
  index: number;
  /** Target of a button, dot, or key move until that scroll settles. */
  pending: number | null;
}

export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.trunc(index)));
}

/** Next/prev. The step is added to the current index, never to a mid-scroll measurement. */
export function indexAfterStep(current: number, delta: number, count: number): CarouselNav {
  const index = clampIndex(current + delta, count);
  return { index, pending: index };
}

/** Dot jump. `target` is the dot index (0-based), independent of where the scroller is painted. */
export function indexAfterJump(target: number, count: number): CarouselNav {
  const index = clampIndex(target, count);
  return { index, pending: index };
}

/** Samples taken while a programmatic scroll is moving must not replace the index. */
export function indexDuringScroll(state: CarouselNav): CarouselNav {
  return state;
}

/**
 * When scrolling has ended, a pending move commits that index.
 * A user swipe or scroll-snap (no pending move) commits the measured slide.
 */
export function indexOnScrollEnd(state: CarouselNav, measured: number, count: number): CarouselNav {
  if (state.pending !== null) {
    return { index: clampIndex(state.pending, count), pending: null };
  }
  return { index: clampIndex(measured, count), pending: null };
}

/** Which slide is nearest the middle of the scroller, used only after scrolling settles. */
export function closestSlideIndex(centers: readonly number[], viewportCenter: number): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  centers.forEach((center, index) => {
    const dist = Math.abs(center - viewportCenter);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}
