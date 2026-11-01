import React from 'react';
import Image, { getImageProps } from 'next/image';

function isLocalStaticAsset(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//') && !src.startsWith('/_next/');
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
  if (isLocalStaticAsset(src)) {
    const mobile = mobileSrc && isLocalStaticAsset(mobileSrc) ? mobileSrc : undefined;
    return (
      <picture>
        {/* The initial HTML exposes exactly one matching source to the preload scanner. */}
        {mobile ? <source media="(min-width: 768px)" srcSet={src} /> : null}
        {/* Pre-optimized local WebP plates should not be re-encoded by Next. */}
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
