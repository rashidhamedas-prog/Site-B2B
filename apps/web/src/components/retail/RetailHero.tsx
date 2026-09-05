'use client';

import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { HeroCarouselControls, useHeroCarousel } from '@/components/shared/HeroCarousel';
import {
  isLightHeroOverlay,
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

function isLocalStaticAsset(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//') && !src.startsWith('/_next/');
}

function RetailHeroMedia({
  src,
  mobileSrc,
  alt,
  className,
  priority,
}: {
  src: string;
  mobileSrc?: string;
  alt: string;
  className: string;
  priority: boolean;
}) {
  if (priority && isLocalStaticAsset(src)) {
    const mobile = mobileSrc && isLocalStaticAsset(mobileSrc) ? mobileSrc : undefined;
    return (
      <>
        {mobile ? (
          <>
            <link rel="preload" as="image" href={mobile} media="(max-width: 767px)" fetchPriority="high" />
            <link rel="preload" as="image" href={src} media="(min-width: 768px)" fetchPriority="high" />
          </>
        ) : (
          <link rel="preload" as="image" href={src} fetchPriority="high" />
        )}
        <picture>
          {mobile ? <source media="(max-width: 767px)" srcSet={mobile} /> : null}
          {/* Local static WebP — skip Next optimizer (no JPEG transcode, no empty preload). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            fetchPriority="high"
            decoding="async"
            className={`absolute inset-0 h-full w-full ${className}`}
          />
        </picture>
      </>
    );
  }

  return (
    <picture>
      {mobileSrc ? (
        <source
          media="(max-width: 767px)"
          srcSet={
            getImageProps({
              src: mobileSrc,
              alt: '',
              fill: true,
              sizes: '100vw',
              quality: 70,
            }).props.srcSet
          }
        />
      ) : null}
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        fetchPriority={priority ? 'high' : 'auto'}
        loading={priority ? 'eager' : 'lazy'}
        quality={75}
        sizes="100vw"
        className={className}
      />
    </picture>
  );
}

function RetailSlideCopy({
  slide,
  artwork = false,
  light = false,
}: {
  slide: HeroSlide;
  artwork?: boolean;
  light?: boolean;
}) {
  const accentClass = light ? 'text-[#E07A5F]' : 'text-[var(--retail-gold)]';
  const renderHeadline = () => {
    if (slide.headlineAccent && slide.headline.includes(slide.headlineAccent)) {
      const parts = slide.headline.split(slide.headlineAccent);
      return (
        <>
          {parts[0]}
          <span className={accentClass}>{slide.headlineAccent}</span>
          {parts.slice(1).join(slide.headlineAccent)}
        </>
      );
    }
    return slide.headline;
  };

  return (
    <div className="min-w-0 max-w-xl text-center lg:ms-auto lg:text-right">
      {slide.brandEyebrow ? (
        <div className="mb-5 flex min-w-0 flex-wrap items-center justify-center gap-2 sm:gap-3 lg:justify-end">
          <span className={light ? 'h-px w-8 shrink-0 bg-[#1A73E8]/45' : 'retail-gold-line shrink-0'} />
          <span
            className={`min-w-0 text-[12px] font-medium tracking-[0.06em] sm:text-[13px] sm:tracking-[0.12em] ${
              light ? 'text-[#1A73E8]' : 'text-[var(--retail-gold)]'
            }`}
          >
            {slide.brandEyebrow}
          </span>
          <span className={light ? 'h-px w-8 shrink-0 bg-[#1A73E8]/45' : 'retail-gold-line shrink-0'} />
        </div>
      ) : null}

      <h2
        className={`break-words text-[clamp(1.75rem,6vw,3.4rem)] font-bold leading-[1.35] tracking-tight ${
          light
            ? 'text-[#123A6B]'
            : '!text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.35)]'
        }`}
      >
        {renderHeadline()}
      </h2>

      {slide.body ? (
        <p
          className={`mx-auto mt-5 max-w-md text-[15px] leading-8 lg:mx-0 lg:ms-auto ${
            light ? 'text-[#2C4A6E]' : 'text-white/80'
          }`}
        >
          {slide.body}
        </p>
      ) : null}

      <div
        className={`mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-end ${artwork ? 'md:hidden' : ''}`}
      >
        {slide.ctaLabel && slide.ctaHref ? (
          <Link
            href={slide.ctaHref}
            className={
              light
                ? 'inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-[#1A73E8] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_28px_rgba(26,115,232,0.28)] transition duration-200 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A73E8] sm:px-7'
                : 'inline-flex cursor-pointer items-center gap-2 rounded-md bg-gradient-to-l from-[#A88530] to-[var(--retail-gold)] px-5 py-3.5 text-sm font-extrabold text-[#1a1a1a] shadow-[0_10px_30px_rgba(201,168,76,0.28)] transition duration-200 hover:brightness-105 sm:px-7'
            }
          >
            {slide.ctaLabel}
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : null}
        {slide.ctaSecondaryLabel && slide.ctaSecondaryHref ? (
          <Link
            href={slide.ctaSecondaryHref}
            className={
              light
                ? 'inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border border-[#1A73E8]/70 px-5 py-3.5 text-sm font-bold text-[#1A73E8] transition duration-200 hover:bg-[#1A73E8]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A73E8] sm:px-7'
                : 'border-[var(--retail-gold)]/60 inline-flex cursor-pointer items-center gap-2 rounded-md border bg-black/20 px-5 py-3.5 text-sm font-bold text-[var(--retail-gold)] backdrop-blur-sm transition duration-200 hover:bg-white/10 sm:px-7'
            }
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
  const carousel = useHeroCarousel(slides, autoplayMs, { waitForIdle: true });

  const slide = carousel.slide ?? RETAIL_FALLBACK;
  const isArtwork = slide.presentation === 'artwork';
  const isLight = isLightHeroOverlay(slide);

  return (
    <section
      className={`relative isolate min-h-[min(82vh,40rem)] overflow-hidden ${
        isLight ? 'bg-[#EEF4FC] text-[#123A6B]' : 'bg-[var(--retail-primary-dark)] text-white'
      } ${isArtwork ? 'md:aspect-[192/85] md:min-h-0' : 'md:min-h-[min(92vh,860px)]'}`}
      onMouseEnter={carousel.pause}
      onMouseLeave={carousel.resume}
      onFocusCapture={carousel.pause}
      onBlurCapture={carousel.resume}
    >
      <h1 className="sr-only">خرید آنلاین مانتو، شومیز و پوشاک زنانه ترنم</h1>
      {/* Slide 0 stays mounted (LCP). Other slides mount only while active. */}
      {slides.map((s, i) => {
        const src = s.imageUrl || '/retail/hero-model.webp';
        const isActive = i === carousel.index;
        if (!isActive && i !== 0) return null;
        const isLcp = i === 0;
        return (
          <div
            key={`${src}-${i}`}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={!isActive}
          >
            <RetailHeroMedia
              src={src}
              mobileSrc={s.mobileImageUrl}
              alt={s.imageAlt || ''}
              priority={isLcp}
              className={
                s.presentation === 'artwork'
                  ? 'object-cover md:object-fill'
                  : isLightHeroOverlay(s)
                    ? 'object-cover object-[center_top] sm:object-left'
                    : 'object-cover object-[20%_center] sm:object-center'
              }
            />
          </div>
        );
      })}

      {/* Brand wash + RTL readable scrim (copy sits on the right in RTL) */}
      <div
        className={`absolute inset-0 ${isArtwork ? 'md:hidden' : ''} ${isLight ? 'md:hidden' : ''}`}
        style={{
          background: isLight
            ? 'linear-gradient(to top, rgba(238,244,252,0.97) 0%, rgba(238,244,252,0.88) 28%, rgba(238,244,252,0.2) 52%, transparent 72%)'
            : `
            linear-gradient(100deg, rgba(12,39,30,0.15) 0%, rgba(12,39,30,0.35) 42%, rgba(12,39,30,0.82) 68%, rgba(8,28,22,0.94) 100%),
            radial-gradient(ellipse 45% 55% at 88% 40%, rgba(201,168,76,0.18), transparent 55%)
          `,
        }}
        aria-hidden
      />
      {isLight && !isArtwork ? (
        <div
          className="pointer-events-none absolute inset-0 hidden md:block"
          style={{
            background:
              'linear-gradient(100deg, rgba(238,244,252,0) 0%, rgba(238,244,252,0.12) 46%, rgba(238,244,252,0.78) 70%, rgba(238,244,252,0.94) 100%)',
          }}
          aria-hidden
        />
      ) : null}
      <div
        className={`absolute inset-0 opacity-[0.05] ${isArtwork || isLight ? 'hidden' : ''}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      <div
        className={`relative z-10 mx-auto flex min-h-[min(82vh,40rem)] max-w-[1200px] items-end px-4 pb-24 pt-24 sm:px-6 md:min-h-0 lg:items-center lg:px-8 lg:pb-28 ${isArtwork ? 'md:sr-only md:pointer-events-none' : 'md:min-h-[min(92vh,860px)]'}`}
      >
        <div key={`copy-${carousel.index}`} className="animate-fade-in min-w-0 w-full lg:w-[48%]">
          <RetailSlideCopy slide={slide} artwork={isArtwork} light={isLight} />
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
          tone={isLight ? 'ink' : 'gold'}
        />
      ) : null}
    </section>
  );
}
