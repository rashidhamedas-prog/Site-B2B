'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicProductVideo } from '@/lib/product-video-public';

function durationLabel(seconds: number): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60).toLocaleString('fa-IR');
  const remainder = String(total % 60).padStart(2, '0');
  const persianRemainder = Number(remainder).toLocaleString('fa-IR', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  return `${minutes}:${persianRemainder}`;
}

function Poster({
  video,
  className = '',
}: {
  video: PublicProductVideo;
  className?: string;
}) {
  if (!video.poster) return null;
  return (
    <img
      src={video.poster}
      alt=""
      width={Math.max(1, Number(video.width) || 3)}
      height={Math.max(1, Number(video.height) || 4)}
      loading="lazy"
      decoding="async"
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

export function ProductVideoThumbnail({
  video,
  selected,
  onActivate,
  className = '',
}: {
  video: PublicProductVideo;
  selected: boolean;
  onActivate: () => void;
  className?: string;
}) {
  if (!video.poster) return null;
  return (
    <button
      type="button"
      aria-label="پخش ویدیوی محصول"
      aria-current={selected ? 'true' : undefined}
      aria-selected={selected}
      onClick={onActivate}
      data-product-video-thumbnail=""
      className={`relative shrink-0 cursor-pointer overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-gold-700,#836A27)] ${className}`}
    >
      <Poster video={video} />
      <span
        aria-hidden
        className="absolute inset-1/2 inline-flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-xl text-white"
      >
        ▶
      </span>
      <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
        {durationLabel(video.duration_sec)}
      </span>
    </button>
  );
}

export function ProductVideoDot({
  selected,
  onActivate,
}: {
  selected: boolean;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="پخش ویدیوی محصول"
      aria-current={selected ? 'true' : undefined}
      onClick={onActivate}
      data-product-video-dot=""
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] ${
        selected ? 'bg-black text-white' : 'bg-black/20 text-black'
      }`}
    >
      ▶
    </button>
  );
}

export function ProductVideoSlide({
  video,
  active,
  playRequest,
  className = '',
}: {
  video: PublicProductVideo;
  active: boolean;
  playRequest: number;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handledRequest = useRef(0);
  const [requested, setRequested] = useState(false);
  const [mobileSource, setMobileSource] = useState(false);
  const [failed, setFailed] = useState(false);

  const requestPlay = () => {
    if (!active) return;
    setFailed(false);
    setMobileSource(window.matchMedia('(max-width: 767px)').matches);
    setRequested(true);
  };

  useEffect(() => {
    if (!active) {
      videoRef.current?.pause();
      setRequested(false);
      return;
    }
    if (playRequest > handledRequest.current) {
      handledRequest.current = playRequest;
      requestPlay();
    }
  }, [active, playRequest]);

  useEffect(() => {
    if (!active || !requested || !videoRef.current) return;
    void videoRef.current.play().catch(() => {
      // Browser policy or an unsupported source is surfaced by the media error event.
    });
  }, [active, requested, mobileSource]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) videoRef.current?.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!requested) return;
    const element = videoRef.current;
    return () => {
      element?.pause();
    };
  }, [requested]);

  if (!video.poster) return null;

  return (
    <div
      ref={frameRef}
      data-product-video-slide=""
      className={`relative h-full w-full overflow-hidden bg-black ${className}`}
    >
      {requested && active && !failed ? (
        <video
          ref={videoRef}
          controls
          playsInline
          muted
          preload="none"
          poster={video.poster}
          onError={() => {
            videoRef.current?.pause();
            setRequested(false);
            setFailed(true);
          }}
          className="h-full w-full object-cover"
          data-product-video=""
        >
          {!mobileSource && video.webm_720 ? (
            <source src={video.webm_720} type='video/webm; codecs="vp9"' />
          ) : null}
          <source
            src={mobileSource ? video.mp4_480 || video.mp4_720 : video.mp4_720}
            type="video/mp4"
          />
        </video>
      ) : (
        <>
          <Poster video={video} />
          <button
            type="button"
            aria-label="پخش ویدیوی محصول"
            onClick={requestPlay}
            className="absolute inset-0 flex cursor-pointer items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          >
            <span
              aria-hidden
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-2xl text-white shadow-lg"
            >
              ▶
            </span>
          </button>
          <span className="absolute bottom-3 left-3 rounded bg-black/75 px-2 py-1 text-xs font-bold text-white">
            {durationLabel(video.duration_sec)}
          </span>
          {failed ? (
            <p
              role="alert"
              className="absolute inset-x-3 bottom-12 rounded bg-black/80 px-3 py-2 text-center text-sm text-white"
            >
              پخش ویدیو ممکن نشد
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
