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
import { applyWholesalePromoHeroSlides } from '@/lib/cms/wholesale-promo-slides';
import { isHomePageKey, resolvePageHeroSlides } from '@/lib/cms/page-hero-policy';
import { useCmsPageScope } from '@/lib/cms/page-scope';
import { toPersianDigits } from '@taranom/persian-utils';
import { yearsOfOperation } from '@/lib/business-facts';
import { STOREFRONT_HERO_FRAME_CLASS } from '@/lib/cms/news-ticker';

const WHOLESALE_FALLBACK: HeroSlide = {
  brandEyebrow: 'پوشاک ترنم',
  headline: 'مانتو زنانه\nمستقیم از تولیدی\nبه بوتیک شما',
  headlineAccent: 'به بوتیک شما',
  body: `تولیدکننده مانتو شومیزی لینن و کتان در مشهد — بیش از ${toPersianDigits(yearsOfOperation())} سال تجربه، فروش عمده به سراسر ایران.`,
  imageUrl: '',
  ctaLabel: 'دیدن مدل‌های عمده',
  ctaHref: '/products',
  ctaSecondaryLabel: 'شروع همکاری از ۶ عدد',
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
  if (isLocalStaticAsset(src)) {
    const mobile = mobileSrc && isLocalStaticAsset(mobileSrc) ? mobileSrc : undefined;
    return (
      <>
        {priority ? (
          mobile ? (
            <link
              rel="preload"
              as="image"
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
          {/* Local static WebP — skip Next optimizer so 24:7 plates are not re-encoded. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mobile || src}
            alt={alt}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            loading={priority ? 'eager' : 'lazy'}
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

function WholesaleSlideCopy({
  slide,
  artwork = false,
  titleAs = 'h2',
}: {
  slide: HeroSlide;
  artwork?: boolean;
  titleAs?: 'h1' | 'h2';
}) {
  const lines = slide.headline.split('\n').filter(Boolean);
  const Title = titleAs;

  return (
    <div className="max-w-3xl">
      {slide.brandEyebrow ? (
        <div className="mb-4 sm:mb-5">
          <span
            className="mb-3 block h-0.5 w-10 rounded-full bg-secondary"
            aria-hidden
          />
          <p className="text-secondary text-sm font-semibold tracking-[0.18em]">
            {slide.brandEyebrow}
          </p>
        </div>
      ) : null}

      <Title className="mb-3 text-pretty text-2xl font-bold leading-[1.2] tracking-tight text-white sm:mb-4 sm:text-4xl lg:text-5xl">
        {lines.map((line, i) => {
          const isAccent = slide.headlineAccent && line.includes(slide.headlineAccent);
          return (
            <span key={i}>
              {i > 0 ? <br /> : null}
              {isAccent ? <span className="text-secondary">{line}</span> : line}
            </span>
          );
        })}
      </Title>

      {slide.body ? (
        <p className="mb-6 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/85 sm:mb-8 sm:text-base">
          {slide.body}
        </p>
      ) : null}

      <div className={`flex flex-wrap gap-3 sm:gap-4 ${artwork ? 'md:hidden' : ''}`}>
        {slide.ctaLabel && slide.ctaHref ? (
          <Link href={slide.ctaHref} className="cursor-pointer">
            <Button
              size="lg"
              variant="secondary"
              className="text-primary-dark hover:text-primary-dark font-bold"
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
              className="border-white/55 bg-transparent text-white hover:border-white hover:bg-white/10 hover:text-white"
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
  const { pageKey } = useCmsPageScope();
  const isHome = isHomePageKey(pageKey);
  const slides = resolvePageHeroSlides(
    pageKey,
    normalizeHeroSlides(props, isHome ? WHOLESALE_FALLBACK : undefined),
    applyWholesalePromoHeroSlides,
  );
  if (!slides.length) return null;
  const autoplayMs = resolveAutoplayMs(props.autoplayMs);
  const carousel = useHeroCarousel(slides, autoplayMs, { waitForIdle: true });
  const slide = carousel.slide ?? slides[0]!;
  const isArtwork = slide.presentation === 'artwork';

  return (
    <section
      className={`bg-primary-dark relative flex items-end overflow-hidden text-white ${STOREFRONT_HERO_FRAME_CLASS} wholesale-editorial-hero`}
      onMouseEnter={carousel.pause}
      onMouseLeave={carousel.resume}
      onFocusCapture={carousel.pause}
      onBlurCapture={carousel.resume}
    >
      {isHome ? <h1 className="sr-only">تولیدی مانتو مشهد؛ خرید عمده از کارگاه ترنم</h1> : null}
      {/* Slide 0 stays mounted (LCP). Other slides mount only while active. */}
      {slides.map((s, i) => {
        if (!s.imageUrl) return null;
        const isActive = i === carousel.index;
        if (!isActive && i !== 0) return null;
        const isLcp = i === 0;
        return (
          <div
            key={`${s.imageUrl}-${i}`}
            className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
              isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={!isActive}
          >
            <WholesaleHeroMedia
              src={s.imageUrl}
              mobileSrc={s.mobileImageUrl}
              alt={s.presentation === 'artwork' ? s.imageAlt || '' : ''}
              priority={isLcp}
              className="object-cover"
            />
          </div>
        );
      })}
      {/* Single two-stop RTL emerald scrim — no gold radial / grid texture (editorial). */}
      <div
        className={`absolute inset-0 ${isArtwork ? 'md:hidden' : ''}`}
        style={{
          background:
            'linear-gradient(100deg, rgba(18,64,53,0.22) 0%, rgba(18,64,53,0.55) 45%, rgba(12,40,33,0.88) 100%)',
        }}
        aria-hidden
      />

      <div
        className={`container-site relative z-10 pb-10 pt-10 sm:pb-14 sm:pt-12 lg:pb-16 lg:pt-12 ${isArtwork ? 'md:sr-only md:pointer-events-none' : ''}`}
      >
        <div key={`ws-copy-${carousel.index}`} className="animate-fade-in">
          <WholesaleSlideCopy slide={slide} artwork={isArtwork} titleAs={isHome ? 'h2' : 'h1'} />
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
