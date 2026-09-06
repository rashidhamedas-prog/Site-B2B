'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { HeroCarouselControls, useHeroCarousel } from '@/components/shared/HeroCarousel';
import {
  DIGIPAY_RETAIL_HERO_SLIDE,
  normalizeHeroSlides,
  resolveAutoplayMs,
  type HeroFlatProps,
  type HeroSlide,
} from '@/lib/cms/hero-slides';

function Banner({
  slide,
  priority,
  compact,
}: {
  slide: HeroSlide;
  priority: boolean;
  compact?: boolean;
}) {
  const src = slide.imageUrl || '/retail/hero-model.webp';
  const alt = slide.imageAlt || slide.headline;
  return (
    <div className={`relative overflow-hidden rounded-2xl ${compact ? 'aspect-square min-h-[16rem]' : 'aspect-[16/9] min-h-[16rem] sm:min-h-[20rem] lg:aspect-[2/1] lg:min-h-[22rem]'}`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        fetchPriority={priority ? 'high' : 'auto'}
        loading={priority ? 'eager' : 'lazy'}
        sizes={compact ? '(max-width:1024px) 100vw, 32vw' : '(max-width:1024px) 100vw, 66vw'}
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
        {slide.brandEyebrow ? (
          <p className="text-[11px] font-bold text-[#c9a84c]">{slide.brandEyebrow}</p>
        ) : null}
        <p className={`${compact ? 'text-lg' : 'text-xl sm:text-3xl'} font-extrabold leading-snug text-white`}>
          {slide.headline}
        </p>
        {slide.body && !compact ? (
          <p className="mt-2 max-w-md text-sm leading-7 text-white/85">{slide.body}</p>
        ) : null}
        {slide.ctaLabel && slide.ctaHref ? (
          <Link
            href={slide.ctaHref}
            className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-lg bg-white px-4 text-sm font-bold text-neutral-900"
          >
            {slide.ctaLabel}
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function BoutiqueHero(props: HeroFlatProps) {
  const slides = normalizeHeroSlides(props, DIGIPAY_RETAIL_HERO_SLIDE);
  const autoplayMs = resolveAutoplayMs(props.autoplayMs);
  const carousel = useHeroCarousel(slides, autoplayMs, { waitForIdle: true });
  const primary = carousel.slide ?? slides[0]!;
  const secondary = slides[1];

  return (
    <section className="bq-container py-4 sm:py-6" aria-label="پیشنهادهای فروشگاه">
      <h1 className="sr-only">خرید تکی پوشاک زنانه ترنم</h1>
      <div className={secondary ? 'grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]' : ''}>
        <div
          className="relative"
          onMouseEnter={carousel.pause}
          onMouseLeave={carousel.resume}
          onFocusCapture={carousel.pause}
          onBlurCapture={carousel.resume}
        >
          <Banner slide={primary} priority={carousel.index === 0} />
          {slides.length > 1 ? (
            <HeroCarouselControls
              count={slides.length}
              index={carousel.index}
              onGoTo={carousel.goTo}
              onPrev={carousel.goPrev}
              onNext={carousel.goNext}
              paused={carousel.isPaused}
              onTogglePaused={carousel.togglePaused}
            />
          ) : null}
        </div>
        {secondary ? <Banner slide={secondary} priority={false} compact /> : null}
      </div>
    </section>
  );
}
