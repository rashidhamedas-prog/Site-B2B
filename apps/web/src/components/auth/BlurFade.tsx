'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, type Variants } from 'framer-motion';
import { cn } from '@/lib/cn';

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduce;
}

export function BlurFade({
  children,
  className,
  duration = 0.35,
  delay = 0,
  yOffset = 6,
  inView = true,
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inViewResult = useInView(ref, { once: true, margin: '-40px' });
  const isInView = !inView || inViewResult;
  const reduce = usePrefersReducedMotion();

  const variants: Variants = {
    hidden: reduce ? { opacity: 0 } : { y: yOffset, opacity: 0, filter: 'blur(6px)' },
    visible: reduce ? { opacity: 1 } : { y: 0, opacity: 1, filter: 'blur(0px)' },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ delay: reduce ? 0 : 0.04 + delay, duration: reduce ? 0.01 : duration, ease: 'easeOut' }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
