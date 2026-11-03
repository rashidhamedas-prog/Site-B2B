'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Film,
  ImagePlus,
  Loader2,
  Lock,
  RotateCcw,
  Trash2,
  Undo2,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { cn } from '@/lib/cn';
import {
  VIDEO_ACCEPT,
  VIDEO_MAX_SEC,
  VIDEO_MESSAGES,
  VIDEO_MAX_SORT_ORDER,
  VIDEO_MIN_SORT_ORDER,
  VIDEO_POLL_MS,
  VideoUploadError,
  formatVideoDuration,
  formatVideoMegabytes,
  getProductVideo,
  isVideoProcessing,
  probeVideoDuration,
  retryProductVideo,
  selectProductVideoPoster,
  uploadProductVideo,
  validateVideoFile,
  videoErrorMessage,
  type AdminProductVideo,
  type ProductVideoDraft,
} from '@/lib/admin-product-video';
import { VideoConfirmDialog } from './product-video/VideoConfirmDialog';

type UploadState = { pct: number; reconnecting: boolean };

const POSTER_LABELS = ['فریم ۱۰٪', 'فریم ۵۰٪', 'فریم ۹۰٪'];

function faNum(n: number): string {
  return n.toLocaleString('fa-IR');
}

export function ProductVideoCard({
  productId,
  images,
  onDraftChange,
}: {
  productId: string;
  images: string[];
  onDraftChange: (draft: ProductVideoDraft) => void;
}) {
  const [video, setVideo] = useState<AdminProductVideo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<number>(VIDEO_MIN_SORT_ORDER);
  const [initialSortOrder, setInitialSortOrder] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<'retry' | 'poster' | null>(null);
  const [draggingVideo, setDraggingVideo] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const focusUploadRef = useRef(false);
  const posterRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { upload: uploadImage } = useImageUpload();

  const maxOrder = Math.min(VIDEO_MAX_SORT_ORDER, Math.max(VIDEO_MIN_SORT_ORDER, images.length + 1));
  const effectiveOrder = Math.min(Math.max(sortOrder, VIDEO_MIN_SORT_ORDER), maxOrder);
  const status = video?.status ?? null;
  const processing = !!video && isVideoProcessing(status) && !pendingDelete;
  const posterMissing = !!video && status === 'ready' && !video.poster;

  useEffect(() => {
    let cancelled = false;
    getProductVideo(productId)
      .then((row) => {
        if (cancelled) return;
        setVideo(row);
        const order = row?.sort_order ?? VIDEO_MIN_SORT_ORDER;
        setSortOrder(order);
        setInitialSortOrder(row ? order : null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    onDraftChange({
      exists: !!video,
      pendingDelete: !!video && pendingDelete,
      sortOrder: video ? effectiveOrder : null,
      initialSortOrder: video ? initialSortOrder : null,
      posterMissing: posterMissing && !pendingDelete,
      uploading: !!upload || checking,
    });
  }, [video, pendingDelete, effectiveOrder, initialSortOrder, posterMissing, upload, checking, onDraftChange]);

  useEffect(() => {
    if (!processing) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (!cancelled && !document.hidden) timer = setTimeout(tick, VIDEO_POLL_MS);
    };
    const tick = async () => {
      try {
        const next = await getProductVideo(productId);
        if (!cancelled) setVideo(next);
      } catch {
        /* keep the last known state; next tick retries */
      }
      schedule();
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [processing, productId]);

  useEffect(() => {
    if (focusUploadRef.current && uploadButtonRef.current) {
      focusUploadRef.current = false;
      uploadButtonRef.current.focus();
    }
  });

  const startUpload = useCallback(
    async (raw: File | undefined | null) => {
      if (!raw || upload || abortRef.current) return;
      setError(null);
      setNotice(null);
      const checked = validateVideoFile(raw);
      if ('error' in checked) {
        setError(checked.error);
        return;
      }
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setChecking(true);
      const duration = await probeVideoDuration(checked.file, { signal: ctrl.signal });
      setChecking(false);
      if (ctrl.signal.aborted) {
        if (abortRef.current === ctrl) abortRef.current = null;
        setNotice('آپلود لغو شد.');
        return;
      }
      if (duration != null && duration > VIDEO_MAX_SEC) {
        abortRef.current = null;
        setError(VIDEO_MESSAGES.TOO_LONG);
        return;
      }
      setUpload({ pct: 0, reconnecting: false });
      try {
        const accepted = await uploadProductVideo(productId, checked.file, {
          signal: ctrl.signal,
          onProgress: (pct) => setUpload((u) => (u ? { pct, reconnecting: false } : u)),
          onReconnecting: () => setUpload((u) => (u ? { pct: 0, reconnecting: true } : u)),
        });
        if (ctrl.signal.aborted) return;
        setPendingDelete(false);
        setVideo({
          id: accepted.id,
          product_id: accepted.product_id,
          status: accepted.status,
          error_code: null,
          duration_sec: null,
          width: null,
          height: null,
          bytes_out: null,
          mp4_720: null,
          mp4_480: null,
          webm_720: null,
          poster_candidates: [],
          poster: null,
          sort_order: accepted.sort_order,
        });
        const order = accepted.sort_order ?? VIDEO_MIN_SORT_ORDER;
        setSortOrder(order);
        setInitialSortOrder(order);
      } catch (e) {
        if (e instanceof VideoUploadError && e.kind === 'abort') {
          setNotice('آپلود لغو شد.');
        } else if (e instanceof VideoUploadError && e.kind === 'network') {
          setError(VIDEO_MESSAGES.UPLOAD_FAILED);
        } else {
          setError(e instanceof Error ? e.message : VIDEO_MESSAGES.UPLOAD_FAILED);
        }
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
        setUpload(null);
      }
    },
    [productId, upload],
  );

  const cancelUpload = () => abortRef.current?.abort();

  const retry = async () => {
    setError(null);
    setBusy('retry');
    try {
      await retryProductVideo(productId);
      setVideo((v) => (v ? { ...v, status: 'queued', error_code: null } : v));
    } catch (e) {
      setError(e instanceof Error ? e.message : VIDEO_MESSAGES.PROCESSING_FAILED);
    } finally {
      setBusy(null);
    }
  };

  const choosePoster = async (body: { key: string } | { url: string }) => {
    if (busy === 'poster') return;
    setError(null);
    setBusy('poster');
    try {
      const res = await selectProductVideoPoster(productId, body);
      setVideo((v) => (v ? { ...v, poster: res.poster } : v));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت پوستر ناموفق بود.');
    } finally {
      setBusy(null);
    }
  };

  const onCustomPoster = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setBusy('poster');
    try {
      const url = await uploadImage(file);
      setBusy(null);
      await choosePoster({ url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'آپلود پوستر ناموفق بود.');
      setBusy(null);
    }
  };

  const confirmDelete = () => {
    setConfirmOpen(false);
    setPendingDelete(true);
    focusUploadRef.current = true;
  };

  const candidates = video?.poster_candidates ?? [];
  const customPoster = video?.poster && !candidates.includes(video.poster) ? video.poster : null;
  const posterOptions = useMemo(() => {
    const list = candidates.map((url, i) => ({
      url,
      label: candidates.length === 3 ? POSTER_LABELS[i] : `فریم ${faNum(i + 1)}`,
      custom: false,
    }));
    if (customPoster) list.push({ url: customPoster, label: 'تصویر دلخواه', custom: true });
    return list;
  }, [candidates, customPoster]);
  const selectedPosterIndex = posterOptions.findIndex((o) => o.url === video?.poster);

  const onPosterKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = e.key === 'ArrowLeft' || e.key === 'ArrowDown';
    const back = e.key === 'ArrowRight' || e.key === 'ArrowUp';
    if (!forward && !back) return;
    e.preventDefault();
    const next = (index + (forward ? 1 : -1) + posterOptions.length) % posterOptions.length;
    posterRefs.current[next]?.focus();
    const option = posterOptions[next];
    if (option && option.url !== video?.poster && !option.custom) void choosePoster({ key: option.url });
  };

  const showUploadZone = loaded && !upload && (!video || pendingDelete || status === 'failed');

  const statusView = (() => {
    if (upload) {
      return upload.reconnecting
        ? { icon: <WifiOff className="h-4 w-4" aria-hidden />, label: 'اتصال قطع شد', text: VIDEO_MESSAGES.CONNECTION_LOST, tone: 'warn' as const }
        : { icon: <Upload className="h-4 w-4" aria-hidden />, label: 'در حال آپلود', text: 'فایل در حال ارسال است.', tone: 'info' as const };
    }
    if (checking) {
      return { icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden />, label: 'بررسی فایل', text: 'در حال بررسی مدت ویدیو…', tone: 'info' as const };
    }
    if (!video) return null;
    if (pendingDelete) {
      return { icon: <Trash2 className="h-4 w-4" aria-hidden />, label: 'در انتظار حذف', text: 'ویدیو با ذخیره‌ی فرم حذف می‌شود.', tone: 'danger' as const };
    }
    if (status === 'queued' || status === 'uploading') {
      return { icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden />, label: 'در صف پردازش', text: VIDEO_MESSAGES.PREPARING, tone: 'info' as const };
    }
    if (status === 'processing') {
      return { icon: <Loader2 className="h-4 w-4 animate-spin" aria-hidden />, label: 'در حال پردازش', text: VIDEO_MESSAGES.PREPARING, tone: 'info' as const };
    }
    if (status === 'ready') {
      return { icon: <CheckCircle2 className="h-4 w-4" aria-hidden />, label: 'آماده', text: posterMissing ? 'پوستر انتخاب نشده؛ بدون پوستر ویدیو منتشر نمی‌شود.' : 'ویدیو آماده‌ی نمایش است.', tone: posterMissing ? ('warn' as const) : ('ok' as const) };
    }
    if (status === 'failed') {
      return { icon: <AlertTriangle className="h-4 w-4" aria-hidden />, label: 'خطا', text: videoErrorMessage(video.error_code), tone: 'danger' as const };
    }
    return null;
  })();

  const toneClass = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
  };

  const mediaSlots = useMemo(() => {
    const slots: Array<{ kind: 'image'; url: string } | { kind: 'placeholder' } | { kind: 'video' }> = [
      images[0] ? { kind: 'image' as const, url: images[0] } : { kind: 'placeholder' as const },
      ...images.slice(1).map((url) => ({ kind: 'image' as const, url })),
    ];
    slots.splice(Math.min(effectiveOrder - 1, slots.length), 0, { kind: 'video' });
    return slots;
  }, [images, effectiveOrder]);

  const moveVideo = (to: number) => {
    setSortOrder(Math.min(Math.max(to, VIDEO_MIN_SORT_ORDER), maxOrder));
  };

  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1';
  const mp4 = video?.mp4_480 || video?.mp4_720;
  const sizeLabel = formatVideoMegabytes(video?.bytes_out);

  return (
    <section
      aria-labelledby="product-video-heading"
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
      data-testid="product-video-card"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 id="product-video-heading" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <Film className="h-4 w-4" aria-hidden />
          ویدیوی محصول
        </h4>
        <span className="text-[11px] text-gray-500">حداکثر ۱ ویدیو · MP4، MOV یا WebM · ۲۰۰ مگابایت · ۶۰ ثانیه</span>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" data-testid="product-video-status" className="space-y-2">
        {statusView ? (
          <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', toneClass[statusView.tone])}>
            <span className="mt-0.5 shrink-0">{statusView.icon}</span>
            <p>
              <strong className="font-semibold">{statusView.label}</strong>
              {' — '}
              <span className={cn(pendingDelete && video && 'line-through decoration-1')}>{statusView.text}</span>
            </p>
          </div>
        ) : null}
        {error ? (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        ) : null}
        {notice ? <p className="text-xs text-gray-600">{notice}</p> : null}
      </div>

      {checking && !upload ? (
        <button type="button" onClick={cancelUpload} className={cn('btn btn-outline btn-sm inline-flex items-center gap-1', focusRing)}>
          <X className="h-3.5 w-3.5" aria-hidden />
          لغو
        </button>
      ) : null}

      {upload ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-600" data-testid="product-video-progress-text">
            {faNum(upload.pct)}٪
          </p>
          <div
            role="progressbar"
            aria-label="پیشرفت آپلود ویدیو"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={upload.pct}
            aria-valuetext={`${faNum(upload.pct)}٪`}
            className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
          >
            <div className="bg-primary h-full transition-[width] duration-200" style={{ width: `${upload.pct}%` }} />
          </div>
          <button type="button" onClick={cancelUpload} className={cn('btn btn-outline btn-sm inline-flex items-center gap-1', focusRing)}>
            <X className="h-3.5 w-3.5" aria-hidden />
            لغو
          </button>
        </div>
      ) : null}

      {video && !pendingDelete && status === 'ready' ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,16rem)_1fr]">
          <video
            muted
            controls
            playsInline
            preload="metadata"
            poster={video.poster ?? undefined}
            className="aspect-[4/5] w-full rounded-lg bg-black object-cover"
            aria-label="پیش‌نمایش ویدیوی محصول"
          >
            {video.webm_720 ? <source src={video.webm_720} type="video/webm" /> : null}
            {mp4 ? <source src={mp4} type="video/mp4" /> : null}
          </video>
          <dl className="space-y-1 text-xs text-gray-600">
            <div className="flex gap-1">
              <dt>مدت:</dt>
              <dd data-testid="product-video-duration">{formatVideoDuration(video.duration_sec)}</dd>
            </div>
            {sizeLabel ? (
              <div className="flex gap-1">
                <dt>حجم خروجی:</dt>
                <dd data-testid="product-video-size">{sizeLabel}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {video && !pendingDelete && status === 'ready' ? (
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-gray-700">پوستر ویدیو (الزامی)</legend>
          <div
            role="radiogroup"
            aria-label="انتخاب پوستر ویدیو"
            aria-busy={busy === 'poster'}
            className="flex flex-wrap gap-2"
          >
            {posterOptions.map((option, i) => {
              const checked = option.url === video.poster;
              const tabbable = selectedPosterIndex >= 0 ? i === selectedPosterIndex : i === 0;
              return (
                <button
                  key={option.url}
                  ref={(el) => {
                    posterRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={option.label}
                  tabIndex={tabbable ? 0 : -1}
                  onClick={() => {
                    if (!checked && !option.custom) void choosePoster({ key: option.url });
                  }}
                  onKeyDown={(e) => onPosterKeyDown(e, i)}
                  className={cn(
                    'relative w-20 overflow-hidden rounded-lg border-2 text-[10px] text-gray-700',
                    checked ? 'border-primary' : 'border-gray-200 hover:border-gray-400',
                    focusRing,
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={option.url} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                  <span className="flex items-center justify-center gap-0.5 py-0.5">
                    {checked ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : null}
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              if (busy !== 'poster') posterInputRef.current?.click();
            }}
            aria-disabled={busy === 'poster'}
            className={cn('btn btn-outline btn-sm inline-flex items-center gap-1 text-xs', focusRing)}
          >
            {busy === 'poster' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden />}
            آپلود تصویر دلخواه
          </button>
          <input ref={posterInputRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden onChange={onCustomPoster} />
        </fieldset>
      ) : null}

      {video && !pendingDelete && !upload ? (
        <div className="flex flex-wrap gap-2">
          {status === 'failed' && video.error_code !== 'TOO_LONG' ? (
            <button
              type="button"
              onClick={retry}
              disabled={busy === 'retry'}
              className={cn('btn btn-outline btn-sm inline-flex items-center gap-1', focusRing)}
            >
              <RotateCcw className={cn('h-3.5 w-3.5', busy === 'retry' && 'animate-spin')} aria-hidden />
              تلاش مجدد
            </button>
          ) : null}
          <button
            ref={deleteButtonRef}
            type="button"
            onClick={() => setConfirmOpen(true)}
            className={cn('btn btn-sm inline-flex items-center gap-1 border border-red-300 bg-white text-red-700 hover:bg-red-50', focusRing)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            حذف
          </button>
        </div>
      ) : null}

      {video && pendingDelete ? (
        <button type="button" onClick={() => setPendingDelete(false)} className={cn('btn btn-outline btn-sm inline-flex items-center gap-1', focusRing)}>
          <Undo2 className="h-3.5 w-3.5" aria-hidden />
          بازگردانی
        </button>
      ) : null}

      {showUploadZone ? (
        <div
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (!e.dataTransfer.files?.length) return;
            e.preventDefault();
            setDragOver(false);
            void startUpload(e.dataTransfer.files[0]);
          }}
          data-testid="product-video-dropzone"
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center text-xs text-gray-600',
            dragOver ? 'border-primary bg-primary/5' : 'border-gray-300',
          )}
        >
          <p>ویدیو را اینجا رها کنید یا از دکمه‌ی زیر انتخاب کنید.</p>
          <button
            ref={uploadButtonRef}
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={checking}
            className={cn('btn btn-primary btn-sm inline-flex items-center gap-1', focusRing)}
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            {video && status === 'failed' && !pendingDelete ? 'آپلود فایل دیگر' : 'آپلود ویدیو'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={VIDEO_ACCEPT}
            className="hidden"
            tabIndex={-1}
            aria-hidden
            data-testid="product-video-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void startUpload(file);
            }}
          />
        </div>
      ) : null}

      {video && !pendingDelete ? (
        <div className="space-y-2">
          <p id="product-video-order-label" className="text-xs font-semibold text-gray-700">
            جایگاه در گالری: {faNum(effectiveOrder)}
          </p>
          <ol aria-labelledby="product-video-order-label" className="flex flex-wrap gap-2" data-testid="product-media-order">
            {mediaSlots.map((slot, i) => {
              const position = i + 1;
              const dropTarget = position >= VIDEO_MIN_SORT_ORDER;
              const dropHandlers =
                dropTarget && draggingVideo
                  ? {
                      onDragOver: (e: React.DragEvent) => e.preventDefault(),
                      onDrop: (e: React.DragEvent) => {
                        e.preventDefault();
                        setDraggingVideo(false);
                        moveVideo(position);
                      },
                    }
                  : {};
              if (slot.kind === 'video') {
                return (
                  <li
                    key="video"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', 'product-video');
                      setDraggingVideo(true);
                    }}
                    onDragEnd={() => setDraggingVideo(false)}
                    {...dropHandlers}
                    className="border-primary bg-primary/5 flex w-28 cursor-grab flex-col items-center gap-1 rounded-lg border-2 p-1.5 text-[10px] text-gray-800"
                    data-testid="product-media-video-slot"
                  >
                    <span className="flex items-center gap-1">
                      <Film className="h-3.5 w-3.5" aria-hidden />
                      ویدیو · جایگاه {faNum(position)}
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        aria-label="انتقال ویدیو به جایگاه قبلی"
                        disabled={effectiveOrder <= VIDEO_MIN_SORT_ORDER}
                        onClick={() => moveVideo(effectiveOrder - 1)}
                        className={cn('rounded border border-gray-300 bg-white p-1 disabled:opacity-40', focusRing)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="انتقال ویدیو به جایگاه بعدی"
                        disabled={effectiveOrder >= maxOrder}
                        onClick={() => moveVideo(effectiveOrder + 1)}
                        className={cn('rounded border border-gray-300 bg-white p-1 disabled:opacity-40', focusRing)}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </span>
                  </li>
                );
              }
              if (slot.kind === 'placeholder') {
                return (
                  <li
                    key="first-image-placeholder"
                    className="flex w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-gray-300 p-1 text-center text-[10px] text-gray-500"
                    aria-label="تصویر اول — جایگاه اول، قفل (همیشه تصویر)"
                    data-testid="product-media-first-placeholder"
                  >
                    <Lock className="h-3 w-3" aria-hidden />
                    تصویر اول
                  </li>
                );
              }
              const locked = position === 1;
              return (
                <li
                  key={slot.url}
                  {...dropHandlers}
                  className="relative flex w-16 flex-col items-center gap-0.5 rounded-lg border border-gray-200 p-1 text-[10px] text-gray-600"
                  aria-label={locked ? 'تصویر ۱ — جایگاه اول، قفل (همیشه تصویر)' : `تصویر · جایگاه ${faNum(position)}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slot.url} alt="" loading="lazy" className="aspect-square w-full rounded object-cover" />
                  <span className="flex items-center gap-0.5">
                    {locked ? <Lock className="h-3 w-3" aria-hidden /> : null}
                    {faNum(position)}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="text-[11px] text-gray-500">
            جایگاه اول همیشه تصویر است و قفل است. ویدیو را بکشید یا با دکمه‌های قبلی/بعدی جابه‌جا کنید؛ با ذخیره‌ی فرم ثبت می‌شود.
          </p>
        </div>
      ) : null}

      {confirmOpen ? (
        <VideoConfirmDialog
          title={VIDEO_MESSAGES.DELETE_CONFIRM}
          description="تا ذخیره‌ی فرم می‌توانید آن را بازگردانی کنید."
          confirmLabel="حذف"
          onConfirm={confirmDelete}
          onCancel={() => {
            setConfirmOpen(false);
            requestAnimationFrame(() => deleteButtonRef.current?.focus());
          }}
        />
      ) : null}
    </section>
  );
}

export default ProductVideoCard;
