import { apiClient } from './api';
import { getToken } from './auth';

/** Mirrors apps/api/src/modules/upload/video-policy.ts (server enforces the same limits). */
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const VIDEO_MAX_SEC = 60;
export const VIDEO_MIN_SORT_ORDER = 2;
export const VIDEO_POLL_MS = 5_000;
export const VIDEO_UPLOAD_MAX_RESTARTS = 3;

/** UI-SPEC §1 copy, verbatim. */
export const VIDEO_MESSAGES = {
  BAD_TYPE: 'فرمت پشتیبانی نمی‌شود. فقط MP4، MOV یا WebM.',
  TOO_BIG: 'حجم فایل بیش از ۲۰۰ مگابایت است.',
  TOO_LONG: 'ویدیو بیش از ۶۰ ثانیه است. کوتاه‌ترش کنید.',
  PROCESSING_FAILED: 'پردازش ناموفق بود. دوباره تلاش کنید یا فایل دیگری بفرستید.',
  CONNECTION_LOST: 'اتصال قطع شد. آپلود از سر گرفته می‌شود.',
  DISK_LOW: 'فضای سرور کافی نیست.',
  PREPARING: 'در حال آماده‌سازی ویدیو… می‌توانید صفحه را ترک کنید',
  DELETE_CONFIRM: 'ویدیو و پوسترش حذف شود؟',
  UPLOAD_FAILED: 'آپلود ویدیو ناموفق بود. دوباره تلاش کنید.',
} as const;

export type ProductVideoStatus = 'uploading' | 'queued' | 'processing' | 'ready' | 'failed';

export interface AdminProductVideo {
  id: string;
  product_id: string;
  status: ProductVideoStatus | null;
  error_code: string | null;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  bytes_out: string | number | null;
  mp4_720: string | null;
  mp4_480: string | null;
  webm_720: string | null;
  poster_candidates: string[];
  poster: string | null;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface VideoUploadAccepted {
  id: string;
  product_id: string;
  status: ProductVideoStatus;
  sort_order: number;
}

export function isVideoProcessing(status: ProductVideoStatus | null | undefined): boolean {
  return status === 'queued' || status === 'processing' || status === 'uploading';
}

export function videoErrorMessage(code: string | null | undefined): string {
  if (code === 'TOO_LONG') return VIDEO_MESSAGES.TOO_LONG;
  if (code === 'DISK_LOW') return VIDEO_MESSAGES.DISK_LOW;
  return VIDEO_MESSAGES.PROCESSING_FAILED;
}

const TYPE_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

export const VIDEO_ACCEPT = '.mp4,.mov,.webm,video/mp4,video/quicktime,video/webm';

/**
 * Type (extension + MIME) and size check before any byte is sent. Returns the file to upload
 * (re-typed when the OS reported no MIME) or the Persian rejection message.
 */
export function validateVideoFile(file: File): { file: File } | { error: string } {
  const ext = /\.([^.]+)$/.exec(file.name.toLowerCase())?.[1] ?? '';
  const expected = TYPE_BY_EXT[ext];
  const mime = (file.type || '').toLowerCase();
  if (!expected || (mime && mime !== expected)) return { error: VIDEO_MESSAGES.BAD_TYPE };
  if (file.size > VIDEO_MAX_BYTES) return { error: VIDEO_MESSAGES.TOO_BIG };
  if (mime) return { file };
  return { file: new File([file], file.name, { type: expected, lastModified: file.lastModified }) };
}

/** Reads duration from metadata only. Resolves null when the browser cannot decode the container. */
export function probeVideoDuration(file: File, timeoutMs = 10_000): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        /* detached element */
      }
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const d = Number(video.duration);
      finish(Number.isFinite(d) && d > 0 ? d : null);
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

export function getProductVideo(productId: string): Promise<AdminProductVideo | null> {
  return apiClient
    .get<AdminProductVideo | null>(`/products/${productId}/video`)
    .then((row) => (row && typeof row === 'object' && 'id' in row ? row : null));
}

export function retryProductVideo(productId: string) {
  return apiClient.post<{ id: string; status: ProductVideoStatus; error_code: null }>(
    `/products/${productId}/video/retry`,
    {},
  );
}

export function deleteProductVideo(productId: string) {
  return apiClient.delete<{ deleted: boolean }>(`/products/${productId}/video`);
}

export function selectProductVideoPoster(productId: string, body: { key: string } | { url: string }) {
  return apiClient.patch<{ poster: string }>(`/products/${productId}/video/poster`, body);
}

export function setProductVideoOrder(productId: string, sortOrder: number) {
  return apiClient.patch<{ sort_order: number }>(`/products/${productId}/video/order`, {
    sort_order: sortOrder,
  });
}

