'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  imageUrl: '/retail/hero-model.png',
  ctaLabel: 'مشاهده جدیدترین‌ها',
  ctaHref: '/retail/products',
  ctaSecondaryLabel: 'مشاهده مجموعه',
  ctaSecondaryHref: '/retail/collections',
};

export type RetailHeroProps = HeroFlatProps;

function RetailSlideCopy({ slide }: { slide: HeroSlide }) {
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
    <div className="pb-16 text-center lg:pb-20 lg:text-right">
      {slide.brandEyebrow ? (
        <div className="mb-5 flex items-center justify-center gap-3 lg:justify-start">
          <span className="retail-gold-line" />
          <span className="text-sm font-medium text-[var(--retail-gold)]">{slide.brandEyebrow}</span>
          <span className="retail-gold-line" />
        </div>
      ) : null}

      <h1 className="text-[clamp(1.85rem,4.2vw,3.15rem)] font-extrabold leading-[1.45] tracking-tight">
        {renderHeadline()}
      </h1>

      {slide.body ? (
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-8 text-white/75 lg:mx-0">{slide.body}</p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
        {slide.ctaLabel && slide.ctaHref ? (
          <Link
            href={slide.ctaHref}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-gradient-to-l from-[#A88530] to-[var(--retail-gold)] px-6 py-3 text-sm font-extrabold text-[#1a1a1a] shadow-lg transition hover:brightness-105"
          >
            {slide.ctaLabel}
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : null}
        {slide.ctaSecondaryLabel && slide.ctaSecondaryHref ? (
          <Link
            href={slide.ctaSecondaryHref}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--retail-gold)]/70 bg-[var(--retail-primary-dark)]/40 px-6 py-3 text-sm font-bold text-[var(--retail-gold)] transition hover:bg-white/5"
          >
            {slide.ctaSecondaryLabel}
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function RetailHero(props: RetailHeroProps) {
  const slides = normalizeHeroSlides(props, RETAIL_FALLBACK);
  const autoplayMs = resolveAutoplayMs(props.autoplayMs);
  const carousel = useHeroCarousel(slides, autoplayMs);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const slide = carousel.slide ?? RETAIL_FALLBACK;
  const imageSrc = slide.imageUrl || '/retail/hero-model.png';

  return (
    <section
      className="relative isolate overflow-hidden bg-[var(--retail-primary-dark)] text-white"
      onMouseEnter={carousel.pause}
      onMouseLeave={carousel.resume}
      onFocusCapture={carousel.pause}
      onBlurCapture={carousel.resume}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 40% 60% at 8% 40%, rgba(201,168,76,0.22), transparent 55%),
            radial-gradient(ellipse 35% 50% at 92% 55%, rgba(201,168,76,0.18), transparent 50%),
            linear-gradient(165deg, #0c271e 0%, #124035 42%, #1a4d3e 100%)
          `,
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
        aria-hidden
      />

      <div
        className={`relative mx-auto grid min-h-[min(92vh,820px)] max-w-[1200px] items-end gap-8 px-4 pt-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-6 lg:px-8 lg:pt-6 transition-all duration-700 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div key={`copy-${carousel.index}`} className="order-2 animate-fade-in lg:order-1">
          <RetailSlideCopy slide={slide} />
        </div>

        <div className="relative order-1 mx-auto flex h-[min(58vh,560px)] w-full max-w-md items-end justify-center lg:order-2 lg:mx-0 lg:h-[min(86vh,760px)] lg:max-w-none">
          <div
            className="absolute bottom-0 h-[85%] w-[78%] rounded-[40%_40%_12%_12%/28%_28%_8%_8%] bg-[radial-gradient(circle_at_50%_30%,rgba(201,168,76,0.15),transparent_60%)]"
            aria-hidden
          />
          <div key={`img-${carousel.index}`} className="relative z-[1] h-full w-full animate-fade-in">
            <Image
              src={imageSrc}
              alt={slide.headline}
              width={720}
              height={960}
              priority={carousel.index === 0}
              className="h-full w-full object-contain object-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
            />
          </div>
        </div>
      </div>

      {carousel.showControls ? (
        <HeroCarouselControls
          count={carousel.count}
          index={carousel.index}
          onGoTo={carousel.goTo}
          onPrev={carousel.goPrev}
          onNext={carousel.goNext}
          tone="gold"
        />
      ) : null}
    </section>
  );
}
