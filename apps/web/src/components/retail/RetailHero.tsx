'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { HeroCarouselControls, useHeroCarousel } from '@/components/shared/HeroCarousel';
import {
  normalizeHeroSlides,
  resolveAutoplayMs,
  type HeroFlatProps,
  type HeroSlide,
} from '@/lib/cms/hero-slides';

const RETAIL_FALLBACK: HeroSlide = {
  brandEyebrow: 'زیبایی در هارمونی با شما',
  headline: 'استایل شما، امضای ترنم',
  headlineAccent: 'ترنم',
  body: 'کالکشن جدید مانتو و شومیز زنانه — دوخت تولیدی، پارچه‌های لینن و کتان، ارسال سریع به سراسر ایران.',
  imageUrl: '/retail/hero-model.webp',
  ctaLabel: 'مشاهده جدیدترین‌ها',
  ctaHref: '/retail/products',
  ctaSecondaryLabel: 'مشاهده مجموعه',
  ctaSecondaryHref: '/retail/collections',
};

export type RetailHeroProps = HeroFlatProps;

function RetailSlideCopy({ slide, artwork = false }: { slide: HeroSlide; artwork?: boolean }) {
  const renderHeadline = () => {
    if (slide.headlineAccent && slide.headline.includes(slide.headlineAccent)) {
      const parts = slide.headline.split(slide.headlineAccent);
      return (
        <>
          {parts[0]}
          <span className="text-[var(--retail-gold)]">{slide.headlineAccent}</span>
          {parts.slice(1).join(slide.headlineAccent)}
        </>
      );
    }
    return slide.headline;
  };

  return (
    <div className="max-w-xl text-center lg:ms-auto lg:text-right">
      {slide.brandEyebrow ? (
        <div className="mb-5 flex items-center justify-center gap-3 lg:justify-end">
          <span className="retail-gold-line" />
          <span className="text-[13px] font-medium tracking-[0.12em] text-[var(--retail-gold)]">
            {slide.brandEyebrow}
          </span>
          <span className="retail-gold-line" />
        </div>
      ) : null}

      <h2 className="text-[clamp(2rem,4.5vw,3.4rem)] font-extrabold leading-[1.35] tracking-tight !text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.35)]">
        {renderHeadline()}
      </h2>

      {slide.body ? (
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-8 text-white/80 lg:mx-0 lg:ms-auto">
          {slide.body}
        </p>
      ) : null}

      <div
        className={`mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-end ${artwork ? 'md:hidden' : ''}`}
      >
        {slide.ctaLabel && slide.ctaHref ? (
          <Link
            href={slide.ctaHref}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-gradient-to-l from-[#A88530] to-[var(--retail-gold)] px-7 py-3.5 text-sm font-extrabold text-[#1a1a1a] shadow-[0_10px_30px_rgba(201,168,76,0.28)] transition duration-200 hover:brightness-105"
          >
            {slide.ctaLabel}
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : null}
        {slide.ctaSecondaryLabel && slide.ctaSecondaryHref ? (
          <Link
            href={slide.ctaSecondaryHref}
            className="border-[var(--retail-gold)]/60 inline-flex cursor-pointer items-center gap-2 rounded-md border bg-black/20 px-7 py-3.5 text-sm font-bold text-[var(--retail-gold)] backdrop-blur-sm transition duration-200 hover:bg-white/10"
          >
            {slide.ctaSecondaryLabel}
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** B2C editorial hero — full-bleed plates + RTL copy panel (distinct from wholesale). */
export function RetailHero(props: RetailHeroProps) {
  const slides = normalizeHeroSlides(props, RETAIL_FALLBACK);
  const autoplayMs = resolveAutoplayMs(props.autoplayMs);
  const carousel = useHeroCarousel(slides, autoplayMs);

  const slide = carousel.slide ?? RETAIL_FALLBACK;
  const isArtwork = slide.presentation === 'artwork';

  return (
    <section
      className={`relative isolate min-h-[82vh] overflow-hidden bg-[var(--retail-primary-dark)] text-white ${
        isArtwork ? 'md:aspect-[192/85] md:min-h-0' : 'md:min-h-[min(92vh,860px)]'
      }`}
      onMouseEnter={carousel.pause}
      onMouseLeave={carousel.resume}
      onFocusCapture={carousel.pause}
      onBlurCapture={carousel.resume}
    >
      <h1 className="sr-only">خرید آنلاین مانتو، شومیز و پوشاک زنانه ترنم</h1>
      {/* Full-bleed slide media — only active + neighbors for LCP */}
      {slides.map((s, i) => {
        const src = s.imageUrl || '/retail/hero-model.webp';
        const near =
          Math.abs(i - carousel.index) <= 1 ||
          (carousel.index === 0 && i === slides.length - 1) ||
          (carousel.index === slides.length - 1 && i === 0);
        if (!near) return null;
        return (
          <div
            key={`${src}-${i}`}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              i === carousel.index ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={i !== carousel.index}
          >
            <picture>
              {s.mobileImageUrl ? (
                <source media="(max-width: 767px)" srcSet={s.mobileImageUrl} />
              ) : null}
              <Image
                src={src}
                alt={s.presentation === 'artwork' ? s.imageAlt || '' : ''}
                fill
                priority={i === 0}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                quality={88}
                sizes="100vw"
                className={
                  s.presentation === 'artwork'
                    ? 'object-cover md:object-fill'
                    : 'object-cover object-[20%_center] sm:object-center'
                }
              />
            </picture>
          </div>
        );
      })}

      {/* Brand wash + RTL readable scrim (copy sits on the right in RTL) */}
      <div
        className={`absolute inset-0 ${isArtwork ? 'md:hidden' : ''}`}
        style={{
          background: `
            linear-gradient(100deg, rgba(12,39,30,0.15) 0%, rgba(12,39,30,0.35) 42%, rgba(12,39,30,0.82) 68%, rgba(8,28,22,0.94) 100%),
            radial-gradient(ellipse 45% 55% at 88% 40%, rgba(201,168,76,0.18), transparent 55%)
          `,
        }}
        aria-hidden
      />
      <div
        className={`absolute inset-0 opacity-[0.05] ${isArtwork ? 'md:hidden' : ''}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      <div
        className={`relative z-10 mx-auto flex min-h-[82vh] max-w-[1200px] items-end px-4 pb-24 pt-28 sm:px-6 md:min-h-0 lg:items-center lg:px-8 lg:pb-28 ${isArtwork ? 'md:sr-only md:pointer-events-none' : 'md:min-h-[min(92vh,860px)]'}`}
      >
        <div key={`copy-${carousel.index}`} className="animate-fade-in w-full lg:w-[48%]">
          <RetailSlideCopy slide={slide} artwork={isArtwork} />
        </div>
      </div>

      {isArtwork && slide.ctaHref ? (
        <Link
          href={slide.ctaHref}
          aria-label={`${slide.ctaLabel || 'مشاهده'} — ${slide.headline}`}
          className="absolute inset-0 z-10 hidden cursor-pointer focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--retail-gold)] md:block"
        />
      ) : null}

      {carousel.showControls ? (
        <HeroCarouselControls
          count={carousel.count}
          index={carousel.index}
          onGoTo={carousel.goTo}
          onPrev={carousel.goPrev}
          onNext={carousel.goNext}
          paused={carousel.isPaused}
          onTogglePaused={carousel.togglePaused}
          tone="gold"
        />
      ) : null}
    </section>
  );
}
