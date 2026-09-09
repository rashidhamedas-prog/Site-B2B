'use client';

import { useCallback, useEffect, useState, type MutableRefObject } from 'react';
import { apiClient } from '@/lib/api';
import { revalidateStorefrontAfterSave } from '@/lib/cms/revalidate-client';
import { TextAreaField, ToggleRow } from './fields';
import { SettingsSection } from './primitives';
import type { SaleChannel } from './types';

interface ChromeDoc {
  title?: string;
  blocks?: Array<{ id: string; type: string; props: Record<string, unknown> }>;
}

export function HomeTickerCard({
  channel,
  saveRef,
}: {
  channel: SaleChannel;
  saveRef: MutableRefObject<() => Promise<void>>;
}) {
  const [enabled, setEnabled] = useState(true);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('chrome');
  const [blocks, setBlocks] = useState<ChromeDoc['blocks']>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (ch: SaleChannel) => {
    setLoading(true);
    try {
      const data = await apiClient.get<ChromeDoc>(`/cms/admin/site-content/${ch}/chrome`);
      setTitle(data.title || 'chrome');
      const list = Array.isArray(data.blocks) ? data.blocks : [];
      setBlocks(list);
      const ann = list.find((b) => b.type === 'announcement');
      setEnabled(ann?.props?.enabled !== false);
      const items = Array.isArray(ann?.props?.tickerItems)
        ? (ann!.props.tickerItems as unknown[]).filter((x) => typeof x === 'string') as string[]
        : [];
      setText(items.join('\n'));
    } catch {
      setBlocks([]);
      setText('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(channel); }, [channel, load]);

  useEffect(() => {
    saveRef.current = async () => {
      const tickerItems = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let next = [...(blocks ?? [])];
      const idx = next.findIndex((b) => b.type === 'announcement');
      const props = {
        ...(idx >= 0 ? next[idx].props : {}),
        enabled,
        tickerItems,
      };
      if (idx >= 0) next[idx] = { ...next[idx], props };
      else next = [{ id: `ann-${Date.now()}`, type: 'announcement', props }, ...next];
      await apiClient.put(`/cms/admin/site-content?channel=${encodeURIComponent(channel)}`, {
        channel,
        pageKey: 'chrome',
        title,
        blocks: next,
        isPublished: true,
      });
      const bust = await revalidateStorefrontAfterSave(channel, 'chrome');
      if (!bust.ok) {
        throw new Error(
          bust.error
            ? `تازه‌سازی ویترین ناموفق: ${bust.error}`
            : 'تازه‌سازی ویترین ناموفق بود',
        );
      }
    };
  }, [blocks, channel, enabled, saveRef, text, title]);

  return (
    <SettingsSection
      tone={channel === 'RETAIL' ? 'retail' : 'wholesale'}
      title="نوار روان صفحه اصلی"
      hint="هر خط یک خبر است. فقط روی هوم همین سایت دیده می‌شود. برای توقف، نوار را خاموش کنید."
      badge="هوم"
    >
      {loading ? (
        <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <>
          <ToggleRow label="نمایش نوار روان" value={enabled} onChange={setEnabled} />
          <TextAreaField label="خبرها (هر خط جدا)" value={text} onChange={setText} rows={5} />
          {text.trim() ? (
            <div className="overflow-hidden rounded-xl bg-gray-900 px-4 py-2 text-xs text-white">
              <div className="whitespace-nowrap opacity-90">
                {text.split(/\r?\n/).filter(Boolean).join('  ·  ')}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">اگر خالی بماند، متن پیش‌فرض هوم نمایش داده می‌شود مگر نوار خاموش باشد.</p>
          )}
        </>
      )}
    </SettingsSection>
  );
}
