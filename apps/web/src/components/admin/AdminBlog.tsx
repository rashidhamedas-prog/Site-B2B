'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus, Edit2, Trash2, X, Save, Eye, FileText, ImagePlus, Loader2,
  Upload, Send, CheckCircle, Ban, Copy, Sparkles,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { cn } from '@/lib/cn';
import { AdminChannelTabs, channelLabel, type AdminChannel } from './AdminChannelTabs';
import { BlogEditor } from './BlogEditor';
import { AdminBlogTools } from './AdminBlogTools';

type TabId =
  | 'content'
  | 'basic'
  | 'seo'
  | 'social'
  | 'schema'
  | 'related'
  | 'publish'
  | 'history'
  | 'preview';

interface FaqItem {
  question: string;
  answer: string;
  sortOrder?: number;
  isVisible?: boolean;
  includeInSchema?: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  content: string;
  category: string;
  categoryId?: string | null;
  status: string;
  views: number;
  publishedAt?: string;
  publishAt?: string;
  createdAt: string;
  updatedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  secondaryKeywords?: string[];
  searchIntent?: string;
  canonicalType?: string;
  canonicalUrl?: string;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  robotsNoArchive?: boolean;
  robotsNoSnippet?: boolean;
  maxImagePreview?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  twitterCard?: string;
  schemaType?: string;
  breadcrumbEnabled?: boolean;
  articleSchemaEnabled?: boolean;
  faqSchemaEnabled?: boolean;
  faqItems?: FaqItem[];
  coverImage?: string;
  channel?: string;
  authorName?: string;
  wordCount?: number;
  readingTimeMinutes?: number;
  sitemapEnabled?: boolean;
  sitemapPriority?: number;
  rssEnabled?: boolean;
  isCornerstone?: boolean;
  isEvergreen?: boolean;
  tags?: string[];
}

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  categoryId: string;
  status: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  secondaryKeywords: string;
  searchIntent: string;
  canonicalType: string;
  canonicalUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  robotsNoArchive: boolean;
  robotsNoSnippet: boolean;
  maxImagePreview: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterCard: string;
  schemaType: string;
  breadcrumbEnabled: boolean;
  articleSchemaEnabled: boolean;
  faqSchemaEnabled: boolean;
  faqItems: FaqItem[];
  coverImage: string;
  authorName: string;
  publishAt: string;
  sitemapEnabled: boolean;
  sitemapPriority: number;
  rssEnabled: boolean;
  isCornerstone: boolean;
  isEvergreen: boolean;
  tags: string;
  relatedProductIds: string[];
  relatedArticleIds: string[];
  version: number;
  howToName: string;
  howToDescription: string;
  howToTotalTime: string;
  howToSteps: string;
  howToSchemaEnabled: boolean;
  commentsEnabled: boolean;
  ctaTitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaButtonUrl: string;
};

const emptyForm = (): FormState => ({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: 'عمومی',
  categoryId: '',
  status: 'DRAFT',
  seoTitle: '',
  seoDescription: '',
  focusKeyword: '',
  secondaryKeywords: '',
  searchIntent: 'INFORMATIONAL',
  canonicalType: 'SELF',
  canonicalUrl: '',
  robotsIndex: true,
  robotsFollow: true,
  robotsNoArchive: false,
  robotsNoSnippet: false,
  maxImagePreview: 'large',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  twitterTitle: '',
  twitterDescription: '',
  twitterImage: '',
  twitterCard: 'summary_large_image',
  schemaType: 'BlogPosting',
  breadcrumbEnabled: true,
  articleSchemaEnabled: true,
  faqSchemaEnabled: false,
  faqItems: [],
  coverImage: '',
  authorName: '',
  publishAt: '',
  sitemapEnabled: true,
  sitemapPriority: 0.6,
  rssEnabled: true,
  isCornerstone: false,
  isEvergreen: false,
  tags: '',
  relatedProductIds: [],
  relatedArticleIds: [],
  version: 1,
  howToName: '',
  howToDescription: '',
  howToTotalTime: '',
  howToSteps: '',
  howToSchemaEnabled: true,
  commentsEnabled: true,
  ctaTitle: '',
  ctaDescription: '',
  ctaButtonText: '',
  ctaButtonUrl: '',
});

