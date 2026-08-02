'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

interface Comment {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
}

export function BlogComments({
  articleId,
  enabled = true,
  tone = 'wholesale',
}: {
  articleId: string;
  enabled?: boolean;
  tone?: 'wholesale' | 'retail';
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const card =
    tone === 'retail'
      ? 'rounded-2xl border border-stone-200 bg-white p-6'
      : 'card p-6';
  const input =
    tone === 'retail'
      ? 'w-full rounded-lg border border-stone-200 px-3 py-2 text-sm'
      : 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm';

  const load = async () => {
    try {
      const res = await fetch(`${API_URL}/blog/article/${articleId}/comments`, {
        next: { revalidate: 0 },
      });
      if (!res.ok) return;
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } catch {
      setComments([]);
    }
  };

  useEffect(() => {
    if (enabled) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, enabled]);

  if (!enabled) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !content.trim()) return;
    setSending(true);
    setMsg('');
    try {
      const res = await fetch(`${API_URL}/blog/article/${articleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, content, website }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'ارسال نظر ناموفق بود');
      }
      setContent('');
      setWebsite('');
      setMsg('نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود.');
      await load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'خطا در ارسال نظر');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={`mt-10 ${card}`}>
      <h2 className="mb-4 text-base font-bold">نظرات</h2>
      <div className="mb-6 space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500">هنوز نظری ثبت نشده است.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-gray-100 p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-400">
                <span className="font-semibold text-gray-700">{c.name}</span>
                <span>{new Date(c.createdAt).toLocaleDateString('fa-IR')}</span>
              </div>
              <p className="text-sm leading-relaxed text-gray-600">{c.content}</p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={input} placeholder="نام *" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className={input} type="email" placeholder="ایمیل *" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {/* honeypot */}
        <input
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          aria-hidden
        />
        <textarea
          className={input}
          rows={3}
          placeholder="نظر شما *"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={sending}
          className={
            tone === 'retail'
              ? 'rounded-xl bg-[#4a2c1a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
              : 'btn btn-primary btn-sm'
          }
        >
          {sending ? 'در حال ارسال…' : 'ارسال نظر'}
        </button>
        {msg && <p className="text-xs text-gray-500">{msg}</p>}
      </form>
    </section>
  );
}
