'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { AdminTelegramTemplateBuilder } from './AdminTelegramTemplateBuilder';
import {
  Badge,
  Callout,
  EVENT_LABELS,
  Metric,
  PROVIDERS,
  PROVIDER_META,
  ProviderChip,
  ProviderTabs,
  ProviderTokenVault,
  RadioCards,
  Section,
  Stepper,
  TelegramPreview,
  Toggle,
  WriteOnlySecretField,
  actionLabel,
  channelLabel,
  chatTypeLabel,
  deliveryStatus,
  destinationReady,
  errorLabel,
  eventLabel,
  faNumber,
  hourLabel,
  isProvider,
  outboxStatus,
  platformRendered,
  providerLabel,
  publicationStatus,
  relativeTime,
  templateLooksReady,
  tokenDraftReady,
  tokenSourceLabel,
  type AuditRow,
  type AutoPublishMode,
  type Channel,
  type Connection,
  type Delivery,
  type Destination,
  type DiscoveredChat,
  type MediaRow,
  type OosPolicy,
  type OutboxRow,
  type Provider,
  type ProviderInfo,
  type Publication,
  type Rendered,
  type SecretStatus,
  type Status,
  type StepState,
  type Template,
  type WithdrawAction,
} from './admin-omnichannel-ui';

type View = 'setup' | 'publish' | 'ops';
type Step = 'bot' | 'channels' | 'template' | 'rules' | 'activate';
type SourceType = 'PRODUCT' | 'BLOG_POST' | 'CMS_PAGE';

type RulesDraft = {
  autoPublishMode: AutoPublishMode;
  autoPublishEventTypes: string[];
  retailOosPolicy: OosPolicy;
  wholesaleOosPolicy: OosPolicy;
  withdrawAction: WithdrawAction;
  autoDailyCap: number;
  autoMinGapSeconds: number;
  quietStartHour: number | null;
  quietEndHour: number | null;
  retrySlaSeconds: number;
  outboxRetentionDays: number;
};

const DEFAULT_EVENTS = ['product.created', 'product.content_changed', 'product.price_changed', 'product.visibility_changed', 'product.media_changed', 'product.withdrawn'];
const GAP_OPTIONS = [0, 60, 90, 300, 600, 900, 1800, 3600];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const PRODUCT_TEMPLATE_EVENT = 'product.published';

function rulesFromStatus(st: Status | null): RulesDraft {
  return {
    autoPublishMode: st?.autoPublishMode || 'OFF',
    autoPublishEventTypes: st?.autoPublishEventTypes?.length ? st.autoPublishEventTypes : DEFAULT_EVENTS,
    retailOosPolicy: st?.retailOosPolicy || 'UPDATE',
    wholesaleOosPolicy: st?.wholesaleOosPolicy || 'UPDATE',
    withdrawAction: st?.withdrawAction || 'DELETE',
    autoDailyCap: typeof st?.autoDailyCap === 'number' ? st.autoDailyCap : 20,
    autoMinGapSeconds: typeof st?.autoMinGapSeconds === 'number' ? st.autoMinGapSeconds : 90,
    quietStartHour: st?.quietStartHour ?? null,
    quietEndHour: st?.quietEndHour ?? null,
    retrySlaSeconds: typeof st?.retrySlaSeconds === 'number' ? st.retrySlaSeconds : 3600,
    outboxRetentionDays: typeof st?.outboxRetentionDays === 'number' ? st.outboxRetentionDays : 90,
  };
}

function gapLabel(seconds: number) {
  if (seconds === 0) return 'بدون فاصله';
  if (seconds < 60) return `${faNumber(seconds)} ثانیه`;
  if (seconds < 3600) return `${faNumber(Math.round(seconds / 60))} دقیقه`;
  return `${faNumber(Math.round(seconds / 3600))} ساعت`;
}

function modeLabel(mode?: AutoPublishMode) {
  return mode === 'LIVE' ? 'زنده' : mode === 'CANARY' ? 'آزمایشی' : 'خاموش';
}

/** One master template per sales channel, stored under Telegram; every adapter converts it to its own format. */
const MASTER_TEMPLATE_PROVIDER: Provider = 'TELEGRAM';

function isProductTemplate(row: Template, channel: Channel) {
  return row.provider === MASTER_TEMPLATE_PROVIDER && row.channel === channel && row.eventType === PRODUCT_TEMPLATE_EVENT && row.enabled !== false;
}

function defaultSecretRef(provider: Provider) {
  return `${provider}_BOT_TOKEN`;
}

const EMPTY_TOKEN_DRAFTS: Record<Provider, string> = { TELEGRAM: '', BALE: '', RUBIKA: '' };
const EMPTY_TOKEN_REVEALS: Record<Provider, boolean> = { TELEGRAM: false, BALE: false, RUBIKA: false };

/** Fallback copy of the API matrix so the console still renders when `status.providers` is missing (old API). */
function fallbackProviderInfo(provider: Provider): ProviderInfo {
  const shared = {
    boldOnCaption: true, album: true, albumLimit: 10, captionLimit: 1024, textLimit: 4096, buttons: 'inline' as const, buttonsOnAlbum: false as const,
    silent: true, protectContent: true, captionAbove: true, linkPreviewToggle: true, editCaption: true, editText: true, deleteWindowHours: null,
    permissionCheck: 'api' as const, discoverChats: true, chatIdExamples: [] as string[], enabled: false, tokenConfigured: false, tokenSource: 'none' as const, tokenFingerprint: null, defaultSecretRef: defaultSecretRef(provider),
  };
  if (provider === 'BALE') {
    return { ...shared, provider, label: 'بله', botFactory: '@botfather در بله', apiBase: 'https://tapi.bale.ai', textFormat: 'MARKDOWN', silent: false, protectContent: false, captionAbove: false, linkPreviewToggle: false, deleteWindowHours: 48, chatIdHint: 'برای کانال عمومی @username، برای کانال خصوصی شناسه عددی' };
  }
  if (provider === 'RUBIKA') {
    return { ...shared, provider, label: 'روبیکا', botFactory: '@BotFather در روبیکا', apiBase: 'https://botapi.rubika.ir/v3', textFormat: 'METADATA', boldOnCaption: false, album: false, albumLimit: 1, captionLimit: 4096, buttons: 'text-link', protectContent: false, captionAbove: false, linkPreviewToggle: false, editCaption: false, permissionCheck: 'test_post', chatIdHint: 'شناسه کانال روبیکا با c0 شروع می‌شود' };
  }
  return { ...shared, provider: 'TELEGRAM', label: 'تلگرام', botFactory: '@BotFather در تلگرام', apiBase: 'https://api.telegram.org', textFormat: 'HTML', chatIdHint: 'برای کانال عمومی @username، برای کانال خصوصی شناسه عددی مثل -1001234567890' };
}