const TABS: { id: TabId; label: string }[] = [
  { id: 'content', label: 'محتوا' },
  { id: 'basic', label: 'اطلاعات پایه' },
  { id: 'seo', label: 'سئو' },
  { id: 'social', label: 'شبکه‌های اجتماعی' },
  { id: 'schema', label: 'اسکیما و FAQ' },
  { id: 'related', label: 'مرتبط‌ها' },
  { id: 'publish', label: 'انتشار' },
  { id: 'history', label: 'تاریخچه' },
  { id: 'preview', label: 'پیش‌نمایش' },
];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  IN_REVIEW: 'بازبینی',
  NEEDS_REVISION: 'نیاز به اصلاح',
  APPROVED: 'تأیید شده',
  SCHEDULED: 'زمان‌بندی',
  PUBLISHED: 'منتشر شده',
  UNPUBLISHED: 'لغو انتشار',
  ARCHIVED: 'آرشیو',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  IN_REVIEW: 'bg-amber-100 text-amber-700',
  NEEDS_REVISION: 'bg-orange-100 text-orange-700',
  APPROVED: 'bg-sky-100 text-sky-700',
  SCHEDULED: 'bg-indigo-100 text-indigo-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  UNPUBLISHED: 'bg-slate-100 text-slate-600',
  ARCHIVED: 'bg-stone-100 text-stone-500',
};

function seoTitleLen(s: string) {
  return s.trim().length;
}

function postToForm(p: Post): FormState {
  return {
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? '',
    content: p.content,
    category: p.category,
    categoryId: p.categoryId ?? '',
    status: p.status,
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    focusKeyword: p.focusKeyword ?? '',
    secondaryKeywords: (p.secondaryKeywords || []).join(', '),
    searchIntent: p.searchIntent ?? 'INFORMATIONAL',
    canonicalType: p.canonicalType ?? 'SELF',
    canonicalUrl: p.canonicalUrl ?? '',
    robotsIndex: p.robotsIndex !== false,
    robotsFollow: p.robotsFollow !== false,
    robotsNoArchive: !!p.robotsNoArchive,
    robotsNoSnippet: !!p.robotsNoSnippet,
    maxImagePreview: p.maxImagePreview ?? 'large',
    ogTitle: p.ogTitle ?? '',
    ogDescription: p.ogDescription ?? '',
    ogImage: p.ogImage ?? '',
    twitterTitle: p.twitterTitle ?? '',
    twitterDescription: p.twitterDescription ?? '',
    twitterImage: p.twitterImage ?? '',
    twitterCard: p.twitterCard ?? 'summary_large_image',
    schemaType: p.schemaType ?? 'BlogPosting',
    breadcrumbEnabled: p.breadcrumbEnabled !== false,
    articleSchemaEnabled: p.articleSchemaEnabled !== false,
    faqSchemaEnabled: !!p.faqSchemaEnabled,
    faqItems: p.faqItems ?? [],
    coverImage: p.coverImage ?? '',
    authorName: p.authorName ?? '',
    publishAt: p.publishAt ? p.publishAt.slice(0, 16) : '',
    sitemapEnabled: p.sitemapEnabled !== false,
    sitemapPriority: p.sitemapPriority ?? 0.6,
    rssEnabled: p.rssEnabled !== false,
    isCornerstone: !!p.isCornerstone,
    isEvergreen: !!p.isEvergreen,
    tags: (p.tags || []).join(', '),
    relatedProductIds: (p as any).relatedProductIds || [],
    relatedArticleIds: (p as any).relatedArticleIds || [],
    version: (p as any).version || 1,
    howToName: (p as any).howToData?.name || '',
    howToDescription: (p as any).howToData?.description || '',
    howToTotalTime: (p as any).howToData?.totalTime || '',
    howToSteps: Array.isArray((p as any).howToData?.steps)
      ? (p as any).howToData.steps
          .map((s: { title: string; description: string }) => `${s.title}|${s.description}`)
          .join('\n')
      : '',
    howToSchemaEnabled: (p as any).howToSchemaEnabled !== false,
    commentsEnabled: (p as any).commentsEnabled !== false,
    ctaTitle: (p as any).primaryCta?.title || '',
    ctaDescription: (p as any).primaryCta?.description || '',
    ctaButtonText: (p as any).primaryCta?.buttonText || '',
    ctaButtonUrl: (p as any).primaryCta?.buttonUrl || '',
  };
}

