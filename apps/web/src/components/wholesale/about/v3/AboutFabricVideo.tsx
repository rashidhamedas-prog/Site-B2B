'use client';

import { useEffect, useRef, useState } from 'react';

const DESKTOP = {
  poster: '/about/v3/about-fabric-poster.jpg',
  webm: '/about/v3/about-fabric-desktop.webm',
  mp4: '/about/v3/about-fabric-desktop.mp4',
};
const MOBILE = {
  poster: '/about/v3/about-fabric-poster-mobile.jpg',
  webm: '/about/v3/about-fabric-mobile.webm',
  mp4: '/about/v3/about-fabric-mobile.mp4',
};

/**
 * S3 loop. No autoplay: plays only while in view and motion is allowed (or the user un-stops it).
 * Without JS or with reduced motion only the poster is shown.
 */
export function AboutFabricVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stopped, setStopped] = useState(false);
  const stoppedRef = useRef(false);
  const inViewRef = useRef(false);

  const sync = () => {
    const video = videoRef.current;
    if (!video) return;
    if (inViewRef.current && !stoppedRef.current) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (window.matchMedia('(max-width:767px)').matches) {
      video.poster = MOBILE.poster;
      const [webm, mp4] = Array.from(video.querySelectorAll('source'));
      if (webm) webm.src = MOBILE.webm;
      if (mp4) mp4.src = MOBILE.mp4;
      video.load();
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    stoppedRef.current = reduce;
    setStopped(reduce);

    const io = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = Boolean(entry?.isIntersecting);
        sync();
      },
      { threshold: 0.25 },
    );
    io.observe(video);
    return () => {
      io.disconnect();
      video.pause();
    };
  }, []);

  const toggle = () => {
    const next = !stoppedRef.current;
    stoppedRef.current = next;
    setStopped(next);
    sync();
  };

  return (
    <>
      <figure>
        <div
          className="av3-fabric-media"
          role="img"
          aria-label="تصویرسازی: نمای نزدیک پارچه‌های لینن سبز و کرم"
        >
          <div className="av3-parallax" style={{ position: 'absolute', inset: 0 }}>
          <video
            ref={videoRef}
            muted
            playsInline
            loop
            preload="none"
            aria-hidden="true"
            poster={DESKTOP.poster}
            data-about-video=""
          >
            <source src={DESKTOP.webm} type="video/webm" />
            <source src={DESKTOP.mp4} type="video/mp4" />
          </video>
          </div>
        </div>
        <figcaption className="av3-wrap av3-caption">
          تصویرسازی؛ دورس ۳ نخ، کتون ۴۵۰ گرم و پارچهٔ مموری لایکودوزی‌شده
        </figcaption>
      </figure>
      <div className="av3-wrap">
        <button
          type="button"
          className="av3-video-toggle"
          aria-pressed={stopped}
          onClick={toggle}
          data-about-video-toggle=""
        >
          توقف ویدیو
        </button>
      </div>
    </>
  );
}
