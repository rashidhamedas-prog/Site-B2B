'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type {
  GlobalOptions as ConfettiGlobalOptions,
  CreateTypes as ConfettiInstance,
  Options as ConfettiOptions,
} from 'canvas-confetti';
import confetti from 'canvas-confetti';

export type ConfettiRef = { fire: (options?: ConfettiOptions) => void } | null;

export const Confetti = forwardRef<
  ConfettiRef,
  React.ComponentPropsWithRef<'canvas'> & {
    options?: ConfettiOptions;
    globalOptions?: ConfettiGlobalOptions;
    manualstart?: boolean;
  }
>((props, ref) => {
  const { options, globalOptions = { resize: true, useWorker: true }, manualstart = true, ...rest } =
    props;
  const instanceRef = useRef<ConfettiInstance | null>(null);

  const canvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node !== null) {
        if (instanceRef.current) return;
        instanceRef.current = confetti.create(node, { ...globalOptions, resize: true });
      } else if (instanceRef.current) {
        instanceRef.current.reset();
        instanceRef.current = null;
      }
    },
    [globalOptions],
  );

  const fire = useCallback(
    (opts: ConfettiOptions = {}) => {
      if (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }
      instanceRef.current?.({ ...options, ...opts });
    },
    [options],
  );

  const api = useMemo(() => ({ fire }), [fire]);
  useImperativeHandle(ref, () => api, [api]);

  useEffect(() => {
    if (!manualstart) fire();
  }, [manualstart, fire]);

  return <canvas ref={canvasRef} {...rest} />;
});
Confetti.displayName = 'Confetti';

export function fireSideCanons(fire?: (options?: ConfettiOptions) => void) {
  if (!fire) return;
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }
  const defaults = { startVelocity: 28, spread: 360, ticks: 50, zIndex: 100, colors: ['#1B5C4A', '#C9A84C', '#F6F1E8'] };
  const particleCount = 40;
  fire({ ...defaults, particleCount, origin: { x: 0.1, y: 0.95 }, angle: 60 });
  fire({ ...defaults, particleCount, origin: { x: 0.9, y: 0.95 }, angle: 120 });
}