function formToPayload(form: FormState, channel: AdminChannel) {
  return {
    channel,
    title: form.title,
    slug: form.slug || undefined,
    excerpt: form.excerpt,
    content: form.content,
    category: form.category,
    categoryId: form.categoryId || undefined,
    status: form.status,
    seoTitle: form.seoTitle || undefined,
    seoDescription: form.seoDescription || undefined,
    focusKeyword: form.focusKeyword || undefined,
    secondaryKeywords: form.secondaryKeywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    searchIntent: form.searchIntent,
    canonicalType: form.canonicalType,
    canonicalUrl: form.canonicalUrl || undefined,
    robotsIndex: form.robotsIndex,
    robotsFollow: form.robotsFollow,
    robotsNoArchive: form.robotsNoArchive,
    robotsNoSnippet: form.robotsNoSnippet,
    maxImagePreview: form.maxImagePreview,
    ogTitle: form.ogTitle || undefined,
    ogDescription: form.ogDescription || undefined,
    ogImage: form.ogImage || form.coverImage || undefined,
    twitterTitle: form.twitterTitle || undefined,
    twitterDescription: form.twitterDescription || undefined,
    twitterImage: form.twitterImage || form.ogImage || form.coverImage || undefined,
    twitterCard: form.twitterCard,
    schemaType: form.schemaType,
    breadcrumbEnabled: form.breadcrumbEnabled,
    articleSchemaEnabled: form.articleSchemaEnabled,
    faqSchemaEnabled: form.faqSchemaEnabled,
    faqItems: form.faqItems,
    coverImage: form.coverImage || undefined,
    authorName: form.authorName || undefined,
    publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : undefined,
    sitemapEnabled: form.sitemapEnabled,
    sitemapPriority: form.sitemapPriority,
    rssEnabled: form.rssEnabled,
    isCornerstone: form.isCornerstone,
    isEvergreen: form.isEvergreen,
    tags: form.tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    relatedProductIds: form.relatedProductIds,
    relatedArticleIds: form.relatedArticleIds,
    contentFormat: form.content.trim().startsWith('<') ? 'HTML' : 'MARKDOWN',
    howToSchemaEnabled: form.howToSchemaEnabled,
    commentsEnabled: form.commentsEnabled,
    howToData: form.howToName.trim()
      ? {
          name: form.howToName.trim(),
          description: form.howToDescription || undefined,
          totalTime: form.howToTotalTime || undefined,
          steps: form.howToSteps
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, i) => {
              const [title, ...rest] = line.split('|');
              return {
                title: (title || `مرحله ${i + 1}`).trim(),
                description: (rest.join('|') || title || '').trim(),
                sortOrder: i + 1,
              };
            }),
        }
      : null,
  };
}

