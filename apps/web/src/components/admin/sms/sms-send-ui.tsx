'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { normalizeTypedCount } from './sms-parts';
import {
  AUDIENCE_SOURCE_OPTIONS,
  CONTINUE_REASON_ID,
  FIELD_LABELS,
  OP_LABELS,
  PREVIEW_DEBOUNCE_MS,
  audienceContinueGate,
  buildCitySegmentRules,
  buildPreviewPanelView,
  buildSegmentPreviewPayload,
  consumeSegmentPreviewFunnel,
  costCaption,
  countManualPhones,
  filterCitySuggestions,
  formatFaNumber,
  matchCityOption,
  optedOutBlacklistTotal,
  parseAudienceFieldValues,
  previewCellText,
  priceCaption,
  sourcesNeedCityWarning,
  type AudienceFieldDef,
  type SegmentFilterRule,
  type SegmentPreviewFunnel,
} from './sms-send-preview';

export {
  PREVIEW_DEBOUNCE_MS,
  AUDIENCE_SOURCE_OPTIONS,
  WIZARD_STEPS,
  CONTINUE_REASON_ID,
  buildCitySegmentRules,
  buildSegmentPreviewPayload,
  buildPreviewPanelView,
  audienceContinueGate,
  canEditUnitPrice,
  consumeSegmentPreviewFunnel,
  countManualPhones,
  formatRecipientPreviewStatus,
  mergeSegmentRules,
  normalizeFaCity,
  parseUnitPriceInput,
  priceCaption,
  sourcesNeedCityWarning,
  visualWizardStep,
  type CitySegmentRule,
  type SegmentFilterRule,
  type SegmentPreviewFunnel,
} from './sms-send-preview';

type SourceCountRow = { source: string; count: number; available: boolean };