export function AdminOmnichannel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [view, setView] = useState<View>('setup');
  const [step, setStep] = useState<Step | null>(null);

  const [connProvider, setConnProvider] = useState<Provider>('TELEGRAM');
  const [connName, setConnName] = useState('');
  const [connChannel, setConnChannel] = useState<Channel>('RETAIL');
  const [secretRef, setSecretRef] = useState(defaultSecretRef('TELEGRAM'));
  const [tokenDrafts, setTokenDrafts] = useState<Record<Provider, string>>(EMPTY_TOKEN_DRAFTS);
  const [tokenReveals, setTokenReveals] = useState<Record<Provider, boolean>>(EMPTY_TOKEN_REVEALS);
  const [customToken, setCustomToken] = useState('');
  const [customReveal, setCustomReveal] = useState(false);
  const [showAdvancedRef, setShowAdvancedRef] = useState(false);
  const [destConnectionId, setDestConnectionId] = useState('');
  const [destKey, setDestKey] = useState('');
  const [destName, setDestName] = useState('');
  const [discovered, setDiscovered] = useState<{ connectionId: string; chats: DiscoveredChat[]; error?: string | null } | null>(null);
  const [tplChannel, setTplChannel] = useState<Channel>('RETAIL');
  const [previewProvider, setPreviewProvider] = useState<Provider>('TELEGRAM');

  const [rules, setRules] = useState<RulesDraft>(() => rulesFromStatus(null));
  const [savedRules, setSavedRules] = useState<RulesDraft>(() => rulesFromStatus(null));
  const savedRulesRef = useRef<RulesDraft>(rulesFromStatus(null));

  const [pubChannel, setPubChannel] = useState<Channel>('RETAIL');
  const [sourceType, setSourceType] = useState<SourceType>('PRODUCT');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('بازبینی ادمین');
  const [preview, setPreview] = useState<{ projection: Record<string, unknown>; rendered?: Rendered } | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [st, conns, dests, tpls, pubs, dels, box, logs, files] = await Promise.all([
        apiClient.get<Status>('/omnichannel/status'),
        apiClient.get<Connection[]>('/omnichannel/connections'),
        apiClient.get<Destination[]>('/omnichannel/destinations'),
        apiClient.get<Template[]>('/omnichannel/templates'),
        apiClient.get<Publication[]>('/omnichannel/publications'),
        apiClient.get<Delivery[]>('/omnichannel/deliveries'),
        apiClient.get<OutboxRow[]>('/omnichannel/outbox'),
        apiClient.get<AuditRow[]>('/omnichannel/audits'),
        apiClient.get<MediaRow[]>('/omnichannel/media').catch(() => [] as MediaRow[]),
      ]);
      setStatus(st);
      const fromServer = rulesFromStatus(st);
      const previous = JSON.stringify(savedRulesRef.current);
      savedRulesRef.current = fromServer;
      setSavedRules(fromServer);
      // Adopt server values unless the admin has unsaved edits in the draft.
      setRules((current) => (JSON.stringify(current) === previous ? fromServer : current));
      setConnections(conns);
      setDestinations(dests);
      setTemplates(tpls);
      setPublications(pubs);
      setDeliveries(dels);
      setOutbox(box);
      setAudits(logs);
      setMedia(files);
      setDestConnectionId((current) => current || conns[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>, fallback: string, ok?: string) => {
    setError('');
    setNotice('');
    setBusy(key);
    try {
      await fn();
      await load();
      if (ok) setNotice(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy('');
    }
  };

  /* ---------- derived readiness ---------- */

  const connById = useMemo(() => new Map(connections.map((row) => [row.id, row])), [connections]);
  const destById = useMemo(() => new Map(destinations.map((row) => [row.id, row])), [destinations]);
  const providerInfos = useMemo<ProviderInfo[]>(
    () => PROVIDERS.map((provider) => status?.providers?.find((row) => row.provider === provider) || fallbackProviderInfo(provider)),
    [status?.providers],
  );
  const providerInfo = (provider: string | undefined): ProviderInfo => providerInfos.find((row) => row.provider === provider) || providerInfos[0];
  const botConnections = connections.filter((row) => isProvider(row.provider));
  const activeConnections = botConnections.filter((row) => row.status === 'ACTIVE');
  const activeProviders = useMemo(() => PROVIDERS.filter((provider) => connections.some((row) => row.provider === provider)), [connections]);
  const providerOf = (dest: Destination | undefined): Provider => {
    const raw = dest ? connById.get(dest.connectionId)?.provider : undefined;
    return isProvider(raw) ? raw : 'TELEGRAM';
  };
  const channelOf = (dest: Destination): Channel => (connById.get(dest.connectionId)?.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL');
  const connectionsByProvider = (provider: Provider) => botConnections.filter((row) => row.provider === provider);
  const selectedProviderInfo = providerInfo(connProvider);
  const secretRefMatchesProvider = secretRef.startsWith(`${connProvider}_`);
  const secretStatus: SecretStatus = status?.secrets?.find((row) => row.secretRef === secretRef) || {
    secretRef,
    configured: Boolean(selectedProviderInfo.tokenConfigured && secretRef === selectedProviderInfo.defaultSecretRef),
    source: secretRef === selectedProviderInfo.defaultSecretRef ? (selectedProviderInfo.tokenSource || 'none') : 'none',
    fingerprint: secretRef === selectedProviderInfo.defaultSecretRef ? selectedProviderInfo.tokenFingerprint || null : null,
    updatedAt: null,
  };
  const customTokenReady = tokenDraftReady(connProvider, customToken);
  const usingCustomSecretRef = secretRef !== defaultSecretRef(connProvider);
  const destConnection = connById.get(destConnectionId);
  const destProviderInfo = providerInfo(destConnection?.provider);
  const summarizeBots = (rows: Connection[]) => PROVIDERS
    .map((provider) => ({ provider, count: rows.filter((row) => row.provider === provider).length }))
    .filter((row) => row.count > 0)
    .map((row) => `${providerLabel(row.provider)}${row.count > 1 ? ` ×${faNumber(row.count)}` : ''}`)
    .join('، ');
  const readyDestinations = destinations.filter((dest) => dest.enabled && destinationReady(dest) && connById.get(dest.connectionId)?.status === 'ACTIVE');
  const readyByChannel = (channel: Channel) => readyDestinations.filter((dest) => channelOf(dest) === channel);
  const canaryByChannel = (channel: Channel) => destinations.find((dest) => dest.isCanary && channelOf(dest) === channel);
  const unverified = destinations.filter((dest) => dest.enabled && !dest.isCanary && !dest.verified);
  const retailTpl = templates.filter((row) => isProductTemplate(row, 'RETAIL')).sort((a, b) => b.version - a.version)[0];
  const wholesaleTpl = templates.filter((row) => isProductTemplate(row, 'WHOLESALE')).sort((a, b) => b.version - a.version)[0];
  const templatesReady = templateLooksReady(retailTpl?.body) && templateLooksReady(wholesaleTpl?.body);
  const flagsOn = Boolean(status?.connectors && status?.autoPublish);
  const mode = status?.autoPublishMode || 'OFF';
  const rulesDirty = JSON.stringify(rules) !== JSON.stringify(savedRules);
  const deliveriesByPub = useMemo(() => {
    const map = new Map<string, Delivery[]>();
    for (const row of deliveries) {
      const list = map.get(row.publicationId) || [];
      list.push(row);
      map.set(row.publicationId, list);
    }
    return map;
  }, [deliveries]);
  const sentToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return deliveries.filter((row) => row.action === 'CREATE' && row.status === 'SUCCEEDED' && row.createdAt && new Date(row.createdAt) >= start).length;
  }, [deliveries]);
  const failing = deliveries.filter((row) => row.status === 'DEAD' || row.status === 'FAILED').length;

  const steps: Array<{ id: Step; label: string; state: StepState; hint?: string }> = [
    {
      id: 'bot',
      label: 'ربات',
      state: activeConnections.length ? 'done' : 'todo',
      hint: activeConnections.length ? summarizeBots(activeConnections) : 'رباتی ثبت نشده (تلگرام، بله یا روبیکا)',
    },
    {
      id: 'channels',
      label: 'کانال‌ها',
      state: readyDestinations.length ? (unverified.length ? 'warn' : 'done') : 'todo',
      hint: readyDestinations.length ? `${faNumber(readyDestinations.length)} مقصد آماده${unverified.length ? ` · ${faNumber(unverified.length)} تأییدنشده` : ''}` : 'مقصد تأییدشده‌ای نیست',
    },
    {
      id: 'template',
      label: 'قالب پست',
      state: templatesReady ? 'done' : templateLooksReady(retailTpl?.body) || templateLooksReady(wholesaleTpl?.body) ? 'warn' : 'todo',
      hint: templatesReady ? 'تکی و عمده ذخیره شده' : 'قالب تکی یا عمده آماده نیست',
    },
    {
      id: 'rules',
      label: 'قواعد خودکار',
      state: mode !== 'OFF' ? 'done' : status?.autoPublishEventTypesChosen ? 'warn' : 'todo',
      hint: `${modeLabel(mode)} · روزانه تا ${faNumber(status?.autoDailyCap ?? 20)} پست`,
    },
    {
      id: 'activate',
      label: 'تست و فعال‌سازی',
      state: mode === 'LIVE' && flagsOn ? 'done' : mode === 'CANARY' ? 'warn' : 'todo',
      hint: mode === 'LIVE' ? (flagsOn ? 'انتشار خودکار زنده است' : 'پرچم سرور خاموش است') : mode === 'CANARY' ? 'فقط به مقصد تست می‌رود' : 'هنوز روشن نشده',
    },
  ];
  const currentStep: Step = step || steps.find((row) => row.state !== 'done')?.id || 'activate';

  // Default test target = canary of the chosen channel; re-evaluated only when the ready set changes.
  const readyKey = readyByChannel(pubChannel).map((dest) => dest.id).join(',');
  const canaryId = canaryByChannel(pubChannel)?.id || '';
  useEffect(() => {
    const ready = readyKey ? readyKey.split(',') : [];
    setTargetId((current) => (current && ready.includes(current) ? current : canaryId || ready[0] || ''));
  }, [pubChannel, readyKey, canaryId]);

  // The preview follows the chosen destination's platform; with "auto rules" the admin picks the tab.
  const targetProvider = targetId ? providerOf(destById.get(targetId)) : null;
  useEffect(() => {
    if (targetProvider) setPreviewProvider(targetProvider);
  }, [targetProvider]);

  // Selecting a platform card pre-fills the conventional env name unless the admin typed a custom one.
  const pickProvider = (next: Provider) => {
    setConnProvider(next);
    setSecretRef((current) => (PROVIDERS.some((provider) => current === defaultSecretRef(provider)) || !current ? defaultSecretRef(next) : current));
  };

  /* ---------- actions ---------- */

  const saveRules = () => run('rules', async () => {
    await apiClient.patch('/omnichannel/settings', { ...rules, reason });
  }, 'خطا در ذخیره قواعد', 'قواعد خودکار ذخیره شد');

  const setMode = (next: AutoPublishMode) => run(`mode-${next}`, async () => {
    await apiClient.patch('/omnichannel/settings', { autoPublishMode: next, reason });
    setRules((current) => ({ ...current, autoPublishMode: next }));
  }, 'تغییر حالت ناموفق', next === 'OFF' ? 'انتشار خودکار خاموش شد' : next === 'CANARY' ? 'حالت آزمایشی فعال شد؛ پست‌ها فقط به مقصد تست می‌روند' : 'انتشار خودکار زنده شد');

  const doPreview = () => run('preview', async () => {
    const res = await apiClient.post<{ projection: Record<string, unknown>; rendered?: Rendered }>('/omnichannel/preview', { channel: pubChannel, sourceType, sourceId });
    setPreview({ projection: res.projection, rendered: res.rendered });
  }, 'خطا در پیش‌نمایش');

  const doSend = (destinationId?: string) => {
    const target = destinationId ? destById.get(destinationId) : null;
    const where = target ? `«${target.displayName}»` : mode === 'LIVE' ? 'همه کانال‌های تأییدشده' : 'مقصد تست (canary)';
    if (!window.confirm(`این منبع به ${where} ارسال می‌شود. ادامه می‌دهید؟`)) return;
    void run('send', async () => {
      await apiClient.post('/omnichannel/publications', {
        preview: { channel: pubChannel, sourceType, sourceId },
        dryRun: false,
        ...(destinationId ? { destinationId } : {}),
        reason,
      });
      setView('publish');
    }, 'خطا در ارسال', 'به صف ارسال رفت؛ چند ثانیه بعد وضعیت را ببینید');
  };

  if (loading && !status) {
    return <div className="p-6 text-sm text-gray-500">در حال بارگذاری کانال‌های انتشار…</div>;
  }

  /* ---------- panels ---------- */

  const botPanel = (
    <Section
      title="۱. ربات پیام‌رسان"
      description="توکن تلگرام، بله و روبیکا هر کدام کادر جدا دارند. ربات را در همان پیام‌رسان بسازید، توکن را یک‌بار بچسبانید و ذخیره کنید. بعد از ذخیره کادر خالی می‌شود و مقدار دیگر دیده نمی‌شود. سپس ربات را برای تکی یا عمده ثبت کنید."
    >
      <ProviderTokenVault
        providers={providerInfos}
        secrets={status?.secrets}
        drafts={tokenDrafts}
        reveals={tokenReveals}
        busyKey={busy}
        onDraft={(provider, value) => setTokenDrafts((current) => ({ ...current, [provider]: value }))}
        onReveal={(provider, next) => setTokenReveals((current) => ({ ...current, [provider]: next }))}
        onSave={(provider) => {
          const token = tokenDrafts[provider];
          void run(`secret-save-${provider}`, async () => {
            await apiClient.put('/omnichannel/secrets', { secretRef: defaultSecretRef(provider), token, reason });
            setTokenDrafts((current) => ({ ...current, [provider]: '' }));
            setTokenReveals((current) => ({ ...current, [provider]: false }));
          }, 'ذخیره توکن ناموفق', `توکن ${providerLabel(provider)} ذخیره شد و دیگر دیده نمی‌شود`);
        }}
        onClear={(provider) => {
          if (!window.confirm(`توکن ${providerLabel(provider)} که در پنل ذخیره شده پاک شود؟ اگر روی سرور env جدا باشد همان می‌ماند.`)) return;
          void run(`secret-clear-${provider}`, async () => {
            await apiClient.delete(`/omnichannel/secrets/${encodeURIComponent(defaultSecretRef(provider))}`);
          }, 'حذف توکن ناموفق', `توکن پنل ${providerLabel(provider)} حذف شد`);
        }}
      />
      <p className="text-sm font-semibold text-gray-900">کدام ربات را ثبت می‌کنید؟</p>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="پیام‌رسان">
        {providerInfos.map((info) => {
          const meta = PROVIDER_META[info.provider];
          const selected = connProvider === info.provider;
          const bots = connectionsByProvider(info.provider);
          const activeBots = bots.filter((row) => row.status === 'ACTIVE').length;
          const state: { tone: 'ok' | 'warn' | 'off' | 'danger'; text: string } = !info.enabled
            ? { tone: 'danger', text: 'روی سرور خاموش' }
            : activeBots
              ? { tone: 'ok', text: `${faNumber(activeBots)} ربات فعال` }
              : bots.length
                ? { tone: 'warn', text: 'ربات خاموش' }
                : info.tokenConfigured
                  ? { tone: 'warn', text: 'توکن هست؛ ربات ثبت نشده' }
                  : { tone: 'off', text: 'راه‌اندازی نشده' };
          return (
            <button
              key={info.provider}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => pickProvider(info.provider)}
              className={`text-right rounded-2xl border p-3 transition cursor-pointer ${selected ? `${meta.ring} ring-2 bg-white shadow-sm` : 'border-gray-200 bg-gray-50 hover:bg-white'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-gray-900">
                  <span className={`h-2.5 w-2.5 rounded-full ${meta.accent}`} aria-hidden />
                  {info.label}
                </span>
                <Badge tone={state.tone}>{state.text}</Badge>
              </div>
              <p className="mt-2 text-[11px] text-gray-500 leading-5">
                ساخت ربات: {info.botFactory}
                <span className="block" dir="ltr">{info.apiBase.replace(/^https?:\/\//, '')}</span>
              </p>
              <p className="mt-1 text-[11px] text-gray-500 leading-5">
                {info.album ? `آلبوم تا ${faNumber(info.albumLimit)} عکس` : 'یک عکس در هر پست'} · {info.buttons === 'inline' ? 'دکمه زیر پست' : 'لینک در متن'} · {info.textFormat === 'HTML' ? 'HTML' : info.textFormat === 'MARKDOWN' ? 'Markdown' : 'متادیتا'}
              </p>
            </button>
          );
        })}
      </div>
      {!selectedProviderInfo.enabled && (
        <Callout tone="warn">{selectedProviderInfo.label} روی سرور خاموش است (OMNICHANNEL_DISABLED_PROVIDERS یا پرچم کانکتور). می‌توانید توکن را ذخیره و ربات را ثبت کنید ولی تا روشن‌شدن، تست زنده و ارسال کار نمی‌کند.</Callout>
      )}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">ثبت ربات {selectedProviderInfo.label}</h3>
          <p className="mt-1 text-[11px] text-gray-500 leading-5">
            توکن از <span className="font-mono" dir="ltr">{secretRef}</span>
            {secretStatus.configured ? ` (${tokenSourceLabel(secretStatus.source)})` : ' هنوز ذخیره نشده'} خوانده می‌شود.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-2">
          <label className="text-xs text-gray-500 space-y-1">
            <span>نام اتصال</span>
            <input className="border rounded-lg px-3 py-2 text-sm w-full bg-white" placeholder={`ربات ${selectedProviderInfo.label} ترنم`} value={connName} onChange={(e) => setConnName(e.target.value)} />
          </label>
          <label className="text-xs text-gray-500 space-y-1">
            <span>برای کانال</span>
            <select className="border rounded-lg px-3 py-2 text-sm w-full bg-white" value={connChannel} onChange={(e) => setConnChannel(e.target.value as Channel)}>
              <option value="RETAIL">تکی</option>
              <option value="WHOLESALE">عمده</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!connName.trim() || !secretRefMatchesProvider || busy === 'conn-add'}
              onClick={() => run('conn-add', async () => {
                await apiClient.post('/omnichannel/connections', { provider: connProvider, channel: connChannel, name: connName, secretRef });
                setConnName('');
              }, 'خطا در ثبت اتصال', `ربات ${selectedProviderInfo.label} ذخیره شد؛ حالا «تست توکن» را بزنید`)}
            >
              افزودن ربات {selectedProviderInfo.label}
            </button>
          </div>
        </div>
        <button type="button" className="text-[11px] text-gray-600 underline cursor-pointer" onClick={() => setShowAdvancedRef((open) => !open)}>
          {showAdvancedRef ? 'بستن نام متغیر سفارشی' : 'نام متغیر سفارشی (معمولاً لازم نیست)'}
        </button>
        {showAdvancedRef && (
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
            <label className="text-xs text-gray-500 space-y-1 block">
              <span>نام متغیر توکن (secretRef)</span>
              <input
                className={`border rounded-lg px-3 py-2 text-sm w-full font-mono ${secretRefMatchesProvider ? '' : 'border-red-300 bg-red-50'}`}
                dir="ltr"
                placeholder={selectedProviderInfo.defaultSecretRef}
                value={secretRef}
                aria-invalid={!secretRefMatchesProvider}
                onChange={(e) => setSecretRef(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              />
              {!secretRefMatchesProvider && <span className="block text-[11px] text-red-600">باید با <span className="font-mono" dir="ltr">{connProvider}_</span> شروع شود.</span>}
            </label>
            {usingCustomSecretRef && secretRefMatchesProvider && (
              <div className="space-y-2">
                <WriteOnlySecretField
                  id="omni-bot-token-custom"
                  name="omni-vault-custom"
                  label={`توکن برای ${secretRef}`}
                  value={customToken}
                  reveal={customReveal}
                  onChange={setCustomToken}
                  onReveal={setCustomReveal}
                  invalid={Boolean(customToken) && !customTokenReady}
                  hint="فقط وقتی نام متغیر با پیش‌فرض فرق دارد. بعد از ذخیره خالی می‌شود."
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!customTokenReady || busy === 'secret-save-custom'}
                  onClick={() => {
                    const token = customToken;
                    void run('secret-save-custom', async () => {
                      await apiClient.put('/omnichannel/secrets', { secretRef, token, reason });
                      setCustomToken('');
                      setCustomReveal(false);
                    }, 'ذخیره توکن ناموفق', `توکن ${secretRef} ذخیره شد و دیگر دیده نمی‌شود`);
                  }}
                >
                  ذخیره توکن این نام
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {botConnections.length === 0 ? (
        <Callout tone="info">هنوز رباتی ثبت نشده. ربات را در {selectedProviderInfo.botFactory} بسازید، توکن را در کادر بالا ذخیره کنید، بعد اینجا نام اتصال را بزنید. متغیر پیش‌فرض <span className="font-mono" dir="ltr">{selectedProviderInfo.defaultSecretRef}</span> است.</Callout>
      ) : (
        <ul className="divide-y rounded-xl border">
          {botConnections.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="flex-1 min-w-[12rem]">
                <p className="font-medium text-gray-900 flex items-center gap-2">{row.name} <ProviderChip provider={row.provider} /></p>
                <p className="text-xs text-gray-500">کانال {channelLabel(row.channel)} · <span className="font-mono" dir="ltr">{row.secretRef}</span>
                  {status?.secrets?.find((item) => item.secretRef === row.secretRef)?.configured
                    ? ` · ${tokenSourceLabel(status.secrets.find((item) => item.secretRef === row.secretRef)?.source)}`
                    : ' · توکن این نام ذخیره نشده'}
                </p>
              </div>
              <Badge tone={row.status === 'ACTIVE' ? 'ok' : 'off'}>{row.status === 'ACTIVE' ? 'فعال' : 'خاموش'}</Badge>
              {!providerInfo(row.provider).enabled && <Badge tone="danger">پیام‌رسان روی سرور خاموش</Badge>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy === `test-${row.id}`} onClick={() => run(`test-${row.id}`, async () => {
                  const res = await apiClient.post<{ ok?: boolean; error?: string }>(`/omnichannel/connections/${row.id}/test`, {});
                  if (res && res.ok === false) throw new Error(errorLabel(res.error) || 'تست اتصال ناموفق');
                }, 'تست اتصال ناموفق', 'ربات پاسخ داد؛ توکن درست است')}>
                  تست توکن
                </button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy === `ping-${row.id}` || !canaryByChannel(row.channel === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL')} title="پیام کوتاه فارسی به مقصد تست" onClick={() => run(`ping-${row.id}`, async () => {
                  await apiClient.post(`/omnichannel/connections/${row.id}/canary-ping`, { reason });
                }, 'ارسال آزمایشی ناموفق', 'پیام آزمایشی به مقصد تست رفت')}>
                  پیام آزمایشی
                </button>
                <button type="button" className="text-xs text-gray-600 underline cursor-pointer" onClick={() => run(`toggle-${row.id}`, async () => {
                  await apiClient.patch(`/omnichannel/connections/${row.id}`, { status: row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' });
                }, 'تغییر وضعیت ناموفق')}>
                  {row.status === 'ACTIVE' ? 'خاموش کن' : 'روشن کن'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );

  const discoverChats = (connectionId: string) => run(`discover-${connectionId}`, async () => {
    const res = await apiClient.post<{ ok: boolean; error?: string | null; chats: DiscoveredChat[] }>(`/omnichannel/connections/${connectionId}/discover-chats`, {});
    setDiscovered({ connectionId, chats: res?.chats || [], error: res?.ok ? null : res?.error || 'discover_failed' });
    if (res && res.ok === false) throw new Error(errorLabel(res.error) || 'پیدا کردن شناسه ناموفق بود');
  }, 'پیدا کردن شناسه ناموفق بود');

  const channelsPanel = (
    <Section
      title="۲. کانال‌ها و مقصدها"
      description="ربات را در کانال ادمین کنید (با اجازه ارسال، ویرایش و حذف پیام)، بعد شناسه کانال را ثبت کنید و «بررسی دسترسی» را بزنید. اگر شناسه را نمی‌دانید، یک پیام از کانال را برای ربات فوروارد کنید و «پیدا کردن شناسه» را بزنید. یک مقصد را «تست» کنید تا پست‌های آزمایشی فقط همان‌جا برود."
    >
      {botConnections.length === 0 && <Callout tone="warn">اول در مرحله ۱ یک ربات ثبت کنید؛ مقصد بدون ربات معنا ندارد.</Callout>}
      <div className="grid md:grid-cols-4 gap-2">
        <label className="text-xs text-gray-500 space-y-1">
          <span>ربات</span>
          <select className="border rounded-lg px-3 py-2 text-sm w-full" value={destConnectionId} onChange={(e) => { setDestConnectionId(e.target.value); setDiscovered(null); }}>
            {botConnections.length === 0 && <option value="">رباتی ثبت نشده</option>}
            {botConnections.map((row) => <option key={row.id} value={row.id}>{providerLabel(row.provider)} · {row.name} ({channelLabel(row.channel)})</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500 space-y-1">
          <span>شناسه کانال {destConnection ? `در ${providerLabel(destConnection.provider)}` : ''}</span>
          <input className="border rounded-lg px-3 py-2 text-sm w-full font-mono" dir="ltr" placeholder={destProviderInfo.chatIdExamples.join(' یا ') || '@channel'} value={destKey} onChange={(e) => setDestKey(e.target.value.trim())} />
          <span className="block text-[11px] text-gray-400 leading-4">{destProviderInfo.chatIdHint}</span>
        </label>
        <label className="text-xs text-gray-500 space-y-1">
          <span>نام نمایشی</span>
          <input className="border rounded-lg px-3 py-2 text-sm w-full" placeholder={`کانال عمده ترنم (${destProviderInfo.label})`} value={destName} onChange={(e) => setDestName(e.target.value)} />
        </label>
        <div className="flex items-end gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!destConnectionId || !destKey || !destName.trim() || busy === 'dest-add'}
            onClick={() => run('dest-add', async () => {
              const created = await apiClient.post<Destination>('/omnichannel/destinations', { connectionId: destConnectionId, destinationKey: destKey, displayName: destName });
              setDestKey('');
              setDestName('');
              if (created?.id && status?.connectors) {
                await apiClient.post(`/omnichannel/destinations/${created.id}/verify`, {}).catch(() => null);
              }
            }, 'خطا در ثبت مقصد', destProviderInfo.permissionCheck === 'test_post' ? 'مقصد ثبت شد؛ برای اثبات اجازه ارسال «پست آزمایشی» را بزنید' : 'مقصد ثبت شد و دسترسی ربات بررسی شد')}
          >
            افزودن کانال
          </button>
          {destProviderInfo.discoverChats && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              title="کانال‌هایی که ربات اخیراً دیده (پست کانال، فوروارد یا عضویت)"
              disabled={!destConnectionId || !status?.connectors || busy === `discover-${destConnectionId}`}
              onClick={() => discoverChats(destConnectionId)}
            >
              {busy === `discover-${destConnectionId}` ? 'در حال جست‌وجو…' : 'پیدا کردن شناسه'}
            </button>
          )}
        </div>
      </div>
      {discovered && discovered.connectionId === destConnectionId && (
        <div className="rounded-xl border border-dashed p-3 text-sm space-y-2 bg-gray-50">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-600">
              {discovered.error
                ? <span className="text-red-700">{errorLabel(discovered.error) || 'جست‌وجو ناموفق بود'}</span>
                : discovered.chats.length
                  ? `${faNumber(discovered.chats.length)} چت پیدا شد — روی «استفاده» بزنید تا شناسه و نام پر شود`
                  : 'چیزی پیدا نشد. ربات را در کانال ادمین کنید، یک پست در کانال بگذارید یا پیامی از کانال را برای ربات فوروارد کنید و دوباره بزنید.'}
            </p>
            <button type="button" className="text-xs text-gray-500 underline cursor-pointer" onClick={() => setDiscovered(null)}>بستن</button>
          </div>
          {discovered.chats.length > 0 && (
            <ul className="divide-y rounded-lg border bg-white">
              {discovered.chats.map((chat) => (
                <li key={chat.chatId} className="flex flex-wrap items-center gap-2 p-2">
                  <div className="flex-1 min-w-[10rem]">
                    <p className="text-sm text-gray-900">{chat.title || chat.username || chat.chatId}</p>
                    <p className="text-[11px] text-gray-500"><span className="font-mono" dir="ltr">{chat.chatId}</span> · {chatTypeLabel(chat.chatType)}{chat.username ? ` · @${chat.username}` : ''}</p>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setDestKey(chat.chatId); if (!destName.trim()) setDestName(chat.title || chat.username || chat.chatId); }}>استفاده</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {destinations.length === 0 ? (
        <Callout tone="info">مقصدی ثبت نشده. اولین مقصد را «تست» کنید (مثلاً چت خودتان با ربات) تا پست‌های آزمایشی امن باشند.</Callout>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {destinations.map((dest) => {
            const conn = connById.get(dest.connectionId);
            const info = providerInfo(conn?.provider);
            const v = dest.verified;
            const ready = destinationReady(dest) && dest.enabled;
            const needsTestPost = Boolean(v?.ok) && v?.chatType !== 'private' && v?.canPost !== true && (v?.permissionCheck === 'test_post' || v?.permissionCheck === 'unavailable' || info.permissionCheck === 'test_post');
            return (
              <li key={dest.id} className={`rounded-xl border p-3 text-sm space-y-2 ${dest.enabled ? 'bg-white' : 'bg-gray-50 opacity-70'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate flex items-center gap-2">{dest.displayName} <ProviderChip provider={conn?.provider} /></p>
                    <p className="text-xs text-gray-500 truncate">
                      <span className="font-mono" dir="ltr">{dest.destinationKey}</span> · {conn ? `${conn.name} (${channelLabel(conn.channel)})` : 'اتصال حذف شده'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {dest.isCanary && <Badge tone="info">مقصد تست</Badge>}
                    {ready ? <Badge tone="ok">آماده ارسال</Badge> : v && !v.ok ? <Badge tone="danger">دسترسی ندارد</Badge> : needsTestPost ? <Badge tone="warn">نیاز به پست آزمایشی</Badge> : v && v.ok ? <Badge tone="warn">اجازه ارسال ندارد</Badge> : <Badge tone="warn">تأییدنشده</Badge>}
                  </div>
                </div>
                {v && (
                  <div className="text-xs text-gray-600 leading-5">
                    {v.ok ? (
                      <>
                        {chatTypeLabel(v.chatType)}{v.title ? ` «${v.title}»` : ''}{v.username ? ` @${v.username}` : ''}{typeof v.memberCount === 'number' ? ` · ${faNumber(v.memberCount)} عضو` : ''}
                        {v.chatType !== 'private' && v.permissionCheck !== 'test_post' && v.permissionCheck !== 'unavailable' && (
                          <span className="block">
                            ربات {v.botIsAdmin ? 'ادمین است' : 'ادمین نیست'} · ارسال {v.canPost ? '✓' : '✗'} · ویرایش {v.canEdit ? '✓' : '✗'} · حذف {v.canDelete ? '✓' : '✗'}
                          </span>
                        )}
                        {v.chatType !== 'private' && (v.permissionCheck === 'test_post' || v.permissionCheck === 'unavailable') && (
                          <span className="block">
                            {v.testPostAt
                              ? <>اجازه ارسال با پست آزمایشی ثابت شد ({relativeTime(v.testPostAt)}) · ویرایش/حذف هنگام اولین به‌روزرسانی سنجیده می‌شود</>
                              : <>{info.label} امکان بررسی مجوز از API را ندارد؛ با یک «پست آزمایشی» اجازه ارسال ثابت می‌شود.</>}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-red-700">{errorLabel(v.error) || 'بررسی ناموفق'}</span>
                    )}
                    <span className="block text-gray-400">بررسی: {relativeTime(v.checkedAt)}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy === `verify-${dest.id}` || !status?.connectors} onClick={() => run(`verify-${dest.id}`, async () => {
                    const res = await apiClient.post<Destination & { botUsername?: string | null }>(`/omnichannel/destinations/${dest.id}/verify`, {});
                    if (res?.verified && !res.verified.ok) throw new Error(errorLabel(res.verified.error) || 'ربات به این مقصد دسترسی ندارد');
                  }, 'بررسی دسترسی ناموفق', 'دسترسی ربات بررسی شد')}>
                    بررسی دسترسی
                  </button>
                  {(needsTestPost || (v?.ok && v.permissionCheck === 'test_post')) && (
                    <button type="button" className="btn btn-secondary btn-sm" title="یک پیام کوتاه فارسی به همین مقصد می‌فرستد و اجازه ارسال را ثبت می‌کند" disabled={busy === `testpost-${dest.id}` || !status?.connectors || conn?.status !== 'ACTIVE' || !dest.enabled} onClick={() => {
                      if (!window.confirm(`یک پیام آزمایشی کوتاه به «${dest.displayName}» فرستاده می‌شود. ادامه می‌دهید؟`)) return;
                      void run(`testpost-${dest.id}`, async () => {
                        await apiClient.post(`/omnichannel/destinations/${dest.id}/test-post`, { reason });
                      }, 'پست آزمایشی ناموفق', 'پست آزمایشی رفت؛ اجازه ارسال ثبت شد');
                    }}>
                      پست آزمایشی
                    </button>
                  )}
                  <button type="button" className="text-xs text-gray-700 underline cursor-pointer" onClick={() => run(`canary-${dest.id}`, async () => {
                    await apiClient.patch(`/omnichannel/destinations/${dest.id}`, { isCanary: !dest.isCanary });
                  }, 'تغییر مقصد تست ناموفق')}>
                    {dest.isCanary ? 'برداشتن از تست' : 'انتخاب به‌عنوان مقصد تست'}
                  </button>
                  <button type="button" className="text-xs text-gray-500 underline cursor-pointer" onClick={() => run(`enable-${dest.id}`, async () => {
                    await apiClient.patch(`/omnichannel/destinations/${dest.id}`, { enabled: !dest.enabled });
                  }, 'تغییر وضعیت ناموفق')}>
                    {dest.enabled ? 'غیرفعال' : 'فعال'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!status?.connectors && <Callout tone="warn">پرچم کانکتور روی سرور خاموش است؛ بررسی دسترسی و ارسال تا روشن‌شدن آن کار نمی‌کند.</Callout>}
    </Section>
  );

  const templatePanel = (
    <Section
      title="۳. قالب پست"
      description="یک‌بار شکل پست را برای تکی و عمده تنظیم کنید؛ همین یک قالب برای تلگرام، بله و روبیکا استفاده می‌شود و هر پیام‌رسان خودش به فرمت خودش (HTML، Markdown، متادیتا) تبدیل می‌شود. از این به بعد هر پست خودکار دقیقاً با همین چیدمان و با عکس و مشخصات همان محصول می‌رود."
      actions={
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1" role="tablist">
          {(['RETAIL', 'WHOLESALE'] as Channel[]).map((ch) => {
            const ready = templateLooksReady((ch === 'RETAIL' ? retailTpl : wholesaleTpl)?.body);
            return (
              <button key={ch} type="button" role="tab" aria-selected={tplChannel === ch} className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 cursor-pointer ${tplChannel === ch ? 'bg-white shadow-sm font-medium' : 'text-gray-600'}`} onClick={() => setTplChannel(ch)}>
                {channelLabel(ch)}
                <span className={`h-2 w-2 rounded-full ${ready ? 'bg-emerald-500' : 'bg-amber-400'}`} aria-label={ready ? 'آماده' : 'ناقص'} />
              </button>
            );
          })}
        </div>
      }
    >
      <AdminTelegramTemplateBuilder
        channel={tplChannel}
        template={tplChannel === 'RETAIL' ? retailTpl : wholesaleTpl}
        saving={busy === 'tpl-save'}
        providers={providerInfos}
        activeProviders={activeProviders.length ? activeProviders : ['TELEGRAM']}
        onSave={async (body) => {
          await run('tpl-save', async () => {
            const existing = tplChannel === 'RETAIL' ? retailTpl : wholesaleTpl;
            if (existing) await apiClient.patch(`/omnichannel/templates/${existing.id}`, { body });
            else await apiClient.post('/omnichannel/templates', { provider: MASTER_TEMPLATE_PROVIDER, channel: tplChannel, eventType: PRODUCT_TEMPLATE_EVENT, body });
          }, 'خطا در ذخیره قالب', `قالب ${channelLabel(tplChannel)} ذخیره شد؛ پست‌های بعدی در همه پیام‌رسان‌ها با همین شکل می‌روند`);
        }}
      />
    </Section>
  );

  const toggleEvent = (key: string) => setRules((current) => ({
    ...current,
    autoPublishEventTypes: current.autoPublishEventTypes.includes(key) ? current.autoPublishEventTypes.filter((row) => row !== key) : [...current.autoPublishEventTypes, key],
  }));

  const rulesPanel = (
    <Section
      title="۴. قواعد خودکار"
      description="این‌ها یک‌بار تنظیم می‌شوند و بعد سیستم خودش تصمیم می‌گیرد چه چیزی، کجا و با چه ریتمی برود. تا «ذخیره» را نزنید هیچ تغییری اعمال نمی‌شود."
      actions={
        <>
          {rulesDirty && <Badge tone="warn">ذخیره نشده</Badge>}
          <button type="button" className="btn btn-secondary btn-sm" disabled={!rulesDirty} onClick={() => setRules(savedRules)}>انصراف</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!rulesDirty || busy === 'rules'} onClick={saveRules}>{busy === 'rules' ? 'در حال ذخیره…' : 'ذخیره قواعد'}</button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">حالت انتشار خودکار</p>
          <RadioCards<AutoPublishMode>
            name="auto-mode"
            value={rules.autoPublishMode}
            onChange={(autoPublishMode) => setRules((current) => ({ ...current, autoPublishMode }))}
            options={[
              { value: 'OFF', title: 'خاموش', hint: 'هیچ پستی خودکار نمی‌رود؛ فقط ارسال دستی از تب انتشارها.' },
              { value: 'CANARY', title: 'آزمایشی', hint: 'همه قواعد اجرا می‌شوند اما پست فقط به «مقصد تست» می‌رود. برای اطمینان قبل از زنده‌شدن.', badge: 'امن', tone: 'info' },
              { value: 'LIVE', title: 'زنده', hint: 'پست به همه کانال‌های تأییدشده می‌رود. مشتری‌ها می‌بینند.', badge: 'واقعی', tone: 'ok', disabled: readyDestinations.filter((dest) => !dest.isCanary).length === 0 },
            ]}
          />
          {readyDestinations.filter((dest) => !dest.isCanary).length === 0 && <p className="text-xs text-amber-700">برای حالت زنده دست‌کم یک کانال تأییدشده (غیر از مقصد تست) لازم است.</p>}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">چه اتفاق‌هایی در سایت به کانال برسد؟</p>
          <div className="grid gap-2 md:grid-cols-2">
            {EVENT_LABELS.filter((row) => row.group !== 'manual').map((row) => (
              <Toggle key={row.key} checked={rules.autoPublishEventTypes.includes(row.key)} onChange={() => toggleEvent(row.key)} label={row.label} hint={row.hint} />
            ))}
          </div>
          <p className="text-xs text-gray-500">مقاله بلاگ و صفحه CMS فعلاً با ارسال دستی می‌روند. تغییر موجودی همیشه طبق «رفتار ناموجودی» پایین رسیدگی می‌شود.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {([['RETAIL', 'retailOosPolicy'], ['WHOLESALE', 'wholesaleOosPolicy']] as Array<[Channel, 'retailOosPolicy' | 'wholesaleOosPolicy']>).map(([ch, key]) => (
            <div key={ch} className="space-y-2">
              <p className="text-sm font-medium">وقتی موجودی کانال {channelLabel(ch)} تمام شد</p>
              <RadioCards<OosPolicy>
                name={`oos-${ch}`}
                value={rules[key]}
                onChange={(value) => setRules((current) => ({ ...current, [key]: value }))}
                columns={3}
                options={[
                  { value: 'UPDATE', title: 'پست بماند', hint: 'ویرایش‌های بعدی هم اعمال می‌شود.' },
                  { value: 'HIDE', title: 'متن «ناموجود»', hint: 'پست به یک خط ناموجود تغییر می‌کند؛ با شارژ برمی‌گردد.' },
                  { value: 'DELETE', title: 'حذف پست', hint: 'پست پاک می‌شود؛ با شارژ دوباره ارسال می‌شود.' },
                ]}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">وقتی محصول از سایت حذف یا مخفی شد</p>
          <RadioCards<WithdrawAction>
            name="withdraw"
            value={rules.withdrawAction}
            onChange={(withdrawAction) => setRules((current) => ({ ...current, withdrawAction }))}
            columns={2}
            options={[
              { value: 'DELETE', title: 'پست از کانال حذف شود', hint: 'کانال همیشه با سایت یکی می‌ماند.', badge: 'پیشنهادی', tone: 'ok' },
              { value: 'KEEP', title: 'پست بماند', hint: 'فقط دیگر ویرایش نمی‌شود.' },
            ]}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">ریتم ارسال</p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm space-y-1 rounded-xl border p-3">
              <span className="block font-medium">سقف پست جدید در روز</span>
              <span className="block text-xs text-gray-500">پس از این تعداد، بقیه به فردا می‌ماند (ویرایش و حذف شمرده نمی‌شود).</span>
              <input type="number" min={1} max={200} className="border rounded-lg px-3 py-2 text-sm w-full" value={rules.autoDailyCap} onChange={(e) => setRules((current) => ({ ...current, autoDailyCap: Math.max(1, Math.min(200, Number(e.target.value) || 1)) }))} />
            </label>
            <label className="text-sm space-y-1 rounded-xl border p-3">
              <span className="block font-medium">فاصله بین دو پست</span>
              <span className="block text-xs text-gray-500">جلوی رگبار پست هنگام ثبت گروهی محصول را می‌گیرد.</span>
              <select className="border rounded-lg px-3 py-2 text-sm w-full" value={rules.autoMinGapSeconds} onChange={(e) => setRules((current) => ({ ...current, autoMinGapSeconds: Number(e.target.value) }))}>
                {GAP_OPTIONS.map((seconds) => <option key={seconds} value={seconds}>{gapLabel(seconds)}</option>)}
              </select>
            </label>
            <div className="text-sm space-y-1 rounded-xl border p-3">
              <span className="block font-medium">ساعت سکوت (وقت تهران)</span>
              <span className="block text-xs text-gray-500">در این بازه پستی نمی‌رود و به پایان سکوت موکول می‌شود.</span>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={rules.quietStartHour != null} onChange={(e) => setRules((current) => ({ ...current, quietStartHour: e.target.checked ? 23 : null, quietEndHour: e.target.checked ? 9 : null }))} />
                فعال
              </label>
              {rules.quietStartHour != null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs">از</span>
                  <select className="border rounded-lg px-2 py-1 text-sm" value={rules.quietStartHour} onChange={(e) => setRules((current) => ({ ...current, quietStartHour: Number(e.target.value) }))}>
                    {HOURS.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
                  </select>
                  <span className="text-xs">تا</span>
                  <select className="border rounded-lg px-2 py-1 text-sm" value={rules.quietEndHour ?? 9} onChange={(e) => setRules((current) => ({ ...current, quietEndHour: Number(e.target.value) }))}>
                    {HOURS.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <details className="rounded-xl border p-3">
          <summary className="text-sm font-medium cursor-pointer">تنظیمات فنی (پیشرفته)</summary>
          <div className="grid gap-3 md:grid-cols-2 mt-3">
            <label className="text-sm space-y-1">
              <span className="block">مهلت تلاش مجدد پس از خطا (ثانیه)</span>
              <input type="number" min={60} max={86400} className="border rounded-lg px-3 py-2 text-sm w-full" value={rules.retrySlaSeconds} onChange={(e) => setRules((current) => ({ ...current, retrySlaSeconds: Number(e.target.value) }))} />
            </label>
            <label className="text-sm space-y-1">
              <span className="block">نگهداری تاریخچه صف (روز)</span>
              <input type="number" min={7} max={365} className="border rounded-lg px-3 py-2 text-sm w-full" value={rules.outboxRetentionDays} onChange={(e) => setRules((current) => ({ ...current, outboxRetentionDays: Number(e.target.value) }))} />
            </label>
          </div>
        </details>
      </div>
    </Section>
  );

  const checklist: Array<{ label: string; ok: boolean; detail: string }> = [
    { label: 'ربات فعال', ok: activeConnections.length > 0, detail: activeConnections.length ? summarizeBots(activeConnections) : 'مرحله ۱ را کامل کنید' },
    { label: 'مقصد تأییدشده', ok: readyDestinations.length > 0, detail: readyDestinations.length ? readyDestinations.map((dest) => dest.displayName).join('، ') : 'مرحله ۲: دسترسی ربات را بررسی کنید' },
    { label: 'مقصد تست (canary)', ok: Boolean(canaryByChannel('RETAIL') || canaryByChannel('WHOLESALE')), detail: [canaryByChannel('RETAIL')?.displayName, canaryByChannel('WHOLESALE')?.displayName].filter(Boolean).join('، ') || 'یک مقصد را به‌عنوان تست انتخاب کنید' },
    { label: 'قالب تکی و عمده', ok: templatesReady, detail: templatesReady ? 'ذخیره شده' : 'مرحله ۳ را برای هر دو کانال ذخیره کنید' },
    { label: 'پرچم‌های سرور', ok: flagsOn, detail: flagsOn ? 'کانکتور و انتشار خودکار روشن' : `کانکتور ${status?.connectors ? 'روشن' : 'خاموش'} · انتشار خودکار ${status?.autoPublish ? 'روشن' : 'خاموش'} (تنظیم سرور)` },
  ];
  const canGoLive = checklist.every((row) => row.ok) && readyDestinations.some((dest) => !dest.isCanary);

  const previewInfo = providerInfo(previewProvider);
  const previewRendered = preview?.rendered ? platformRendered(preview.rendered, previewInfo) : null;
  const previewSwitch = (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500">{targetProvider ? `مقصد انتخابی در ${providerLabel(targetProvider)} است` : 'پیش‌نمایش در'}</span>
      <ProviderTabs value={previewProvider} onChange={setPreviewProvider} active={activeProviders.length ? activeProviders : ['TELEGRAM']} size="xs" />
    </div>
  );

  const activatePanel = (
    <Section title="۵. تست و فعال‌سازی" description="اول یک محصول واقعی را به مقصد تست بفرستید و شکل پست را در همان پیام‌رسان ببینید؛ بعد حالت خودکار را روشن کنید.">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <ul className="rounded-xl border divide-y">
            {checklist.map((row) => (
              <li key={row.label} className="flex items-start gap-3 p-3 text-sm">
                <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${row.ok ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-800'}`}>{row.ok ? '✓' : '!'}</span>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{row.label}</p>
                  <p className="text-xs text-gray-500 truncate">{row.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border p-3 space-y-2">
            <p className="text-sm font-medium">پست آزمایشی با محصول واقعی</p>
            <div className="flex flex-wrap gap-2">
              <select className="border rounded-lg px-3 py-2 text-sm" value={pubChannel} onChange={(e) => setPubChannel(e.target.value as Channel)}>
                <option value="RETAIL">تکی</option>
                <option value="WHOLESALE">عمده</option>
              </select>
              <input className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[12rem]" placeholder="کد، اسلاگ یا لینک محصول" value={sourceId} onChange={(e) => { setSourceId(e.target.value); setSourceType('PRODUCT'); }} />
              <select className="border rounded-lg px-3 py-2 text-sm" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                {readyByChannel(pubChannel).length === 0 && <option value="">مقصد آماده‌ای برای {channelLabel(pubChannel)} نیست</option>}
                {readyByChannel(pubChannel).map((dest) => <option key={dest.id} value={dest.id}>{providerLabel(providerOf(dest))} · {dest.displayName}{dest.isCanary ? ' (تست)' : ''}</option>)}
              </select>
              <button type="button" className="btn btn-secondary btn-sm" disabled={!sourceId.trim() || busy === 'preview'} onClick={doPreview}>پیش‌نمایش</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={!sourceId.trim() || !targetId || busy === 'send'} onClick={() => doSend(targetId)}>ارسال آزمایشی</button>
            </div>
          </div>
          <div className="rounded-xl border p-3 space-y-2">
            <p className="text-sm font-medium">حالت فعلی: <Badge tone={mode === 'LIVE' ? 'ok' : mode === 'CANARY' ? 'info' : 'off'}>{modeLabel(mode)}</Badge></p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary btn-sm" disabled={mode === 'CANARY' || busy.startsWith('mode-') || !Boolean(canaryByChannel('RETAIL') || canaryByChannel('WHOLESALE'))} onClick={() => setMode('CANARY')}>فعال‌سازی آزمایشی</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={mode === 'LIVE' || busy.startsWith('mode-') || !canGoLive} onClick={() => { if (window.confirm('از این لحظه هر محصول جدید یا تغییر قیمت طبق قواعد به کانال‌های واقعی می‌رود. ادامه می‌دهید؟')) void setMode('LIVE'); }}>فعال‌سازی زنده</button>
              <button type="button" className="text-xs text-red-600 underline cursor-pointer" disabled={mode === 'OFF' || busy.startsWith('mode-')} onClick={() => setMode('OFF')}>خاموش‌کردن انتشار خودکار</button>
            </div>
            {!canGoLive && mode !== 'LIVE' && <p className="text-xs text-amber-700">برای زنده‌شدن همه موارد چک‌لیست و دست‌کم یک کانال تأییدشده غیر از مقصد تست لازم است.</p>}
            {!flagsOn && <Callout tone="warn">پرچم‌های سرور (OMNICHANNEL_CONNECTORS_ENABLED / OMNICHANNEL_AUTO_PUBLISH) باید توسط مدیر سرور روشن باشند؛ بدون آن حتی حالت زنده پستی نمی‌فرستد.</Callout>}
          </div>
        </div>
        <div className="space-y-2">
          {preview?.rendered ? (
            <>
              {previewSwitch}
              <TelegramPreview provider={previewProvider} rendered={previewRendered} title={`پیش‌نمایش ${providerLabel(previewProvider)} — ${String(preview.projection?.name || sourceId)}`} />
              {preview.projection?.publishable === false && <Callout tone="danger">{String(preview.projection?.rejectReason || 'این محصول در این کانال قابل انتشار نیست')}</Callout>}
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">جزئیات فنی</summary>
                <pre className="mt-2 bg-gray-50 p-3 rounded-lg overflow-auto max-h-64 text-gray-700" dir="ltr">{JSON.stringify(preview.projection, null, 2)}</pre>
              </details>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-gray-400 min-h-[18rem] flex items-center justify-center">کد یک محصول را وارد کنید و «پیش‌نمایش» را بزنید تا پست واقعی را همین‌جا ببینید.</div>
          )}
        </div>
      </div>
    </Section>
  );

  const publishView = (
    <>
      <Section title="ارسال دستی" description="برای مواردی که نمی‌خواهید منتظر رویداد خودکار بمانید: یک محصول، مقاله یا صفحه را انتخاب کنید و به یک مقصد یا طبق قواعد خودکار بفرستید.">
        <div className="flex flex-wrap gap-2">
          <select className="border rounded-lg px-3 py-2 text-sm" value={pubChannel} onChange={(e) => setPubChannel(e.target.value as Channel)}>
            <option value="RETAIL">تکی</option>
            <option value="WHOLESALE">عمده</option>
          </select>
          <select className="border rounded-lg px-3 py-2 text-sm" value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}>
            <option value="PRODUCT">محصول</option>
            <option value="BLOG_POST">مقاله بلاگ</option>
            <option value="CMS_PAGE">صفحه CMS</option>
          </select>
          <input className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[14rem]" placeholder={sourceType === 'PRODUCT' ? 'کد، اسلاگ یا لینک محصول' : 'شناسه یا اسلاگ'} value={sourceId} onChange={(e) => setSourceId(e.target.value)} />
          <select className="border rounded-lg px-3 py-2 text-sm" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">طبق قواعد خودکار ({mode === 'LIVE' ? 'همه کانال‌های تأییدشده' : 'فقط مقصد تست'})</option>
            {readyByChannel(pubChannel).map((dest) => <option key={dest.id} value={dest.id}>{providerLabel(providerOf(dest))} · {dest.displayName}{dest.isCanary ? ' (تست)' : ''}</option>)}
          </select>
          <input className="border rounded-lg px-3 py-2 text-sm w-44" placeholder="دلیل (برای حسابرسی)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="button" className="btn btn-secondary btn-sm" disabled={!sourceId.trim() || busy === 'preview'} onClick={doPreview}>پیش‌نمایش</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!sourceId.trim() || busy === 'draft'} onClick={() => run('draft', async () => {
            await apiClient.post('/omnichannel/publications', { preview: { channel: pubChannel, sourceType, sourceId }, dryRun: true, reason });
          }, 'خطا در پیش‌نویس', 'پیش‌نویس ثبت شد (به هیچ پیام‌رسانی نرفت)')}>ثبت پیش‌نویس</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!sourceId.trim() || busy === 'send'} onClick={() => doSend(targetId || undefined)}>ارسال</button>
        </div>
        {preview?.rendered && (
          <div className="grid gap-3 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <div className="space-y-2">
              {previewSwitch}
              <TelegramPreview provider={previewProvider} rendered={previewRendered} title={`پیش‌نمایش ${providerLabel(previewProvider)} — ${String(preview.projection?.name || sourceId)}`} />
            </div>
            <div className="space-y-2 text-sm">
              {preview.projection?.publishable === false && <Callout tone="danger">{String(preview.projection?.rejectReason || 'این منبع در این کانال قابل انتشار نیست')}</Callout>}
              {preview.projection?.available === false && <Callout tone="warn">این محصول در این کانال ناموجود است؛ طبق «رفتار ناموجودی» ممکن است ارسال نشود.</Callout>}
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">جزئیات فنی</summary>
                <pre className="mt-2 bg-gray-50 p-3 rounded-lg overflow-auto max-h-64 text-gray-700" dir="ltr">{JSON.stringify(preview.projection, null, 2)}</pre>
              </details>
            </div>
          </div>
        )}
      </Section>

      <Section title="انتشارها" description="هر ردیف یک محصول در یک کانال است؛ زیر آن وضعیت ارسال به هر مقصد را می‌بینید." actions={<button type="button" className="btn btn-secondary btn-sm" disabled={busy === 'reconcile'} onClick={() => run('reconcile', async () => { await apiClient.post('/omnichannel/reconcile', { reason }); }, 'خطا در تطبیق', 'تطبیق انجام شد')}>تطبیق با سایت</button>}>
        {publications.length === 0 ? (
          <Callout tone="info">هنوز انتشاری ثبت نشده. با فعال‌شدن حالت خودکار، محصول‌های جدید خودشان اینجا ظاهر می‌شوند.</Callout>
        ) : (
          <ul className="divide-y rounded-xl border">
            {publications.map((pub) => {
              const st = publicationStatus(pub.status);
              const rows = deliveriesByPub.get(pub.id) || [];
              const name = pub.projection?.name || pub.sourceId;
              return (
                <li key={pub.id} className="p-3 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{name}</span>
                    {pub.projection?.sku && <span className="text-xs text-gray-500 font-mono">#{pub.projection.sku}</span>}
                    <Badge tone="off">{channelLabel(pub.channel)}</Badge>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="text-xs text-gray-400">{relativeTime(pub.createdAt)}</span>
                    <span className="flex-1" />
                    {pub.projection?.url && <a className="text-xs text-primary underline" href={pub.projection.url} target="_blank" rel="noreferrer">صفحه محصول</a>}
                    {pub.status !== 'WITHDRAWN' && (
                      <button type="button" className="text-xs text-red-600 underline cursor-pointer" onClick={() => { if (window.confirm('پست این محصول از کانال‌ها برداشته شود؟')) void run(`withdraw-${pub.id}`, async () => { await apiClient.post(`/omnichannel/publications/${pub.id}/withdraw`, { reason }); }, 'خطا در برداشت', 'برداشته شد'); }}>برداشتن از کانال</button>
                    )}
                  </div>
                  {rows.length > 0 && (
                    <ul className="grid gap-1 md:grid-cols-2">
                      {rows.map((row) => {
                        const ds = deliveryStatus(row.status);
                        const dest = row.destinationId ? destById.get(row.destinationId) : undefined;
                        return (
                          <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-xs">
                            {dest && <ProviderChip provider={providerOf(dest)} />}
                            <span className="font-medium">{dest?.displayName || 'مقصد حذف‌شده'}</span>
                            <span className="text-gray-500">{actionLabel(row.action)}</span>
                            <Badge tone={ds.tone}>{ds.label}</Badge>
                            {row.lastError && <span className="text-red-700 truncate max-w-[16rem]" title={row.lastError}>{errorLabel(row.lastError)}</span>}
                            {row.nextAttemptAt && (row.status === 'RETRY' || row.status === 'PENDING') && <span className="text-gray-400">تلاش بعدی {relativeTime(row.nextAttemptAt)}</span>}
                            <span className="flex-1" />
                            {(row.status === 'DEAD' || row.status === 'FAILED') && (
                              <button type="button" className="text-primary underline cursor-pointer" onClick={() => run(`retry-${row.id}`, async () => { await apiClient.post(`/omnichannel/deliveries/${row.id}/retry`, { reason }); }, 'خطا در تلاش مجدد', 'دوباره به صف رفت')}>تلاش دوباره</button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );

  const opsView = (
    <>
      <Section title="صف رویدادها" description="هر تغییر سایت اول به این صف می‌آید و ورکر آن را به کانال می‌رساند. تأخیر «موکول‌شده» یعنی فاصله بین پست یا ساعت سکوت.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="p-2 text-right font-medium">رویداد</th>
                <th className="p-2 text-right font-medium">کانال</th>
                <th className="p-2 text-right font-medium">وضعیت</th>
                <th className="p-2 text-right font-medium">تلاش</th>
                <th className="p-2 text-right font-medium">زمان اجرا</th>
                <th className="p-2 text-right font-medium">خطا</th>
              </tr>
            </thead>
            <tbody>
              {outbox.map((row) => {
                const st = outboxStatus(row.status);
                const deferred = row.status === 'PENDING' && row.availableAt && new Date(row.availableAt).getTime() > Date.now() + 5_000;
                return (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{row.eventType === 'publication.deliver_requested' ? 'ارسال به کانال' : row.eventType === 'product.stock_changed' ? 'تغییر موجودی' : eventLabel(row.eventType)}</td>
                    <td className="p-2">{channelLabel(row.channel)}</td>
                    <td className="p-2"><Badge tone={st.tone}>{deferred ? 'موکول‌شده' : st.label}</Badge></td>
                    <td className="p-2">{faNumber(row.attempts)}</td>
                    <td className="p-2 text-xs text-gray-500">{deferred ? relativeTime(row.availableAt) : relativeTime(row.createdAt)}</td>
                    <td className="p-2 text-xs text-red-700 max-w-[18rem] truncate" title={row.lastError || ''}>{row.lastError ? errorLabel(row.lastError) : '—'}</td>
                  </tr>
                );
              })}
              {outbox.length === 0 && <tr><td className="p-3 text-gray-400" colSpan={6}>رویدادی در صف نیست</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="متن جایگزین عکس‌ها (alt)" description="برای دسترس‌پذیری و سئو؛ روی پست پیام‌رسان‌ها اثری ندارد.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="p-2 text-right font-medium">آدرس</th>
                <th className="p-2 text-right font-medium">مالک</th>
                <th className="p-2 text-right font-medium">متن جایگزین</th>
              </tr>
            </thead>
            <tbody>
              {media.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2 font-mono text-xs break-all" dir="ltr">{row.publicUrl}</td>
                  <td className="p-2">{row.ownerType}</td>
                  <td className="p-2">
                    <input className="border rounded-lg px-2 py-1 text-sm w-full" defaultValue={row.altText} onBlur={(e) => {
                      const altText = e.target.value.trim();
                      if (altText === row.altText) return;
                      void run(`alt-${row.id}`, async () => { await apiClient.patch(`/omnichannel/media/${row.id}`, { altText }); }, 'خطا در ذخیره alt');
                    }} />
                  </td>
                </tr>
              ))}
              {media.length === 0 && <tr><td className="p-3 text-gray-400" colSpan={3}>رجیستری رسانه خالی است</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="حسابرسی" description="هر تغییر تنظیمات یا ارسال با نام کاربر و دلیل ثبت می‌شود.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="p-2 text-right font-medium">عمل</th>
                <th className="p-2 text-right font-medium">کاربر</th>
                <th className="p-2 text-right font-medium">کانال</th>
                <th className="p-2 text-right font-medium">دلیل</th>
                <th className="p-2 text-right font-medium">زمان</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{row.action}</td>
                  <td className="p-2 font-mono text-xs">{row.actorId}</td>
                  <td className="p-2">{channelLabel(row.channel)}</td>
                  <td className="p-2 text-xs text-gray-500">{row.reason || '—'}</td>
                  <td className="p-2 text-xs text-gray-400">{relativeTime(row.createdAt)}</td>
                </tr>
              ))}
              {audits.length === 0 && <tr><td className="p-3 text-gray-400" colSpan={5}>رکورد حسابرسی نیست</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );

  /* ---------- page ---------- */

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            کانال‌های انتشار
            <Badge tone={mode === 'LIVE' ? 'ok' : mode === 'CANARY' ? 'info' : 'off'}>خودکار: {modeLabel(mode)}</Badge>
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl leading-6">
            یک‌بار ربات، کانال، شکل پست و قواعد را تنظیم کنید؛ بعد از آن هر محصول جدید، تغییر قیمت یا ناموجودی خودش به کانال‌های تلگرام، بله و روبیکا می‌رسد. پیام‌رسان فقط ویترین است؛ موجودی و قیمت از سایت می‌آید.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>تازه‌سازی</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="ربات" value={activeConnections.length ? summarizeBots(activeConnections) : 'ثبت نشده'} hint={status?.connectors ? (providerInfos.some((info) => !info.enabled) ? `کانکتور روشن · ${providerInfos.filter((info) => !info.enabled).map((info) => info.label).join('، ')} خاموش` : 'کانکتور روشن') : 'کانکتور سرور خاموش'} tone={activeConnections.length && status?.connectors ? 'ok' : 'warn'} />
        <Metric label="کانال‌های آماده" value={readyDestinations.length ? readyDestinations.map((dest) => dest.displayName).join('، ') : 'هیچ'} hint={unverified.length ? `${faNumber(unverified.length)} مقصد تأییدنشده` : 'همه تأیید شده'} tone={readyDestinations.length ? (unverified.length ? 'warn' : 'ok') : 'warn'} />
        <Metric label="پست‌های امروز" value={`${faNumber(sentToday)} از ${faNumber(status?.autoDailyCap ?? 20)}`} hint={failing ? `${faNumber(failing)} ارسال ناموفق` : 'بدون خطا'} tone={failing ? 'danger' : 'ok'} />
        <Metric label="صف" value={`${faNumber(status?.outbox?.pending ?? 0)} در انتظار`} hint={status?.outbox?.dead ? `${faNumber(status.outbox.dead)} متوقف` : status?.outbox?.oldestPendingAgeSec ? `قدیمی‌ترین ${faNumber(status.outbox.oldestPendingAgeSec)} ثانیه` : 'روان'} tone={status?.outbox?.dead ? 'danger' : 'ok'} />
      </div>

      {error && <Callout tone="danger">{error}</Callout>}
      {notice && <Callout tone="ok">{notice}</Callout>}

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit" role="tablist" aria-label="بخش‌ها">
        {([['setup', 'راه‌اندازی'], ['publish', 'انتشارها'], ['ops', 'عملیات']] as Array<[View, string]>).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={`px-4 py-1.5 rounded-lg text-sm cursor-pointer ${view === id ? 'bg-white shadow-sm font-medium' : 'text-gray-600'}`} onClick={() => setView(id)}>
            {label}
            {id === 'publish' && failing > 0 && <span className="mr-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">{faNumber(failing)}</span>}
          </button>
        ))}
      </div>

      {view === 'setup' && (
        <>
          <Stepper steps={steps} current={currentStep} onSelect={setStep} />
          {currentStep === 'bot' && botPanel}
          {currentStep === 'channels' && channelsPanel}
          {currentStep === 'template' && templatePanel}
          {currentStep === 'rules' && rulesPanel}
          {currentStep === 'activate' && activatePanel}
          <div className="flex justify-between">
            <button type="button" className="btn btn-secondary btn-sm" disabled={currentStep === 'bot'} onClick={() => setStep(steps[Math.max(0, steps.findIndex((row) => row.id === currentStep) - 1)].id)}>مرحله قبل</button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={currentStep === 'activate'} onClick={() => setStep(steps[Math.min(steps.length - 1, steps.findIndex((row) => row.id === currentStep) + 1)].id)}>مرحله بعد</button>
          </div>
        </>
      )}
      {view === 'publish' && publishView}
      {view === 'ops' && opsView}
    </div>
  );
}
