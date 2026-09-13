'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Save, Loader2, CheckCircle, Image as ImageIcon, RotateCcw, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AdminChannelTabs, channelLabel, type AdminChannel } from './AdminChannelTabs';
import { AdminBlockEditor, type ContentBlock } from './AdminBlockEditor';
import {
  channelPublicHost,
  cmsPageKeysForChannel,
  cmsPageLabel,
  parseCmsWorkspaceQuery,
  serializeCmsWorkspaceQuery,
} from '@/lib/admin-cms-workspace';
import {
  cmsPageSeoForSave,
  defaultCanonical,
  emptyCmsPageSeo,
  normalizeCmsPageSeo,
  type CmsPageSeo,
} from '@/lib/cms/page-seo';
import { productsBlockPropsForSave, productsBlockSaveRegressed } from '@/lib/cms/products-block';
import { revalidateStorefrontAfterSave } from '@/lib/cms/revalidate-client';
import { getDefaultBlocks } from '@/lib/cms/defaults';
import { cn } from '@/lib/cn';

interface SiteContent {
  id?: string;
  channel: string;
  pageKey: string;
  title: string;
  blocks: ContentBlock[];
  seo?: Record<string, string> | null;
  isPublished?: boolean;
  updatedAt?: string;
}

type SettingsSnap = {
  business?: {
    businessName?: string;
    ownerName?: string;
    phone?: string;
    instagram?: string;
    telegram?: string;
    address?: string;
    officeAddress?: string;
    logoUrl?: string;
    logoAlt?: string;
    descriptionWholesale?: string;
    descriptionRetail?: string;
  };
};