export function AudienceSourceSelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [countsError, setCountsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ sources?: SourceCountRow[] }>('/admin/sms/audience/sources')
      .then((row) => {
        if (cancelled) return;
        const next: Record<string, number | null> = {};
        for (const opt of AUDIENCE_SOURCE_OPTIONS) next[opt.id] = null;
        for (const item of row.sources || []) {
          next[item.source] = item.available === false ? null : Number(item.count) || 0;
        }
        setCounts(next);
        setCountsError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCountsError(true);
        setCounts({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <fieldset className="sms-srcs">
      <legend className="sms-srcs-legend">منبع مخاطبان</legend>
      <div className="sms-src-grid">
        {AUDIENCE_SOURCE_OPTIONS.map((source) => {
          const badge =
            countsError || counts[source.id] == null
              ? '—'
              : formatFaNumber(counts[source.id] as number);
          return (
            <label key={source.id} className="sms-src-label">
              <input
                type="checkbox"
                className="sms-src-check"
                checked={value.includes(source.id)}
                onChange={() => {
                  const next = value.includes(source.id)
                    ? value.filter((id) => id !== source.id)
                    : [...value, source.id];
                  onChange(next);
                }}
              />
              <span className="sms-src-text">{source.label}</span>
              <span className="sms-src-badge ltr" aria-label={`شمارش ${source.label}`}>
                {badge}
              </span>
            </label>
          );
        })}
      </div>
      <p className="sms-hint">
        تکراری‌ها یک‌بار ارسال می‌شوند؛ لغو/سیاه همیشه حذف است
      </p>
    </fieldset>
  );
}

export function CityCombobox({
  cities,
  onCities,
  sources,
}: {
  cities: string[];
  onCities: (next: string[]) => void;
  sources: string[];
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Array<{ value: string; count: number | null }>>([]);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const showNa = sourcesNeedCityWarning(sources) && cities.length > 0;

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ fields?: AudienceFieldDef[] }>('/admin/sms/audience/fields')
      .then((row) => {
        if (cancelled) return;
        const cityField = (row.fields || []).find((f) => f.field === 'city');
        setOptions(parseAudienceFieldValues(cityField?.values));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => filterCitySuggestions(options, query), [options, query]);

  const addCity = (raw: string) => {
    const matched = matchCityOption(options, raw);
    if (!matched) return;
    if (cities.some((c) => c === matched)) {
      setQuery('');
      setOpen(false);
      return;
    }
    onCities([...cities, matched]);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="sms-city-box">
      <label className="text-sm font-bold" htmlFor={`${listId}-input`}>
        شهر
      </label>
      <p className="sms-hint">
        فقط روی مشتریان (عمده/خرده‌فروشی) اعمال می‌شود؛ همکار و معرف شهر ندارند
      </p>
      {showNa && (
        <p className="sms-alert sms-alert-warn" role="status">
          فیلتر شهر روی همکار فروش / معرف عمده اعمال نمی‌شود (notApplicable)
        </p>
      )}
      <div className="sms-chip-row">
        {cities.map((city) => (
          <span key={city} className="sms-chip">
            {city}
            <button
              type="button"
              className="sms-chip-x"
              aria-label={`حذف شهر ${city}`}
              onClick={() => onCities(cities.filter((c) => c !== city))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        id={`${listId}-input`}
        className="sms-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        placeholder="جستجوی شهر…"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addCity(query);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && suggestions.length > 0 && (
        <ul id={listId} role="listbox" className="sms-suggest">
          {suggestions.map((opt) => (
            <li key={opt.value} role="option">
              <button
                type="button"
                className="sms-suggest-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addCity(opt.value)}
              >
                <span>{opt.value}</span>
                <span className="ltr sms-hint">
                  {opt.count == null ? '—' : formatFaNumber(opt.count)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type SavedSegment = {
  id: string;
  name: string;
  sources: string[];
  rules: SegmentFilterRule[];
};

export function SegmentBuilder({
  cities,
  onCities,
  sources,
  onSources,
  filterRules,
  onFilterRules,
}: {
  cities: string[];
  onCities: (next: string[]) => void;
  sources: string[];
  onSources: (next: string[]) => void;
  filterRules: SegmentFilterRule[];
  onFilterRules: (next: SegmentFilterRule[]) => void;
}) {
  const [fields, setFields] = useState<AudienceFieldDef[]>([]);
  const [segments, setSegments] = useState<SavedSegment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState('');
  const [saveName, setSaveName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadMeta = () => {
    apiClient
      .get<{ fields?: AudienceFieldDef[] }>('/admin/sms/audience/fields')
      .then((row) => setFields(row.fields || []))
      .catch(() => setFields([]));
    apiClient
      .get<SavedSegment[]>('/admin/sms/segments')
      .then((rows) => setSegments(Array.isArray(rows) ? rows : []))
      .catch(() => setSegments([]));
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const addRule = () => {
    const first = fields[0];
    if (!first) return;
    onFilterRules([
      ...filterRules,
      { field: first.field, op: first.ops[0] || 'in', value: first.ops[0] === 'never' ? null : [] },
    ]);
  };

  const updateRule = (index: number, patch: Partial<SegmentFilterRule>) => {
    onFilterRules(
      filterRules.map((rule, i) => {
        if (i !== index) return rule;
        const next = { ...rule, ...patch };
        if (patch.field) {
          const def = fields.find((f) => f.field === patch.field);
          next.op = def?.ops[0] || 'in';
          next.value = next.op === 'never' ? null : next.op === 'in' || next.op === 'any-in' ? [] : '';
        }
        return next;
      }),
    );
  };

  const saveSegment = async () => {
    const name = saveName.trim();
    if (!name) {
      setMsg('نام سگمنت لازم است');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const rules = [...buildCitySegmentRules(cities), ...filterRules];
      await apiClient.post('/admin/sms/segments', { name, sources, rules });
      setSaveName('');
      setMsg('سگمنت ذخیره شد');
      loadMeta();
    } catch (e: any) {
      setMsg(e?.message || 'ذخیره سگمنت ناموفق');
    } finally {
      setBusy(false);
    }
  };

  const loadSegment = (id: string) => {
    setSelectedSegment(id);
    const row = segments.find((s) => s.id === id);
    if (!row) return;
    onSources(Array.isArray(row.sources) ? row.sources : []);
    const rules = Array.isArray(row.rules) ? row.rules : [];
    const cityRule = rules.find((r) => r.field === 'city' && r.op === 'in');
    const cityValues = Array.isArray(cityRule?.value)
      ? (cityRule!.value as string[]).map(String)
      : [];
    onCities(cityValues);
    onFilterRules(rules.filter((r) => !(r.field === 'city' && r.op === 'in')));
  };

  return (
    <div className="sms-card">
      <div className="sms-card-head">
        <h2 className="sms-h2">فیلترها</h2>
        <label className="sms-inline-label">
          سگمنت ذخیره‌شده
          <select
            className="sms-input sms-input-inline"
            value={selectedSegment}
            onChange={(e) => loadSegment(e.target.value)}
            aria-label="سگمنت ذخیره‌شده"
          >
            <option value="">— بدون —</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="sms-hint">همه شرط‌ها باید برقرار باشند (و). ترکیب «یا» وجود ندارد.</p>
      <CityCombobox cities={cities} onCities={onCities} sources={sources} />
      {filterRules.map((rule, index) => {
        const def = fields.find((f) => f.field === rule.field) || fields[0];
        const ops = def?.ops || ['in'];
        const label = FIELD_LABELS[rule.field] || rule.field;
        return (
          <div key={`${rule.field}-${index}`} className="sms-rule">
            <label className="sr-only" htmlFor={`sms-rule-field-${index}`}>
              فیلد
            </label>
            <select
              id={`sms-rule-field-${index}`}
              className="sms-input"
              aria-label="فیلد"
              value={rule.field}
              onChange={(e) => updateRule(index, { field: e.target.value })}
            >
              {fields.map((f) => (
                <option key={f.field} value={f.field}>
                  {FIELD_LABELS[f.field] || f.field}
                </option>
              ))}
            </select>
            <select
              className="sms-input"
              aria-label="عملگر"
              value={rule.op}
              onChange={(e) => updateRule(index, { op: e.target.value })}
            >
              {ops.map((op) => (
                <option key={op} value={op}>
                  {OP_LABELS[op] || op}
                </option>
              ))}
            </select>
            {rule.op !== 'never' && (
              <input
                className="sms-input"
                aria-label="مقدار"
                value={
                  Array.isArray(rule.value)
                    ? (rule.value as string[]).join('، ')
                    : rule.value == null
                      ? ''
                      : String(rule.value)
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  if (rule.op === 'in' || rule.op === 'any-in') {
                    updateRule(index, {
                      value: raw
                        .split(/[،,]+/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    });
                  } else if (rule.op === 'gte' || rule.op === 'lte' || rule.op === 'withinDays') {
                    updateRule(index, { value: Number(raw) || 0 });
                  } else {
                    updateRule(index, { value: raw });
                  }
                }}
              />
            )}
            <button
              type="button"
              className="sms-btn"
              aria-label={`حذف شرط ${label}`}
              onClick={() => onFilterRules(filterRules.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        );
      })}
      <div className="sms-row">
        <button type="button" className="sms-btn" onClick={addRule}>
          + افزودن شرط
        </button>
        <input
          className="sms-input sms-input-grow"
          placeholder="نام سگمنت جدید"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          aria-label="نام سگمنت جدید"
        />
        <button type="button" className="sms-btn" disabled={busy} onClick={saveSegment}>
          ذخیره به‌عنوان سگمنت
        </button>
      </div>
      <p className="sms-hint">
        برچسب‌ها: <span className="sms-soon">به‌زودی</span>
      </p>
      {msg && (
        <p className="sms-hint" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

export function ManualNumbersField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  return (
    <div className="sms-card">
      <h2 className="sms-h2">شماره‌های دستی</h2>
      <label className="block text-sm font-bold" htmlFor="sms-manual-numbers">
        شماره‌های دستی، یک شماره در هر خط
      </label>
      <textarea
        id="sms-manual-numbers"
        className="sms-input sms-textarea ltr text-left"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="sms-manual-hint"
      />
      <p id="sms-manual-hint" className="sms-hint">
        این شماره‌ها هم از لغو/سیاه و رضایت عبور می‌کنند
      </p>
      <div className="sms-file-row">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/plain"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) {
              setFileName('');
              return;
            }
            setFileName(f.name);
            onChange(await f.text());
          }}
        />
        <button
          type="button"
          className="sms-btn"
          onClick={() => fileRef.current?.click()}
        >
          انتخاب فایل
        </button>
        <span className="sms-hint">{fileName || 'فایلی انتخاب نشده'}</span>
      </div>
    </div>
  );
}

function FunnelRows({
  view,
  manualCount,
}: {
  view: ReturnType<typeof buildPreviewPanelView>;
  manualCount: number;
}) {
  const funnel = view.displayFunnel;
  const has = Boolean(funnel);
  const cell = (n: number | null | undefined) => previewCellText(view.phase, n, has);

  return (
    <dl className={`sms-kv${view.faded ? ' sms-kv-faded' : ''}`} aria-busy={view.phase === 'calculating'}>
      <dt>کل</dt>
      <dd className="ltr">{cell(funnel?.total)}</dd>
      <dt>تکراری</dt>
      <dd className="ltr">{cell(funnel?.duplicates)}</dd>
      <dt>لغو/سیاه</dt>
      <dd className="ltr">{cell(funnel ? optedOutBlacklistTotal(funnel) : null)}</dd>
      <dt>بدون رضایت</dt>
      <dd className="ltr">{cell(funnel?.noConsent)}</dd>
      <dt>نامعتبر</dt>
      <dd className="ltr">{cell(funnel?.invalid)}</dd>
      <dt>شماره‌های دستی</dt>
      <dd className="ltr">{formatFaNumber(manualCount)}</dd>
      <dt>
        <strong>گیرنده نهایی</strong>
      </dt>
      <dd className="ltr sms-kv-final">{cell(funnel?.final)}</dd>
      <dt>پارت هر پیام</dt>
      <dd className="ltr">{cell(funnel?.partsPerMsg)}</dd>
      <dt>کل پارت</dt>
      <dd className="ltr">{cell(funnel?.totalParts)}</dd>
      <dt>هزینه</dt>
      <dd>
        {view.phase === 'calculating' && !funnel
          ? '…'
          : funnel
            ? costCaption(funnel.estimatedCost, funnel.unitPricePerPart)
            : view.phase === 'error'
              ? '—'
              : priceCaption(null)}
      </dd>
    </dl>
  );
}

export function RecipientPreviewPanel({
  sources,
  previewBody,
  messageClass,
  rules = [],
  manualCsv = '',
  onViewChange,
}: {
  sources: string[];
  previewBody: string;
  messageClass: string;
  rules?: SegmentFilterRule[];
  manualCsv?: string;
  onViewChange?: (view: ReturnType<typeof buildPreviewPanelView>) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<SegmentPreviewFunnel | null>(null);
  const [previousFunnel, setPreviousFunnel] = useState<SegmentPreviewFunnel | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const rulesKey = useMemo(() => JSON.stringify(rules), [rules]);
  const manualCount = countManualPhones(manualCsv);

  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!sources.length) {
      abortRef.current?.abort();
      setLoading(false);
      setError(null);
      setFunnel(null);
      return;
    }
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const reqId = ++requestIdRef.current;
      const parsedRules = JSON.parse(rulesKey) as SegmentFilterRule[];
      apiClient
        .post<Partial<SegmentPreviewFunnel>>(
          '/admin/sms/segments/preview',
          buildSegmentPreviewPayload(sources, previewBody, messageClass, parsedRules),
          { signal: controller.signal },
        )
        .then((row) => {
          if (reqId !== requestIdRef.current) return;
          const next = consumeSegmentPreviewFunnel(row);
          setPreviousFunnel((prev) => prev ?? next);
          setFunnel(next);
          setLoading(false);
          setError(null);
        })
        .catch((err: any) => {
          if (controller.signal.aborted || reqId !== requestIdRef.current) return;
          setLoading(false);
          setError(err?.message || 'پیش‌نمایش در دسترس نیست');
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [sources, previewBody, messageClass, rulesKey, retryTick]);

  const view = buildPreviewPanelView({
    sources,
    loading,
    error,
    funnel,
    previousFunnel,
  });

  useEffect(() => {
    onViewChange?.(view);
    // Intentionally depend on phase/final/banner only to avoid parent re-render loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.phase, view.funnel?.final, view.banner, view.zeroReason]);

  return (
    <>
      <aside className="sms-preview-panel sms-card sms-sticky" aria-labelledby="sms-preview-title">
        <h2 id="sms-preview-title" className="sms-h2">
          پیش‌نمایش گیرندگان
        </h2>
        <div role="status" aria-live="polite" aria-atomic="true">
          {view.banner && (
            <p
              className={
                view.bannerTone === 'error'
                  ? 'sms-alert sms-alert-err'
                  : view.bannerTone === 'warn'
                    ? 'sms-alert sms-alert-warn'
                    : 'sms-alert sms-alert-info'
              }
            >
              {view.banner}
              {view.phase === 'error' && (
                <button
                  type="button"
                  className="sms-btn sms-btn-sm"
                  onClick={() => {
                    setError(null);
                    if (funnel) setPreviousFunnel(funnel);
                    setRetryTick((n) => n + 1);
                  }}
                >
                  تلاش مجدد
                </button>
              )}
            </p>
          )}
          <FunnelRows view={view} manualCount={manualCount} />
        </div>
        <p className="sms-hint">اعداد در لحظه ارسال دوباره محاسبه می‌شوند.</p>
      </aside>
      <div className="sms-bottombar" role="status" aria-live="polite">
        <span>
          {view.displayFunnel ? (
            <>
              <b className="ltr">{formatFaNumber(view.displayFunnel.final)}</b> گیرنده ·{' '}
              <span className="ltr">{formatFaNumber(view.displayFunnel.totalParts)}</span> پیامک
            </>
          ) : (
            view.banner || 'پیش‌نمایش'
          )}
        </span>
      </div>
    </>
  );
}

export function AudienceContinueButton({
  phase,
  final,
  manualCount,
  onClick,
}: {
  phase: ReturnType<typeof buildPreviewPanelView>['phase'];
  final: number;
  manualCount: number;
  onClick: () => void;
}) {
  const gate = audienceContinueGate({ phase, final, manualCount });
  return (
    <div className="sms-continue-wrap">
      <button
        type="button"
        className="sms-btn sms-btn-primary"
        aria-disabled={gate.disabled}
        aria-describedby={gate.reason ? CONTINUE_REASON_ID : undefined}
        onClick={() => {
          if (gate.disabled) return;
          onClick();
        }}
      >
        بعدی: متن پیام
      </button>
      {gate.reason && (
        <p id={CONTINUE_REASON_ID} className="sms-hint sms-continue-reason">
          {gate.reason}
        </p>
      )}
    </div>
  );
}

export function ScheduleField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      زمان ارسال (۰۸ تا ۲۱ تهران)
      <input
        type="datetime-local"
        className="sms-input mt-1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function ConfirmDialog({
  count,
  typedCount,
  otp,
  busy,
  onTypedCount,
  onOtp,
  onCancel,
  onConfirm,
}: {
  count: number;
  typedCount: string;
  otp: string;
  busy: boolean;
  onTypedCount: (value: string) => void;
  onOtp: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const typedOk = normalizeTypedCount(typedCount) === count;
  return (
    <div role="alertdialog" aria-modal="true" className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-bold text-red-900">
        برای تأیید، تعداد گیرندگان ({count.toLocaleString('fa-IR')}) را تایپ کنید
      </p>
      <input
        className="mt-2 w-full min-w-0 rounded-lg border px-3 py-2 ltr text-left"
        value={typedCount}
        onChange={(event) => onTypedCount(event.target.value)}
      />
      <input
        className="mt-2 w-full min-w-0 rounded-lg border px-3 py-2 ltr text-left"
        placeholder="کد OTP ادمین"
        value={otp}
        onChange={(event) => onOtp(event.target.value)}
      />
      <div className="sms-wizard-bar mt-3 flex gap-2">
        <button
          type="button"
          autoFocus
          className="min-h-11 rounded-lg border bg-white px-4 text-sm font-bold"
          onClick={onCancel}
        >
          انصراف
        </button>
        <button
          type="button"
          disabled={busy || !typedOk || otp.replace(/\D/g, '').length < 4}
          className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50"
          onClick={onConfirm}
        >
          ارسال برای {count.toLocaleString('fa-IR')} نفر
        </button>
      </div>
    </div>
  );
}