export class VideoUploadError extends Error {
  constructor(
    message: string,
    readonly kind: 'abort' | 'network' | 'http',
    readonly status = 0,
  ) {
    super(message);
    this.name = 'VideoUploadError';
  }
}

function apiBaseUrl(): string {
  return apiClient['baseUrl'];
}

/** Single XHR attempt (fetch has no upload progress). */
export function uploadProductVideoOnce(
  productId: string,
  file: File,
  opts: { onProgress?: (pct: number) => void; signal?: AbortSignal } = {},
): Promise<VideoUploadAccepted> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new VideoUploadError('aborted', 'abort'));
      return;
    }
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    const cleanup = () => opts.signal?.removeEventListener('abort', onAbort);

    xhr.open('POST', `${apiBaseUrl()}/upload/video?productId=${encodeURIComponent(productId)}`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        opts.onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () => {
      cleanup();
      let data: (Partial<VideoUploadAccepted> & { message?: string | string[] }) | null = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.id) {
        opts.onProgress?.(100);
        resolve(data as VideoUploadAccepted);
        return;
      }
      const raw =
        data?.message ??
        (xhr.status === 413
          ? VIDEO_MESSAGES.TOO_BIG
          : xhr.status === 502 || xhr.status === 503 || xhr.status === 504
            ? 'سرور در حال به‌روزرسانی است؛ چند ثانیه بعد دوباره تلاش کنید.'
            : VIDEO_MESSAGES.UPLOAD_FAILED);
      reject(new VideoUploadError(Array.isArray(raw) ? raw[0] : raw, 'http', xhr.status));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new VideoUploadError(VIDEO_MESSAGES.CONNECTION_LOST, 'network'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new VideoUploadError('aborted', 'abort'));
    };
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

function waitForOnline(signal?: AbortSignal): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.onLine) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => {
      window.removeEventListener('online', done);
      signal?.removeEventListener('abort', aborted);
      resolve();
    };
    const aborted = () => {
      window.removeEventListener('online', done);
      reject(new VideoUploadError('aborted', 'abort'));
    };
    window.addEventListener('online', done);
    signal?.addEventListener('abort', aborted, { once: true });
  });
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', aborted);
      resolve();
    }, ms);
    const aborted = () => {
      clearTimeout(timer);
      reject(new VideoUploadError('aborted', 'abort'));
    };
    signal?.addEventListener('abort', aborted, { once: true });
  });
}

/**
 * The API has no resumable protocol, so "resume" after a network drop means restarting the
 * upload from byte 0 once the browser is online again (backoff 1s/2s/4s, max 3 restarts).
 */
export async function uploadProductVideo(
  productId: string,
  file: File,
  opts: {
    onProgress?: (pct: number) => void;
    onReconnecting?: (attempt: number) => void;
    signal?: AbortSignal;
    backoffMs?: number;
  } = {},
): Promise<VideoUploadAccepted> {
  const backoff = opts.backoffMs ?? 1_000;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await uploadProductVideoOnce(productId, file, opts);
    } catch (error) {
      const retryable = error instanceof VideoUploadError && error.kind === 'network';
      if (!retryable || attempt >= VIDEO_UPLOAD_MAX_RESTARTS) throw error;
      opts.onReconnecting?.(attempt + 1);
      await waitForOnline(opts.signal);
      await sleep(backoff * 2 ** attempt, opts.signal);
    }
  }
}

/** Form-level video intent; applied only when the product form is saved (UI-SPEC: soft delete). */
export interface ProductVideoDraft {
  exists: boolean;
  pendingDelete: boolean;
  sortOrder: number | null;
  initialSortOrder: number | null;
  posterMissing: boolean;
  uploading: boolean;
}

export const EMPTY_VIDEO_DRAFT: ProductVideoDraft = {
  exists: false,
  pendingDelete: false,
  sortOrder: null,
  initialSortOrder: null,
  posterMissing: false,
  uploading: false,
};

export async function commitProductVideoDraft(
  productId: string,
  draft: ProductVideoDraft,
): Promise<void> {
  if (!draft.exists) return;
  if (draft.pendingDelete) {
    await deleteProductVideo(productId);
    return;
  }
  if (draft.sortOrder != null && draft.sortOrder !== draft.initialSortOrder) {
    await setProductVideoOrder(productId, draft.sortOrder);
  }
}

export function formatVideoDuration(sec: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toLocaleString('fa-IR')}:${s.toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}`;
}

export function formatVideoMegabytes(bytes: string | number | null | undefined): string | null {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${(n / (1024 * 1024)).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت`;
}
