import React from 'react';
import { preload } from 'react-dom';
import { getImageProps } from 'next/image';

export const HERO_MOBILE_MEDIA = '(max-width: 767px)';
export const HERO_DESKTOP_MEDIA = '(min-width: 768px)';
const HERO_SIZES = '100vw';

type HeroPlate = { src: string; srcSet?: string };

function isLocalStaticAsset(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//') && !src.startsWith('/_next/');
}

/** Local `/banners/*.webp` plates are pre-optimized; only remote media goes through the optimizer. */
function resolvePlate(src: string): HeroPlate {
  if (isLocalStaticAsset(src)) return { src };
  const { props } = getImageProps({ src, alt: '', fill: true, sizes: HERO_SIZES, quality: 75 });
  return { src: props.src, srcSet: props.srcSet };
}

function preloadPlate(plate: HeroPlate, media?: string) {
  preload(plate.src, {
    as: 'image',
    fetchPriority: 'high',
    ...(plate.srcSet ? { imageSrcSet: plate.srcSet, imageSizes: HERO_SIZES } : {}),
    ...(media ? { media } : {}),
  });
}

export function StorefrontHeroMedia({
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
  const desktop = resolvePlate(src);
  const mobile = mobileSrc ? resolvePlate(mobileSrc) : undefined;
  const fallback = mobile ?? desktop;

  // Preload media queries must mirror the <picture> sources exactly, otherwise
  // the browser fetches a plate it never paints.
  if (priority) {
    if (mobile) {
      preloadPlate(mobile, HERO_MOBILE_MEDIA);
      preloadPlate(desktop, HERO_DESKTOP_MEDIA);
    } else {
      preloadPlate(desktop);
    }
  }

  return (
    <picture>
      {mobile ? (
        <source
          media={HERO_DESKTOP_MEDIA}
          srcSet={desktop.srcSet ?? desktop.src}
          sizes={desktop.srcSet ? HERO_SIZES : undefined}
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fallback.src}
        srcSet={fallback.srcSet}
        sizes={fallback.srcSet ? HERO_SIZES : undefined}
        alt={alt}
        fetchPriority={priority ? 'high' : 'auto'}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? undefined : 'async'}
        className={`absolute inset-0 h-full w-full ${className}`}
      />
    </picture>
  );
}
