'use client';

import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { HeroCarouselControls, useHeroCarousel } from '@/components/shared/HeroCarousel';
import {
  applyRetailCampaignHeroSlides,
  isLightHeroOverlay,
  normalizeHeroSlides,
  resolveAutoplayMs,
  resolveHeroCopySide,
  type HeroFlatProps,
  type HeroSlide,
} from '@/lib/cms/hero-slides';
import { isHomePageKey, resolveHeroImageUrl, resolvePageHeroSlides } from '@/lib/cms/page-hero-policy';
import { useCmsPageScope } from '@/lib/cms/page-scope';
import { STOREFRONT_HERO_FRAME_CLASS } from '@/lib/cms/news-ticker';

const RETAIL_FALLBACK: HeroSlide = {
  brandEyebrow: 'زیبایی در هارمونی با شما',
  headline: 'استایل شما، امضای ترنم',
  headlineAccent: 'ترنم',
  body: 'کالکشن جدید مانتو و شومیز زنانه — دوخت تولیدی، پارچه‌های لینن و کتان، ارسال سریع به سراسر ایران.',
  imageUrl: '/retail/hero-model.webp',
  ctaLabel: 'دیدن کالکشن لینن و کتان',
  ctaHref: '/retail/products',
  ctaSecondaryLabel: 'رفتن به شومیزها',
  ctaSecondaryHref: '/retail/category/shomiz',
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
  // All local hero plates are already 1920×560 WebP. Next optimizer q=75
  // re-encodes slides 1+ and is what made remaining banners look soft.
  if (isLocalStaticAsset(src)) {
    const mobile = mobileSrc && isLocalStaticAsset(mobileSrc) ? mobileSrc : undefined;
    return (
      <>
        {priority ? (
          mobile ? (
            <link
              rel="preload"
              as="image"
              // Single responsive preload — avoids competing high-priority
              // fetches of both mobile + desktop plates on phones (field LCP).
              imageSrcSet={`${mobile} 900w, ${src} 1920w`}
              imageSizes="100vw"
              fetchPriority="high"
            />
          ) : (
            <link rel="preload" as="image" href={src} fetchPriority="high" />
          )
        ) : null}
        <picture>
          {/* Mobile-first: default img is the LCP plate on phones. */}
          {mobile ? <source media="(min-width: 768px)" srcSet={src} /> : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mobile || src}
            alt={alt}
            fetchPriority={priority ? 'high' : 'auto'}
            loading={priority ? 'eager' : 'lazy'}
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
  titleAs = 'h2',
}: {
  slide: HeroSlide;
  artwork?: boolean;
  light?: boolean;
  titleAs?: 'h1' | 'h2';
}) {
  const accentClass = light ? 'text-[#E07A5F]' : 'text-[var(--retail-gold)]';
  const Title = titleAs;
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

  const primaryCtaClass = light
    ? 'group inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-[#1A73E8] px-7 py-3.5 text-[15px] font-extrabold text-white shadow-[0_12px_32px_rgba(26,115,232,0.32)] transition-[filter,transform] duration-200 hover:brightness-105 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A73E8] active:translate-y-0 sm:min-h-[3.25rem] sm:px-9'
    : 'group inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md bg-[var(--retail-gold)] px-7 py-3.5 text-[15px] font-extrabold text-[#1a1a1a] shadow-[0_12px_36px_rgba(201,168,76,0.38)] transition-[filter,transform,box-shadow] duration-200 hover:brightness-105 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(201,168,76,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--retail-gold)] active:translate-y-0 sm:min-h-[3.25rem] sm:px-9';

  const secondaryCtaClass = light
    ? 'inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border border-[#1A73E8]/70 px-5 py-3 text-sm font-bold text-[#1A73E8] transition-[background-color,transform] duration-200 hover:bg-[#1A73E8]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A73E8] sm:px-7'
    : 'inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md border border-white/45 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-[2px] transition-[background-color,border-color,transform] duration-200 hover:border-white/70 hover:bg-white/16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-7';

  return (
    <div className="min-w-0 max-w-lg text-right sm:max-w-xl">
      {slide.brandEyebrow ? (
        <div className="mb-4 flex min-w-0 flex-wrap items-center justify-end gap-2.5 sm:mb-5 sm:gap-3">
          <span
            className={`min-w-0 text-[11px] font-semibold tracking-[0.14em] sm:text-[12px] sm:tracking-[0.16em] ${
              light ? 'text-[#1A73E8]' : 'text-[var(--retail-gold)]'
            }`}
          >
            {slide.brandEyebrow}
          </span>
          <span
            className={light ? 'h-px w-10 shrink-0 bg-[#1A73E8]/45' : 'retail-gold-line shrink-0'}
            aria-hidden
          />
        </div>
      ) : null}

      <Title
        className={`break-words text-pretty text-[clamp(1.55rem,4.8vw,2.75rem)] font-extrabold leading-[1.22] tracking-tight ${
          light
            ? 'text-[#123A6B]'
            : 'text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.35)]'
        }`}
      >
        {renderHeadline()}
      </Title>

      {slide.body ? (
        <p
          className={`mt-3.5 line-clamp-2 max-w-md text-[13px] leading-7 sm:mt-4 sm:text-[15px] sm:leading-8 ${
            light ? 'text-[#2C4A6E]' : 'text-white/82'
          }`}
        >
          {slide.body}
        </p>
      ) : null}

      <div
        className={`mt-6 flex flex-wrap items-center justify-end gap-3 sm:mt-7 sm:gap-3.5 ${
          artwork ? 'md:hidden' : ''
        }`}
      >
        {slide.ctaLabel && slide.ctaHref ? (
          <Link href={slide.ctaHref} className={primaryCtaClass}>
            {slide.ctaLabel}
            <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        ) : null}
        {slide.ctaSecondaryLabel && slide.ctaSecondaryHref ? (
          <Link href={slide.ctaSecondaryHref} className={secondaryCtaClass}>
            {slide.ctaSecondaryLabel}
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** B2C editorial hero — full-bleed plates + soft RTL scrim (no hard split panel). */
export function RetailHero(props: RetailHeroProps) {
  const { pageKey } = useCmsPageScope();
  const isHome = isHomePageKey(pageKey);
  const slides = resolvePageHeroSlides(
    pageKey,
    normalizeHeroSlides(props, isHome ? RETAIL_FALLBACK : undefined),
    applyRetailCampaignHeroSlides,
  );
  if (!slides.length) return null;
  const autoplayMs = resolveAutoplayMs(props.autoplayMs);
  const carousel = useHeroCarousel(slides, autoplayMs, { waitForIdle: true });

  const slide = carousel.slide ?? slides[0]!;
  const isArtwork = slide.presentation === 'artwork';
  const isLight = isLightHeroOverlay(slide);
  const copySide = resolveHeroCopySide(slide);
  const copyAtStart = copySide === 'start';

  return (
    <section
      className={`relative isolate overflow-hidden ${STOREFRONT_HERO_FRAME_CLASS} retail-editorial-hero ${
        isLight ? 'bg-[#EEF4FC] text-[#123A6B]' : 'bg-[var(--retail-primary-dark)] text-white'
      }`}
      onMouseEnter={carousel.pause}
      onMouseLeave={carousel.resume}
      onFocusCapture={carousel.pause}
      onBlurCapture={carousel.resume}
    >
      {isHome ? <h1 className="sr-only">خرید آنلاین مانتو، شومیز و پوشاک زنانه ترنم</h1> : null}
      {/* Slide 0 stays mounted (LCP). Other slides mount only while active. */}
      {slides.map((s, i) => {
        const src = resolveHeroImageUrl(pageKey, s.imageUrl, '/retail/hero-model.webp');
        if (!src) return null;
        const isActive = i === carousel.index;
        if (!isActive && i !== 0) return null;
        const isLcp = i === 0;
        const side = resolveHeroCopySide(s);
        const productToward =
          s.presentation === 'artwork'
            ? 'object-cover object-left md:object-center'
            : side === 'end'
              ? isLightHeroOverlay(s)
                ? 'object-cover object-[center_top] sm:object-right'
                : 'object-cover object-[82%_center] sm:object-[78%_center] lg:object-center scale-[1.02]'
              : isLightHeroOverlay(s)
                ? 'object-cover object-[center_top] sm:object-left'
                : 'object-cover object-[18%_center] sm:object-[22%_center] lg:object-center scale-[1.02]';
        return (
          <div
            key={`${src}-${i}`}
            className={`absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none ${
              isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={!isActive}
          >
            <RetailHeroMedia
              src={src}
              mobileSrc={s.mobileImageUrl}
              alt={s.imageAlt || ''}
              priority={isLcp}
              className={productToward}
            />
          </div>
        );
      })}

      {/* Cinematic RTL scrim — soft wash into photo, not a boxed panel */}
      <div
        className={`absolute inset-0 ${isArtwork ? 'md:hidden' : ''} ${isLight ? 'md:hidden' : ''}`}
        style={{
          background: isLight
            ? 'linear-gradient(to top, rgba(238,244,252,0.97) 0%, rgba(238,244,252,0.88) 28%, rgba(238,244,252,0.2) 52%, transparent 72%)'
            : copyAtStart
              ? `
            linear-gradient(105deg,
              rgba(8,28,22,0.08) 0%,
              rgba(12,39,30,0.22) 38%,
              rgba(12,39,30,0.72) 66%,
              rgba(8,28,22,0.92) 100%),
            linear-gradient(to top, rgba(8,28,22,0.45) 0%, transparent 42%)
          `
              : `
            linear-gradient(255deg,
              rgba(8,28,22,0.08) 0%,
              rgba(12,39,30,0.22) 38%,
              rgba(12,39,30,0.72) 66%,
              rgba(8,28,22,0.92) 100%),
            linear-gradient(to top, rgba(8,28,22,0.45) 0%, transparent 42%)
          `,
        }}
        aria-hidden
      />
      {isLight && !isArtwork ? (
        <div
          className="pointer-events-none absolute inset-0 hidden md:block"
          style={{
            background: copyAtStart
              ? 'linear-gradient(105deg, rgba(238,244,252,0) 0%, rgba(238,244,252,0.1) 48%, rgba(238,244,252,0.78) 72%, rgba(238,244,252,0.94) 100%)'
              : 'linear-gradient(255deg, rgba(238,244,252,0) 0%, rgba(238,244,252,0.1) 48%, rgba(238,244,252,0.78) 72%, rgba(238,244,252,0.94) 100%)',
          }}
          aria-hidden
        />
      ) : null}
      {/* Soft exit into trust strip */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-10 sm:h-12"
        style={{
          background: isLight
            ? 'linear-gradient(to top, var(--retail-surface, #F6F1E8), transparent)'
            : isArtwork
              ? 'linear-gradient(to top, rgba(246,241,232,0.55), transparent)'
              : 'linear-gradient(to top, rgba(8,28,22,0.35), transparent)',
        }}
        aria-hidden
      />
      <div
        className={`absolute inset-0 opacity-[0.04] ${isArtwork || isLight ? 'hidden' : ''}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      <div
        className={`relative z-10 mx-auto flex h-full max-w-[1200px] items-end px-4 pb-16 pt-8 sm:px-6 sm:pb-[4.25rem] lg:items-center lg:px-8 lg:pb-16 ${
          copyAtStart ? 'justify-start' : 'justify-end'
        } ${isArtwork ? 'md:sr-only md:pointer-events-none' : ''}`}
      >
        <div
          key={`copy-${carousel.index}`}
          className="animate-fade-in motion-reduce:animate-none min-w-0 w-full max-w-xl lg:w-[46%]"
        >
          <RetailSlideCopy
            slide={slide}
            artwork={isArtwork}
            light={isLight}
            titleAs={isHome ? 'h2' : 'h1'}
          />
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