export function AdminBlog() {
  const [channel, setChannel] = useState<AdminChannel>('WHOLESALE');
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tab, setTab] = useState<TabId>('content');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteStrategy, setDeleteStrategy] = useState('UNPUBLISH');
  const [deleteRedirect, setDeleteRedirect] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [seoScore, setSeoScore] = useState<{ score: number; status: string; warnings: { label: string; detail?: string }[]; errors: { label: string; detail?: string }[] } | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [productHits, setProductHits] = useState<Array<{ id: string; name: string; sku: string }>>([]);
  const [revisions, setRevisions] = useState<Array<{ id: string; versionNumber: number; changeSummary?: string; createdAt: string }>>([]);
  const { upload: uploadImage, uploading: uploadingCover } = useImageUpload();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ channel });
      if (statusFilter) qs.set('status', statusFilter);
      const [list, cats] = await Promise.all([
        apiClient.get<Post[]>(`/blog/admin/posts?${qs}`),
        apiClient.get<Category[]>(`/blog/admin/categories?channel=${channel}`).catch(() => []),
      ]);
      setPosts(Array.isArray(list) ? list : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [channel, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!modal || !editId) return;
    autosaveTimer.current = setInterval(async () => {
      try {
        const payload = formToPayload(form, channel);
        const saved = await apiClient.post<{ version: number }>(`/blog/admin/posts/${editId}/autosave`, {
          ...payload,
          expectedVersion: form.version,
        });
        if (saved?.version) setForm((f) => ({ ...f, version: saved.version }));
      } catch {
        /* conflict or network — ignore silent autosave */
      }
    }, 30000);
    return () => {
      if (autosaveTimer.current) clearInterval(autosaveTimer.current);
    };
  }, [modal, editId, form, channel]);

  const runSeoAnalyze = async () => {
    try {
      const result = await apiClient.post<{
        score: number;
        status: string;
        warnings: { label: string; detail?: string }[];
        errors: { label: string; detail?: string }[];
      }>('/blog/admin/seo/analyze', formToPayload(form, channel));
      setSeoScore(result);
      setTab('seo');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در تحلیل سئو');
    }
  };

  const searchProducts = async (q: string) => {
    setProductQuery(q);
    if (q.trim().length < 2) {
      setProductHits([]);
      return;
    }
    try {
      const hits = await apiClient.get<Array<{ id: string; name: string; sku: string }>>(
        `/blog/admin/products/search?q=${encodeURIComponent(q)}&channel=${channel}&limit=8`,
      );
      setProductHits(Array.isArray(hits) ? hits : []);
    } catch {
      setProductHits([]);
    }
  };

  const loadRevisions = async (id: string) => {
    try {
      const list = await apiClient.get<Array<{ id: string; versionNumber: number; changeSummary?: string; createdAt: string }>>(
        `/blog/admin/posts/${id}/revisions`,
      );
      setRevisions(Array.isArray(list) ? list : []);
    } catch {
      setRevisions([]);
    }
  };

  const openCreate = () => {
    setForm(emptyForm());
    setEditId(null);
    setTab('content');
    setModal(true);
  };

  const openEdit = (p: Post) => {
    setEditId(p.id);
    setForm(postToForm(p));
    setTab('content');
    setSeoScore(null);
    setModal(true);
    loadRevisions(p.id);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, coverImage: url }));
    } catch {
      alert('آپلود تصویر شاخص با خطا مواجه شد');
    } finally {
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    setSaving(true);
    try {
      const payload = formToPayload(form, channel);
      if (editId) await apiClient.put(`/blog/admin/posts/${editId}`, payload);
      else await apiClient.post('/blog/admin/posts', payload);
      setModal(false);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'خطا در ذخیره مطلب';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: string) => {
    try {
      await apiClient.post(`/blog/admin/posts/${id}/${action}`, {});
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در عملیات');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/blog/admin/posts/${id}`, { strategy: 'UNPUBLISH' });
      setDeleteId(null);
      await load();
    } catch {
      /* ignore */
    }
  };

  const seedCategories = async () => {
    try {
      await apiClient.post('/blog/admin/seed-categories', {});
      await load();
      alert('دسته‌های پیشنهادی ساخته شد');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      let body: Record<string, unknown>;
      const trimmed = importText.trim();
      if (trimmed.startsWith('{')) {
        body = { format: 'json', article: JSON.parse(trimmed), channel };
      } else {
        body = { format: 'markdown', markdown: trimmed, channel };
      }
      await apiClient.post('/blog/admin/import', body);
      setImportOpen(false);
      setImportText('');
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Import ناموفق');
    } finally {
      setImporting(false);
    }
  };

  const titleLen = seoTitleLen(form.seoTitle || form.title);
  const metaLen = seoTitleLen(form.seoDescription || form.excerpt);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">وبلاگ و سئو</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {posts.length.toLocaleString('fa-IR')} مطلب — {channelLabel(channel)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminChannelTabs value={channel} onChange={setChannel} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
          >
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button type="button" onClick={seedCategories} className="btn btn-outline btn-sm">
            Seed دسته
          </button>
          <button type="button" onClick={() => setImportOpen(true)} className="btn btn-outline btn-sm flex items-center gap-1">
            <Upload className="h-3.5 w-3.5" />
            Import
          </button>
          <button type="button" onClick={openCreate} className="btn btn-primary btn-md flex items-center gap-2">
            <Plus className="h-4 w-4" />
            مطلب جدید
          </button>
        </div>
      </div>

      <AdminBlogTools channel={channel} />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['عنوان', 'سایت', 'دسته', 'وضعیت', 'کلمات', 'بازدید', 'تاریخ', ''].map((h, i) => (
                  <th key={i} className="px-3 py-3 text-right text-xs font-semibold text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="skeleton h-4 w-20 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="mb-3 text-gray-400">مطلبی ثبت نشده</p>
                    <button type="button" onClick={openCreate} className="btn btn-primary btn-sm">
                      نوشتن اولین مطلب
                    </button>
                  </td>
                </tr>
              ) : (
                posts.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <p className="line-clamp-1 text-sm font-semibold text-gray-900">{p.title}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-gray-400">/{p.slug}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {p.channel === 'RETAIL' ? 'تک' : 'عمده'}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">{p.category}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                          STATUS_COLOR[p.status] || STATUS_COLOR.DRAFT,
                        )}
                      >
                        {STATUS_LABEL[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {(p.wordCount || 0).toLocaleString('fa-IR')}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {(p.views || 0).toLocaleString('fa-IR')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400">
                      {new Date(p.publishedAt ?? p.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => openEdit(p)} className="text-gray-400 hover:text-primary" title="ویرایش">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {p.status === 'DRAFT' && (
                          <button type="button" onClick={() => runAction(p.id, 'submit-review')} className="text-gray-400 hover:text-amber-600" title="ارسال بازبینی">
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        {(p.status === 'APPROVED' || p.status === 'DRAFT' || p.status === 'IN_REVIEW') && (
                          <button type="button" onClick={() => runAction(p.id, 'publish')} className="text-gray-400 hover:text-green-600" title="انتشار">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        {p.status === 'PUBLISHED' && (
                          <button type="button" onClick={() => runAction(p.id, 'unpublish')} className="text-gray-400 hover:text-slate-600" title="لغو انتشار">
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        <button type="button" onClick={() => runAction(p.id, 'duplicate')} className="text-gray-400 hover:text-sky-600" title="کپی">
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-indigo-600"
                          title="Export JSON"
                          onClick={async () => {
                            try {
                              const data = await apiClient.get(`/blog/admin/posts/${p.id}/export`);
                              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${p.slug || p.id}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch (e: unknown) {
                              alert(e instanceof Error ? e.message : 'Export ناموفق');
                            }
                          }}
                        >
                          <Upload className="h-4 w-4 rotate-180" />
                        </button>
                        <button type="button" onClick={() => setDeleteId(p.id)} className="text-gray-400 hover:text-error" title="حذف">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h3 className="text-lg font-bold text-gray-900">
                {editId ? 'ویرایش مطلب' : 'مطلب جدید'} — {channelLabel(channel)}
              </h3>
              <button type="button" onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3 pt-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-medium',
                    tab === t.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-500 hover:bg-gray-50',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="space-y-4 overflow-y-auto p-5">
              {tab === 'content' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">عنوان *</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">خلاصه</label>
                    <textarea
                      value={form.excerpt}
                      onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">متن مطلب *</label>
                    <BlogEditor
                      value={form.content}
                      onChange={(html) => setForm((f) => ({ ...f, content: html }))}
                    />
                  </div>
                </>
              )}

              {tab === 'basic' && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">اسلاگ</label>
                      <input
                        value={form.slug}
                        onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                        dir="ltr"
                        placeholder="خالی = خودکار"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">نویسنده</label>
                      <input
                        value={form.authorName}
                        onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">دسته‌بندی</label>
                      {categories.length > 0 ? (
                        <select
                          value={form.categoryId}
                          onChange={(e) => {
                            const cat = categories.find((c) => c.id === e.target.value);
                            setForm((f) => ({
                              ...f,
                              categoryId: e.target.value,
                              category: cat?.name || f.category,
                            }));
                          }}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          <option value="">— انتخاب —</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={form.category}
                          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">تگ‌ها (با ویرگول)</label>
                      <input
                        value={form.tags}
                        onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-600">تصویر شاخص</label>
                    <div className="flex items-start gap-3">
                      {form.coverImage ? (
                        <div className="relative h-16 w-24 overflow-hidden rounded-lg border border-gray-200">
                          <img src={form.coverImage} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, coverImage: '' }))}
                            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white"
                          >
                            ×
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploadingCover}
                        className="flex h-16 w-24 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-primary hover:text-primary"
                      >
                        {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      </button>
                      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.isCornerstone}
                        onChange={(e) => setForm((f) => ({ ...f, isCornerstone: e.target.checked }))}
                      />
                      مقاله ستونی
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.isEvergreen}
                        onChange={(e) => setForm((f) => ({ ...f, isEvergreen: e.target.checked }))}
                      />
                      همیشه‌سبز
                    </label>
                  </div>
                </>
              )}

              {tab === 'seo' && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        SEO Title
                        <span className={cn('mr-2', titleLen < 45 || titleLen > 60 ? 'text-amber-600' : 'text-green-600')}>
                          ({titleLen}/60)
                        </span>
                      </label>
                      <input
                        value={form.seoTitle}
                        onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Meta Description
                        <span className={cn('mr-2', metaLen < 120 || metaLen > 160 ? 'text-amber-600' : 'text-green-600')}>
                          ({metaLen}/160)
                        </span>
                      </label>
                      <textarea
                        value={form.seoDescription}
                        onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                        rows={2}
                        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Focus Keyword</label>
                      <input
                        value={form.focusKeyword}
                        onChange={(e) => setForm((f) => ({ ...f, focusKeyword: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">کلمات فرعی</label>
                      <input
                        value={form.secondaryKeywords}
                        onChange={(e) => setForm((f) => ({ ...f, secondaryKeywords: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Search Intent</label>
                      <select
                        value={form.searchIntent}
                        onChange={(e) => setForm((f) => ({ ...f, searchIntent: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="INFORMATIONAL">Informational</option>
                        <option value="COMMERCIAL">Commercial</option>
                        <option value="TRANSACTIONAL">Transactional</option>
                        <option value="NAVIGATIONAL">Navigational</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Canonical</label>
                      <select
                        value={form.canonicalType}
                        onChange={(e) => setForm((f) => ({ ...f, canonicalType: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="SELF">Self</option>
                        <option value="CUSTOM">Custom</option>
                        <option value="NONE">None</option>
                      </select>
                    </div>
                    {form.canonicalType === 'CUSTOM' && (
                      <div className="sm:col-span-2">
                        <input
                          value={form.canonicalUrl}
                          onChange={(e) => setForm((f) => ({ ...f, canonicalUrl: e.target.value }))}
                          dir="ltr"
                          placeholder="https://..."
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {(
                      [
                        ['robotsIndex', 'Index'],
                        ['robotsFollow', 'Follow'],
                        ['robotsNoArchive', 'Noarchive'],
                        ['robotsNoSnippet', 'Nosnippet'],
                        ['sitemapEnabled', 'Sitemap'],
                        ['rssEnabled', 'RSS'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!form[key]}
                          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <p className="mb-1 text-[10px] font-medium uppercase text-gray-400">پیش‌نمایش اسنیپت گوگل</p>
                    <p className="truncate text-base text-[#1a0dab]">{form.seoTitle || form.title || 'عنوان مقاله'}</p>
                    <p className="truncate font-mono text-xs text-[#006621]" dir="ltr">
                      {channel === 'RETAIL' ? 'poshaktaranom.ir' : 'poshaktaranom.com'}/blog/{form.slug || 'slug'}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                      {form.seoDescription || form.excerpt || 'توضیحات متا...'}
                    </p>
                  </div>
                  <button type="button" onClick={runSeoAnalyze} className="btn btn-outline btn-sm flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    تحلیل سئو
                  </button>
                  {seoScore && (
                    <div className="rounded-lg border border-gray-100 p-4 space-y-1">
                      <p className="text-sm font-bold">
                        امتیاز سئو: {seoScore.score.toLocaleString('fa-IR')} — {seoScore.status}
                      </p>
                      {seoScore.errors.map((e, i) => (
                        <p key={`e-${i}`} className="text-xs text-red-600">خطا: {e.label}{e.detail ? ` — ${e.detail}` : ''}</p>
                      ))}
                      {seoScore.warnings.slice(0, 8).map((w, i) => (
                        <p key={`w-${i}`} className="text-xs text-amber-600">هشدار: {w.label}{w.detail ? ` — ${w.detail}` : ''}</p>
                      ))}
                    </div>
                  )}
                </>
              )}

              {tab === 'related' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">جست‌وجوی محصول (نام یا SKU)</label>
                    <input
                      value={productQuery}
                      onChange={(e) => searchProducts(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="جست‌وجو..."
                    />
                    <div className="mt-2 space-y-1">
                      {productHits.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-right text-xs hover:bg-gray-50"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              relatedProductIds: f.relatedProductIds.includes(p.id)
                                ? f.relatedProductIds
                                : [...f.relatedProductIds, p.id],
                            }))
                          }
                        >
                          <span>{p.name}</span>
                          <span className="font-mono text-gray-400">{p.sku}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.relatedProductIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="rounded-full bg-gray-100 px-3 py-1 font-mono text-[11px] hover:bg-red-50 hover:text-red-600"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            relatedProductIds: f.relatedProductIds.filter((x) => x !== id),
                          }))
                        }
                      >
                        {id.slice(0, 8)} ×
                      </button>
                    ))}
                  </div>
                  {editId && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={async () => {
                        try {
                          const result = await apiClient.post<{ broken: Array<{ href: string; reason?: string }> }>(
                            '/blog/admin/check-links',
                            { channel, articleId: editId, content: form.content },
                          );
                          const broken = result?.broken || [];
                          alert(
                            broken.length
                              ? `لینک‌های مشکل‌دار:\n${broken.map((b) => `${b.href} (${b.reason})`).join('\n')}`
                              : 'لینک داخلی شکسته یافت نشد',
                          );
                        } catch {
                          alert('بررسی لینک ناموفق بود');
                        }
                      }}
                    >
                      بررسی لینک‌های داخلی
                    </button>
                  )}
                  {editId && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={async () => {
                        try {
                          const suggested = await apiClient.get<Array<{ id: string }>>(
                            `/blog/admin/posts/${editId}/related-suggest`,
                          );
                          const ids = (Array.isArray(suggested) ? suggested : []).map((s) => s.id);
                          setForm((f) => ({
                            ...f,
                            relatedArticleIds: Array.from(new Set([...f.relatedArticleIds, ...ids])),
                          }));
                        } catch {
                          alert('پیشنهاد مقالات مرتبط ناموفق بود');
                        }
                      }}
                    >
                      پیشنهاد مقالات مرتبط
                    </button>
                  )}
                </div>
              )}

              {tab === 'history' && (
                <div className="space-y-2">
                  {!editId ? (
                    <p className="text-sm text-gray-500">بعد از اولین ذخیره، تاریخچه نسخه در دسترس است.</p>
                  ) : revisions.length === 0 ? (
                    <p className="text-sm text-gray-500">نسخه‌ای ثبت نشده.</p>
                  ) : (
                    revisions.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-xs">
                        <div>
                          <p className="font-semibold">نسخه {r.versionNumber.toLocaleString('fa-IR')}</p>
                          <p className="text-gray-400">
                            {new Date(r.createdAt).toLocaleString('fa-IR')}
                            {r.changeSummary ? ` — ${r.changeSummary}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={async () => {
                            try {
                              await apiClient.post(`/blog/admin/posts/${editId}/revisions/${r.id}/restore`, {});
                              await load();
                              alert('نسخه بازگردانی شد');
                              setModal(false);
                            } catch (e: unknown) {
                              alert(e instanceof Error ? e.message : 'خطا');
                            }
                          }}
                        >
                          بازگردانی
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'social' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">OG Title</label>
                    <input value={form.ogTitle} onChange={(e) => setForm((f) => ({ ...f, ogTitle: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Twitter Title</label>
                    <input value={form.twitterTitle} onChange={(e) => setForm((f) => ({ ...f, twitterTitle: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">OG Description</label>
                    <textarea value={form.ogDescription} onChange={(e) => setForm((f) => ({ ...f, ogDescription: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Twitter Description</label>
                    <textarea value={form.twitterDescription} onChange={(e) => setForm((f) => ({ ...f, twitterDescription: e.target.value }))} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">OG Image URL</label>
                    <input value={form.ogImage} onChange={(e) => setForm((f) => ({ ...f, ogImage: e.target.value }))} dir="ltr" className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Twitter Card</label>
                    <select value={form.twitterCard} onChange={(e) => setForm((f) => ({ ...f, twitterCard: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      <option value="summary_large_image">summary_large_image</option>
                      <option value="summary">summary</option>
                    </select>
                  </div>
                </div>
              )}

              {tab === 'schema' && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Schema Type</label>
                      <select value={form.schemaType} onChange={(e) => setForm((f) => ({ ...f, schemaType: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <option value="BlogPosting">BlogPosting</option>
                        <option value="Article">Article</option>
                        <option value="NewsArticle">NewsArticle</option>
                        <option value="HowTo">HowTo</option>
                        <option value="FAQPage">FAQPage</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap items-end gap-4 pb-1 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={form.articleSchemaEnabled} onChange={(e) => setForm((f) => ({ ...f, articleSchemaEnabled: e.target.checked }))} />
                        Article Schema
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={form.breadcrumbEnabled} onChange={(e) => setForm((f) => ({ ...f, breadcrumbEnabled: e.target.checked }))} />
                        Breadcrumb
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={form.faqSchemaEnabled} onChange={(e) => setForm((f) => ({ ...f, faqSchemaEnabled: e.target.checked }))} />
                        FAQ Schema
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={form.howToSchemaEnabled} onChange={(e) => setForm((f) => ({ ...f, howToSchemaEnabled: e.target.checked }))} />
                        HowTo Schema
                      </label>
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600">بلوک HowTo (هر خط: عنوان|توضیح)</p>
                    <input
                      value={form.howToName}
                      onChange={(e) => setForm((f) => ({ ...f, howToName: e.target.value }))}
                      placeholder="عنوان راهنما"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={form.howToDescription}
                      onChange={(e) => setForm((f) => ({ ...f, howToDescription: e.target.value }))}
                      placeholder="توضیح کوتاه"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={form.howToTotalTime}
                      onChange={(e) => setForm((f) => ({ ...f, howToTotalTime: e.target.value }))}
                      placeholder="زمان تقریبی مثلاً PT30M"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      dir="ltr"
                    />
                    <textarea
                      value={form.howToSteps}
                      onChange={(e) => setForm((f) => ({ ...f, howToSteps: e.target.value }))}
                      rows={4}
                      placeholder={'انتخاب پارچه|جنس مناسب را انتخاب کنید\nاندازه‌گیری|دور سینه را اندازه بگیرید'}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-600">پرسش‌های متداول (قابل مشاهده در صفحه)</p>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            faqItems: [
                              ...f.faqItems,
                              { question: '', answer: '', isVisible: true, includeInSchema: true, sortOrder: f.faqItems.length + 1 },
                            ],
                            faqSchemaEnabled: true,
                          }))
                        }
                      >
                        + FAQ
                      </button>
                    </div>
                    {form.faqItems.map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-gray-100 p-3 space-y-2">
                        <input
                          value={item.question}
                          onChange={(e) => {
                            const next = [...form.faqItems];
                            next[idx] = { ...next[idx], question: e.target.value };
                            setForm((f) => ({ ...f, faqItems: next }));
                          }}
                          placeholder="سؤال"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <textarea
                          value={item.answer}
                          onChange={(e) => {
                            const next = [...form.faqItems];
                            next[idx] = { ...next[idx], answer: e.target.value };
                            setForm((f) => ({ ...f, faqItems: next }));
                          }}
                          placeholder="پاسخ"
                          rows={2}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          className="text-xs text-error"
                          onClick={() => setForm((f) => ({ ...f, faqItems: f.faqItems.filter((_, i) => i !== idx) }))}
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {tab === 'publish' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">وضعیت</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">زمان‌بندی انتشار</label>
                    <input
                      type="datetime-local"
                      value={form.publishAt}
                      onChange={(e) => setForm((f) => ({ ...f, publishAt: e.target.value, status: e.target.value ? 'SCHEDULED' : f.status }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap items-end gap-4 pb-1 text-sm sm:col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.commentsEnabled}
                        onChange={(e) => setForm((f) => ({ ...f, commentsEnabled: e.target.checked }))}
                      />
                      نظرات عمومی فعال
                    </label>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">اولویت Sitemap (۰–۱)</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={form.sitemapPriority}
                      onChange={(e) => setForm((f) => ({ ...f, sitemapPriority: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              {tab === 'preview' && (
                <div className="prose prose-sm max-w-none rounded-xl border border-gray-100 bg-gray-50 p-5">
                  <p className="text-xs text-gray-400">پیش‌نمایش</p>
                  <h1 className="text-xl font-bold text-gray-900">{form.title || '—'}</h1>
                  <p className="text-sm text-gray-600">{form.excerpt}</p>
                  <hr />
                  {form.content.trim().startsWith('<') ? (
                    <div dangerouslySetInnerHTML={{ __html: form.content }} />
                  ) : (
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">{form.content}</pre>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-5 py-3">
              <button type="button" onClick={() => setModal(false)} className="btn btn-outline btn-md">
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.title || !form.content}
                className="btn btn-primary btn-md flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold">ورود مقاله (JSON یا Markdown)</h3>
            <p className="mb-3 text-xs text-gray-500">قالب JSON مطابق docs/BLOG_IMPORT_FORMAT.md</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={14}
              dir="ltr"
              className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs"
              placeholder='{"siteKey":"retail","title":"...","content":"..."}'
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImportOpen(false)} className="btn btn-outline btn-md">
                انصراف
              </button>
              <button type="button" onClick={handleImport} disabled={importing || !importText.trim()} className="btn btn-primary btn-md">
                {importing ? '...' : 'Import به Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-gray-900">حذف نرم مطلب</h3>
            <p className="mb-6 text-sm text-gray-500">مطلب به‌صورت soft delete حذف می‌شود.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="btn btn-outline btn-md flex-1">
                انصراف
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteId)}
                className="btn btn-md flex-1 bg-error text-white hover:bg-red-700"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
