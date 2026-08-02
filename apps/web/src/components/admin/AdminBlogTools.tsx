'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Link2, Unlink } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { AdminChannel } from './AdminChannelTabs';

interface MediaItem {
  id: string;
  publicUrl: string;
  altText?: string;
  originalFileName: string;
  duplicate?: boolean;
}

interface Orphan {
  id: string;
  title: string;
  slug: string;
}

export function AdminBlogTools({ channel }: { channel: AdminChannel }) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [orphans, setOrphans] = useState<Orphan[]>([]);
  const [linkQ, setLinkQ] = useState('');
  const [linkHits, setLinkHits] = useState<Array<{ title: string; slug: string; url: string; suggestedAnchor: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [altText, setAltText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMedia = useCallback(async () => {
    try {
      const res = await apiClient.get<{ items?: MediaItem[] } | MediaItem[]>(
        `/blog/admin/media?channel=${channel}&limit=24`,
      );
      const items = Array.isArray(res) ? res : Array.isArray((res as any)?.items) ? (res as any).items : [];
      setMedia(items);
    } catch {
      setMedia([]);
    }
  }, [channel]);

  const loadOrphans = useCallback(async () => {
    try {
      const list = await apiClient.get<Orphan[]>(`/blog/admin/orphans?channel=${channel}`);
      setOrphans(Array.isArray(list) ? list : []);
    } catch {
      setOrphans([]);
    }
  }, [channel]);

  useEffect(() => {
    loadMedia();
    loadOrphans();
  }, [loadMedia, loadOrphans]);

  const uploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await apiClient.uploadImage(file);
      await apiClient.post('/blog/admin/media/register', {
        channel,
        originalFileName: file.name,
        url: uploaded.url,
        key: uploaded.key,
        mimeType: file.type || 'image/jpeg',
        extension: file.name.split('.').pop() || 'jpg',
        fileSize: file.size,
        altText: altText || file.name,
      });
      setAltText('');
      await loadMedia();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'آپلود ناموفق');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const searchLinks = async (q: string) => {
    setLinkQ(q);
    if (q.trim().length < 2) {
      setLinkHits([]);
      return;
    }
    try {
      const hits = await apiClient.post<Array<{ title: string; slug: string; url: string; suggestedAnchor: string }>>(
        '/blog/admin/internal-links/suggest',
        { channel, q, limit: 8 },
      );
      setLinkHits(Array.isArray(hits) ? hits : []);
    } catch {
      setLinkHits([]);
    }
  };

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
          <ImagePlus className="h-4 w-4" />
          کتابخانه رسانه
        </h3>
        <input
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder="متن جایگزین (alt) قبل از آپلود"
          className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
        />
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={uploadMedia} />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="btn btn-outline btn-sm mb-3 inline-flex items-center gap-1"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          آپلود تصویر
        </button>
        <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto">
          {media.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.altText || m.originalFileName}
              className="aspect-square overflow-hidden rounded-lg border border-gray-100"
              onClick={() => {
                void navigator.clipboard.writeText(m.publicUrl);
                alert('آدرس تصویر کپی شد');
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.publicUrl} alt={m.altText || ''} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
          <Link2 className="h-4 w-4" />
          لینک داخلی پیشنهادی
        </h3>
        <input
          value={linkQ}
          onChange={(e) => searchLinks(e.target.value)}
          placeholder="جست‌وجوی مطلب برای لینک…"
          className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
        />
        <div className="max-h-52 space-y-1 overflow-y-auto">
          {linkHits.map((h) => (
            <button
              key={h.slug}
              type="button"
              className="flex w-full flex-col rounded-lg border border-gray-50 px-2 py-1.5 text-right text-xs hover:bg-gray-50"
              onClick={() => {
                void navigator.clipboard.writeText(h.url);
                alert(`لینک کپی شد: ${h.suggestedAnchor}`);
              }}
            >
              <span className="font-medium">{h.title}</span>
              <span className="font-mono text-[10px] text-gray-400" dir="ltr">
                {h.url}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
          <Unlink className="h-4 w-4" />
          مقالات یتیم (بدون لینک ورودی)
        </h3>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {orphans.length === 0 ? (
            <p className="text-xs text-gray-400">مقاله یتیمی یافت نشد.</p>
          ) : (
            orphans.slice(0, 20).map((o) => (
              <div key={o.id} className="rounded-lg border border-amber-50 bg-amber-50/40 px-2 py-1.5 text-xs">
                <p className="font-medium text-gray-800">{o.title}</p>
                <p className="font-mono text-[10px] text-gray-400" dir="ltr">
                  /blog/{o.slug}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
