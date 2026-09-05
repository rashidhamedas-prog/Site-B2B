'use client';

import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import { HeroCarouselControls, useHeroCarousel } from '@/components/shared/HeroCarousel';
import {
  normalizeHeroSlides,
  resolveAutoplayMs,
  type HeroFlatProps,
  type HeroSlide,
} from '@/lib/cms/hero-slides';
import { toPersianDigits } from '@taranom/persian-utils';
import { yearsOfOperation } from '@/lib/business-facts';

const WHOLESALE_FALLBACK: HeroSlide = {
  brandEyebrow: 'پوشاک ترنم',
  headline: 'مانتو زنانه\nمستقیم از تولیدی\nبه بوتیک شما',
  headlineAccent: 'به بوتیک شما',
  body: `تولیدکننده مانتو شومیزی لینن و کتان در مشهد — بیش از ${toPersianDigits(yearsOfOperation())} سال تجربه، فروش عمده به سراسر ایران.`,
  imageUrl: '',
  ctaLabel: 'مشاهده محصولات',
  ctaHref: '/products',
  ctaSecondaryLabel: 'ثبت‌نام عمده‌فروش',
  ctaSecondaryHref: '/portal/register',
};

export type HeroSectionProps = HeroFlatProps;

function isLocalStaticAsset(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//') && !src.startsWith('/_next/');
}

function WholesaleHeroMedia({
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
          {/* Local static WebP — skip Next optimizer so LCP is not a JPEG transcode MISS. */}
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

function WholesaleSlideCopy({ slide, artwork = false }: { slide: HeroSlide; artwork?: boolean }) {
  const lines = slide.headline.split('\n').filter(Boolean);

  return (
    <div className="max-w-3xl">
      {slide.brandEyebrow ? (
        <p className="text-secondary mb-5 text-sm font-semibold tracking-[0.18em]">
          {slide.brandEyebrow}
        </p>
      ) : null}

      <h2 className="mb-6 text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
        {lines.map((line, i) => {
          const isAccent = slide.headlineAccent && line.includes(slide.headlineAccent);
          return (
            <span key={i}>
              {i > 0 ? <br /> : null}
              {isAccent ? <span className="text-secondary">{line}</span> : line}
            </span>
          );
        })}
      </h2>

      {slide.body ? (
        <p className="mb-10 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
          {slide.body}
        </p>
      ) : null}

      <div className={`flex flex-wrap gap-3 sm:gap-4 ${artwork ? 'md:hidden' : ''}`}>
        {slide.ctaLabel && slide.ctaHref ? (
          <Link href={slide.ctaHref} className="cursor-pointer">
            <Button
              size="lg"
              variant="secondary"
              leftIcon={<ArrowLeft className="rtl-flip h-5 w-5" />}
            >
              {slide.ctaLabel}
            </Button>
          </Link>
        ) : null}
        {slide.ctaSecondaryLabel && slide.ctaSecondaryHref ? (
          <Link href={slide.ctaSecondaryHref} className="cursor-pointer">
            <Button
              size="lg"
              variant="outline"
              className="hover:text-primary border-white/40 text-white hover:border-white hover:bg-white"
            >
              {slide.ctaSecondaryLabel}
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function HeroSection(props: HeroSectionProps) {
  const slides = normalizeHeroSlides(props, WHOLESALE_FALLBACK);
  const autoplayMs = resolveAutoplayMs(props.autoplayMs);
  const carousel = useHeroCarousel(slides, autoplayMs, { waitForIdle: true });
  const slide = carousel.slide ?? WHOLESALE_FALLBACK;
  const isArtwork = slide.presentation === 'artwork';

  return (
    <section
      className={`bg-primary-dark relative flex min-h-[82vh] items-end overflow-hidden text-white ${
        isArtwork ? 'md:aspect-[192/85] md:min-h-0 md:items-stretch' : 'lg:min-h-[92vh]'
      }`}
      onMouseEnter={carousel.pause}
      onMouseLeave={carousel.resume}
      onFocusCapture={carousel.pause}
      onBlurCapture={carousel.resume}
    >
      <h1 className="sr-only">تولیدی مانتو مشهد؛ خرید عمده از کارگاه ترنم</h1>
      {/* Slide 0 stays mounted (LCP). Other slides mount only while active. */}
      {slides.map((s, i) => {
        if (!s.imageUrl) return null;
        const isActive = i === carousel.index;
        if (!isActive && i !== 0) return null;
        const isLcp = i === 0;
        return (
          <div
            key={`${s.imageUrl}-${i}`}
            className={`absolute inset-0 transition-opacity duration-700 ${
              isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={!isActive}
          >
            <WholesaleHeroMedia
              src={s.imageUrl}
              mobileSrc={s.mobileImageUrl}
              alt={s.presentation === 'artwork' ? s.imageAlt || '' : ''}
              priority={isLcp}
              className={
                s.presentation === 'artwork' ? 'object-cover md:object-fill' : 'object-cover'
              }
            />
          </div>
        );
      })}
      {/* Transparent RTL scrim — never an opaque green wash (product heroes are already dark). */}
      <div
        className={`absolute inset-0 ${isArtwork ? 'md:hidden' : ''}`}
        style={{
          background: `
            linear-gradient(100deg, rgba(18,64,53,0.18) 0%, rgba(18,64,53,0.32) 40%, rgba(18,64,53,0.78) 68%, rgba(12,40,33,0.92) 100%),
            radial-gradient(ellipse 42% 55% at 12% 30%, rgba(201,168,76,0.16), transparent 55%)
          `,
        }}
        aria-hidden
      />
      <div
        className={`absolute inset-0 opacity-[0.04] ${isArtwork ? 'md:hidden' : ''}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M0 40h80M40 0v80'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '80px 80px',
        }}
        aria-hidden
      />

      <div
        className={`container-site relative z-10 pb-20 pt-28 sm:pb-24 lg:pb-28 lg:pt-32 ${isArtwork ? 'md:sr-only md:pointer-events-none' : ''}`}
      >
        <div key={`ws-copy-${carousel.index}`} className="animate-fade-in">
          <WholesaleSlideCopy slide={slide} artwork={isArtwork} />
        </div>
      </div>

      {isArtwork && slide.ctaHref ? (
        <Link
          href={slide.ctaHref}
          aria-label={`${slide.ctaLabel || 'مشاهده'} — ${slide.headline}`}
          className="focus-visible:outline-secondary absolute inset-0 z-10 hidden cursor-pointer focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] md:block"
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
          tone="secondary"
        />
      ) : null}
    </section>
  );
}
