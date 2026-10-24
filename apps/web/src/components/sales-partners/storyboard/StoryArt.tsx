import Image from 'next/image';
import styles from './storyboard.module.css';

/**
 * Art-directed frame. Below 768px the mobile text card is used.
 * From 768px the text-free desktop file is the next/image fallback.
 * The box stays 4:5 below 768px and 16:9 from 768px up.
 */
export function StoryArt({
  desktopSrc,
  mobileSrc,
  alt,
  eager = false,
}: {
  desktopSrc: string;
  mobileSrc: string;
  alt: string;
  eager?: boolean;
}) {
  return (
    <div className={styles.frame}>
      <picture className={styles.picture}>
        <source media="(max-width: 767px)" srcSet={mobileSrc} type="image/webp" />
        <Image
          src={desktopSrc}
          alt={alt}
          fill
          sizes="(max-width: 767px) 88vw, (max-width: 1023px) 46vw, 32vw"
          className={styles.img}
          loading={eager ? 'eager' : 'lazy'}
        />
      </picture>
    </div>
  );
}