function prepareBlocksForSave(list: ContentBlock[], channel: AdminChannel): ContentBlock[] {
  return list.map((block) => {
    if (block.type !== 'products') return block;
    return {
      ...block,
      props: productsBlockPropsForSave(block.props || {}, channel),
    };
  });
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function applyBusinessToChrome(
  list: ContentBlock[],
  channel: AdminChannel,
  business: NonNullable<SettingsSnap['business']>,
): ContentBlock[] {
  const phone = (business.phone || '').trim();
  const telegram = (business.telegram || '').replace(/^@/, '').trim();
  const instagram = (business.instagram || '').replace(/^@/, '').trim();
  const address = (business.officeAddress || business.address || '').trim();
  const brand = (business.businessName || '').trim();
  const blurb =
    channel === 'RETAIL' ? business.descriptionRetail || '' : business.descriptionWholesale || '';

  return list.map((block) => {
    if (block.type === 'announcement') {
      return {
        ...block,
        props: {
          ...block.props,
          ...(phone
            ? { phoneLabel: phone, phoneHref: `tel:${digitsOnly(phone) || phone}` }
            : {}),
          ...(telegram
            ? {
                telegramLabel: `@${telegram}`,
                telegramHref: `https://t.me/${telegram}`,
              }
            : {}),
        },
      };
    }
    if (block.type !== 'chrome') return block;
    return {
      ...block,
      props: {
        ...block.props,
        ...(brand ? { brandName: brand } : {}),
        ...(business.logoUrl ? { logoUrl: business.logoUrl } : {}),
        ...(blurb ? { blurb } : {}),
        ...(phone
          ? {
              phoneLabel: phone,
              phoneHref: `tel:${digitsOnly(phone) || phone}`,
              floatPhone: digitsOnly(phone) || phone,
            }
          : {}),
        ...(business.ownerName ? { ownerLabel: business.ownerName } : {}),
        ...(address ? { addressLines: address.split(/\n|،/).map((s) => s.trim()).filter(Boolean) } : {}),
        ...(telegram ? { telegramHref: `https://t.me/${telegram}`, floatTelegram: telegram } : {}),
        ...(instagram ? { instagramHref: `https://instagram.com/${instagram}` } : {}),
      },
    };
  });
}

export function AdminSiteContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspace = parseCmsWorkspaceQuery(searchParams);
  const channel = workspace.channel;
  const pageKey = workspace.page;
  const pageKeys = useMemo(() => cmsPageKeysForChannel(channel), [channel]);

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [seo, setSeo] = useState<CmsPageSeo>(emptyCmsPageSeo);
  const [isPublished, setIsPublished] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [copying, setCopying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const replaceWorkspace = useCallback(
    (next: { channel: AdminChannel; page: string }) => {
      if (dirty && !confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه؟')) return;
      const qs = serializeCmsWorkspaceQuery(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [dirty, pathname, router],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data: SiteContent | null = null;
      try {
        data = await apiClient.get<SiteContent>(`/cms/admin/site-content/${channel}/${pageKey}`);
      } catch {
        const list = await apiClient
          .get<SiteContent[]>(`/cms/admin/site-content?channel=${channel}`)
          .catch(() => [] as SiteContent[]);
        data = (Array.isArray(list) ? list : []).find((x) => x.pageKey === pageKey) ?? null;
      }
      const label = cmsPageLabel(channel, pageKey);
      setTitle(data?.title || label);
      setBlocks(Array.isArray(data?.blocks) ? (data!.blocks as ContentBlock[]) : []);
      setSeo(normalizeCmsPageSeo(data?.seo));
      setIsPublished(data?.isPublished !== false);
      setLastSavedAt(data?.updatedAt || null);
      setDirty(false);
    } catch {
      setTitle(cmsPageLabel(channel, pageKey));
      setBlocks([]);
      setSeo(emptyCmsPageSeo());
      setIsPublished(true);
      setLastSavedAt(null);
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }, [channel, pageKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const markDirty = <T,>(setter: (value: T) => void) => {
    return (value: T) => {
      setDirty(true);
      setter(value);
    };
  };

  const save = async () => {
    setSaving(true);
    try {
      const prepared = prepareBlocksForSave(blocks, channel);
      const payload = {
        channel,
        pageKey,
        title,
        blocks: prepared,
        seo: cmsPageSeoForSave(seo),
        isPublished,
      };
      const savedRow = await apiClient.put<SiteContent>(
        `/cms/admin/site-content?channel=${encodeURIComponent(channel)}`,
        payload,
      );
      if (savedRow?.channel !== channel) {
        throw new Error(
          `ذخیره روی کانال اشتباه برگشت (انتظار ${channelLabel(channel)}، دریافت ${savedRow?.channel || 'نامشخص'})`,
        );
      }
      if (savedRow.pageKey && savedRow.pageKey !== pageKey) {
        throw new Error(`ذخیره روی صفحه اشتباه برگشت (${savedRow.pageKey})`);
      }

      let nextBlocks = Array.isArray(savedRow.blocks) ? (savedRow.blocks as ContentBlock[]) : prepared;
      let nextTitle = savedRow.title || title;
      let nextSavedAt = savedRow.updatedAt || null;
      let nextSeo = normalizeCmsPageSeo(savedRow.seo ?? payload.seo);

      const verified = await apiClient.get<SiteContent>(
        `/cms/admin/site-content/${channel}/${pageKey}?_=${Date.now()}`,
      );
      if (!verified || verified.channel !== channel) {
        throw new Error(`بعد از ذخیره، محتوای ${channelLabel(channel)} از سرور خوانده نشد`);
      }

      const preparedProducts = prepared.find((b) => b.type === 'products');
      const verifiedProducts = Array.isArray(verified.blocks)
        ? verified.blocks.find((b) => (b as ContentBlock).type === 'products')
        : undefined;
      const regressed = productsBlockSaveRegressed(
        preparedProducts?.props,
        (verifiedProducts as ContentBlock | undefined)?.props,
        channel,
      );

      if (!regressed && Array.isArray(verified.blocks)) {
        nextBlocks = verified.blocks as ContentBlock[];
        nextTitle = verified.title || nextTitle;
        nextSavedAt = verified.updatedAt || nextSavedAt;
        nextSeo = normalizeCmsPageSeo(verified.seo ?? nextSeo);
      } else if (regressed) {
        nextBlocks = prepared;
        alert(
          'ذخیره ارسال شد، ولی خواندن مجدد هنوز حالت قبلی را نشان داد. UI روی تنظیمات ذخیره‌شده نگه داشته شد؛ یک‌بار hard refresh کنید.',
        );
      }

      setBlocks(nextBlocks);
      setTitle(nextTitle);
      setSeo(nextSeo);
      setLastSavedAt(nextSavedAt);
      setDirty(false);

      const bust = await revalidateStorefrontAfterSave(channel, pageKey);
      if (!bust.ok) {
        alert(
          `محتوای ${channelLabel(channel)} در دیتابیس ذخیره شد، ولی تازه‌سازی ویترین ناموفق بود` +
            (bust.error ? ` (${bust.error})` : '') +
            '. یک‌بار دیگر ذخیره کنید یا تا ۶۰ ثانیه صبر کنید.',
        );
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در ذخیره محتوا');
    } finally {
      setSaving(false);
    }
  };

  const loadDefaults = () => {
    if (blocks.length > 0 && !confirm('محتوای فعلی جایگزین پیش‌فرض‌ها می‌شود. ادامه؟')) return;
    setBlocks(getDefaultBlocks(channel, pageKey));
    if (!title) setTitle(cmsPageLabel(channel, pageKey));
    setDirty(true);
  };

  const seedAllPages = async () => {
    if (
      !confirm(
        `تمام صفحات ${channelLabel(channel)} با محتوای پیش‌فرض ذخیره شوند؟ (صفحات موجود بازنویسی می‌شوند)`,
      )
    ) {
      return;
    }
    setSeeding(true);
    try {
      for (const p of pageKeys) {
        const defaults = getDefaultBlocks(channel, p.key);
        const savedRow = await apiClient.put<SiteContent>(
          `/cms/admin/site-content?channel=${encodeURIComponent(channel)}`,
          {
            channel,
            pageKey: p.key,
            title: p.label,
            blocks: prepareBlocksForSave(defaults as ContentBlock[], channel),
            isPublished: true,
          },
        );
        if (savedRow?.channel !== channel) {
          throw new Error(`ذخیره ${p.label} روی کانال اشتباه برگشت`);
        }
      }
      await load();
      const bust = await revalidateStorefrontAfterSave(channel, '*');
      if (!bust.ok) {
        alert(
          `پیش‌فرض‌های ${channelLabel(channel)} ذخیره شد، ولی تازه‌سازی ویترین ناموفق بود` +
            (bust.error ? ` (${bust.error})` : '') +
            '.',
        );
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خطا در بارگذاری پیش‌فرض‌ها');
    } finally {
      setSeeding(false);
    }
  };

  const copyFromSettings = async () => {
    setCopying(true);
    try {
      const snap = await apiClient.get<SettingsSnap>('/settings/admin');
      if (!snap?.business) throw new Error('هویت فروشگاه در تنظیمات خالی است');
      setBlocks((prev) => applyBusinessToChrome(prev, channel, snap.business || {}));
      setDirty(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'خواندن تنظیمات ناموفق بود');
    } finally {
      setCopying(false);
    }
  };

  const pageLabel = cmsPageLabel(channel, pageKey);
  const host = channelPublicHost(channel);
  const settingsSeoHref = `/admin/settings?section=seo&channel=${channel}`;
  const productsHref = `/admin/products?channel=${channel}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">تنظیمات محتوای سایت</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            همه تب‌ها روی همین کانال هم‌گام‌اند —{' '}
            <span className="font-mono text-xs" dir="ltr">
              {host}
            </span>
          </p>
        </div>
        <AdminChannelTabs value={channel} onChange={(next) => replaceWorkspace({ channel: next, page: pageKey })} />
      </div>

      <div
        className={cn(
          'rounded-xl border px-4 py-3 text-sm',
          channel === 'RETAIL'
            ? 'border-amber-200 bg-amber-50 text-amber-950'
            : 'border-primary/20 bg-primary/5 text-gray-800',
        )}
      >
        {channel === 'RETAIL' ? (
          <>
            الان محتوای <strong>سایت تکی</strong> (poshaktaranom.ir) را ویرایش می‌کنید. ذخیره فقط همین
            کانال را عوض می‌کند؛ سایت عمده جداست.
          </>
        ) : (
          <>
            الان محتوای <strong>سایت عمده</strong> (poshaktaranom.com) را ویرایش می‌کنید. برای ویترین
            .ir حتماً تب «سایت تکی» را بزنید.
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="صفحات محتوا">
        {pageKeys.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={pageKey === p.key}
            onClick={() => replaceWorkspace({ channel, page: p.key })}
            className={cn(
              'cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              pageKey === p.key
                ? channel === 'RETAIL'
                  ? 'bg-amber-600 text-white'
                  : 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="card max-w-4xl space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
            <div className="flex flex-wrap items-center gap-2">
              <ImageIcon className="h-4 w-4" aria-hidden />
              ویرایش «{pageLabel}» — {channelLabel(channel)}
              {lastSavedAt ? (
                <span className="text-[11px] text-gray-400" dir="ltr">
                  آخرین ذخیره DB: {new Date(lastSavedAt).toLocaleString('fa-IR')}
                </span>
              ) : (
                <span className="text-[11px] text-amber-700">هنوز ردیفی برای این صفحه در DB نیست</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {pageKey === 'chrome' ? (
                <button
                  type="button"
                  onClick={() => void copyFromSettings()}
                  disabled={copying}
                  className="btn btn-outline btn-sm flex cursor-pointer items-center gap-1.5"
                >
                  {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  کپی تماس از تنظیمات
                </button>
              ) : null}
              <button
                type="button"
                onClick={loadDefaults}
                className="btn btn-outline btn-sm flex cursor-pointer items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                پیش‌فرض این صفحه
              </button>
              <button
                type="button"
                onClick={() => void seedAllPages()}
                disabled={seeding}
                className="btn btn-outline btn-sm flex cursor-pointer items-center gap-1.5"
              >
                {seeding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                )}
                ذخیره پیش‌فرض همه صفحات
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">عنوان صفحه</label>
            <input
              value={title}
              onChange={(e) => markDirty(setTitle)(e.target.value)}
              className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => markDirty(setIsPublished)(e.target.checked)}
            />
            منتشر روی ویترین
          </label>

          {pageKey === 'chrome' ? (
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              سئوی سراسری (عنوان پیش‌فرض، OG، سازمان) در{' '}
              <Link href={settingsSeoHref} className="font-semibold text-primary underline">
                تنظیمات → سئو
              </Link>{' '}
              است. این تب فقط هدر، فوتر و شناور را نگه می‌دارد.
            </p>
          ) : (
            <fieldset className="space-y-3 rounded-xl border border-gray-100 p-4">
              <legend className="px-1 text-sm font-semibold text-gray-800">سئوی همین صفحه</legend>
              <p className="text-[11px] text-gray-500">
                اگر خالی بماند، عنوان/شرح پیش‌فرض تنظیمات کانال استفاده می‌شود. کانونیکال خالی می‌شود{' '}
                <span dir="ltr">{defaultCanonical(channel, pageKey)}</span>
              </p>
              <label className="block text-xs font-medium text-gray-600">
                عنوان متا
                <input
                  value={seo.title}
                  onChange={(e) => markDirty(setSeo)({ ...seo, title: e.target.value })}
                  maxLength={200}
                  className="focus:ring-primary/30 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                شرح متا
                <textarea
                  value={seo.description}
                  onChange={(e) => markDirty(setSeo)({ ...seo, description: e.target.value })}
                  maxLength={320}
                  rows={3}
                  className="focus:ring-primary/30 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-gray-600">
                  تصویر OG
                  <input
                    dir="ltr"
                    value={seo.ogImage}
                    onChange={(e) => markDirty(setSeo)({ ...seo, ogImage: e.target.value })}
                    className="focus:ring-primary/30 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  آلت تصویر OG
                  <input
                    value={seo.ogAlt}
                    onChange={(e) => markDirty(setSeo)({ ...seo, ogAlt: e.target.value })}
                    maxLength={160}
                    className="focus:ring-primary/30 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-gray-600">
                کانونیکال
                <input
                  dir="ltr"
                  value={seo.canonical}
                  onChange={(e) => markDirty(setSeo)({ ...seo, canonical: e.target.value })}
                  placeholder={defaultCanonical(channel, pageKey)}
                  className="focus:ring-primary/30 mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={seo.robots === 'index'}
                  onChange={(e) =>
                    markDirty(setSeo)({ ...seo, robots: e.target.checked ? 'index' : 'noindex' })
                  }
                />
                ایندکس در جست‌وجو
              </label>
            </fieldset>
          )}

          {pageKey === 'products' ? (
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              آلت هر عکس محصول در{' '}
              <Link href={productsHref} className="font-semibold text-primary underline">
                کارت محصول
              </Link>{' '}
              است؛ همین متن روی PDP، کارت، OG و ImageObject می‌رود.
            </p>
          ) : null}

          <AdminBlockEditor
            blocks={blocks}
            onChange={(next) => {
              setDirty(true);
              setBlocks(next);
            }}
            channel={channel}
          />

          <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-gray-100 bg-white/95 py-3 backdrop-blur">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className={cn(
                'btn btn-md flex cursor-pointer items-center gap-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                channel === 'RETAIL' ? 'bg-amber-600 hover:bg-amber-700' : 'btn-primary',
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              ذخیره روی سایت {channelLabel(channel)}
            </button>
            {saved && (
              <p className="text-success flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                ذخیره و تأیید شد ({channelLabel(channel)} / {pageLabel})
              </p>
            )}
            <span className="hidden text-[11px] text-gray-500 sm:inline">
              اگر ویترین فوری عوض نشد تا ۶۰ ثانیه صبر کنید یا یک‌بار hard refresh بزنید.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
