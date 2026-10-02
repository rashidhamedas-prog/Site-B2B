export const APPLY_FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'select',
  'phone',
  'national_id',
  'checkbox',
] as const;

export type ApplyFormFieldType = (typeof APPLY_FORM_FIELD_TYPES)[number];

export type ApplyFormFieldOption = { value: string; label: string };

export type ApplyFormField = {
  key: string;
  enabled: boolean;
  required: boolean;
  label: string;
  order: number;
  type: ApplyFormFieldType;
  options?: ApplyFormFieldOption[];
  maxLength?: number;
  locked?: boolean;
};

export const LOCKED_APPLY_FORM_KEYS = ['displayName', 'phone', 'acceptTerms'] as const;

export const DEFAULT_APPLY_FORM_FIELDS: ApplyFormField[] = [
  {
    key: 'displayName',
    enabled: true,
    required: true,
    label: 'نام نمایشی',
    order: 10,
    type: 'text',
    maxLength: 80,
    locked: true,
  },
  {
    key: 'phone',
    enabled: true,
    required: true,
    label: 'شماره موبایل',
    order: 20,
    type: 'phone',
    maxLength: 11,
    locked: true,
  },
  {
    key: 'province',
    enabled: true,
    required: true,
    label: 'استان',
    order: 30,
    type: 'text',
    maxLength: 80,
  },
  {
    key: 'city',
    enabled: true,
    required: true,
    label: 'شهر',
    order: 40,
    type: 'text',
    maxLength: 80,
  },
  {
    key: 'nationalId',
    enabled: true,
    required: true,
    label: 'کد ملی',
    order: 50,
    type: 'national_id',
    maxLength: 10,
  },
  {
    key: 'salesExperience',
    enabled: true,
    required: true,
    label: 'سابقه فروش',
    order: 60,
    type: 'select',
    options: [
      { value: 'none', label: 'تازه‌کار' },
      { value: 'under_1y', label: 'کمتر از ۱ سال' },
      { value: '1_to_3y', label: '۱ تا ۳ سال' },
      { value: 'over_3y', label: 'بیش از ۳ سال' },
    ],
  },
  {
    key: 'primaryChannel',
    enabled: true,
    required: true,
    label: 'کانال اصلی فروش',
    order: 70,
    type: 'select',
    options: [
      { value: 'instagram', label: 'اینستاگرام' },
      { value: 'telegram', label: 'تلگرام' },
      { value: 'in_person', label: 'حضوری' },
      { value: 'website', label: 'سایت' },
      { value: 'other', label: 'سایر' },
    ],
  },
  {
    key: 'instagram',
    enabled: true,
    required: false,
    label: 'آیدی اینستاگرام',
    order: 80,
    type: 'text',
    maxLength: 80,
  },
  {
    key: 'telegram',
    enabled: true,
    required: false,
    label: 'آیدی تلگرام',
    order: 90,
    type: 'text',
    maxLength: 80,
  },
  {
    key: 'referrer',
    enabled: true,
    required: false,
    label: 'معرفی‌کننده',
    order: 100,
    type: 'text',
    maxLength: 120,
  },
  {
    key: 'motivation',
    enabled: true,
    required: true,
    label: 'چرا همکاری؟',
    order: 110,
    type: 'textarea',
    maxLength: 500,
  },
  {
    key: 'acceptTerms',
    enabled: true,
    required: true,
    label: 'پذیرش شرایط همکاری',
    order: 120,
    type: 'checkbox',
    locked: true,
  },
];

const MAX_CUSTOM_FIELDS = 12;
const CUSTOM_KEY_RE = /^custom_[a-z0-9_]{2,32}$/;

function isFieldType(value: unknown): value is ApplyFormFieldType {
  return typeof value === 'string' && (APPLY_FORM_FIELD_TYPES as readonly string[]).includes(value);
}

function normalizeOptions(raw: unknown): ApplyFormFieldOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const options = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const value = String(row.value ?? '').trim().slice(0, 40);
      const label = String(row.label ?? '').trim().slice(0, 80);
      if (!value || !label) return null;
      return { value, label };
    })
    .filter((item): item is ApplyFormFieldOption => Boolean(item))
    .slice(0, 20);
  return options.length ? options : undefined;
}

function normalizeOneField(raw: unknown, fallback?: ApplyFormField): ApplyFormField | null {
  if (!raw || typeof raw !== 'object') return fallback ?? null;
  const row = raw as Record<string, unknown>;
  const keyRaw = String(row.key ?? fallback?.key ?? '').trim();
  const lockedKnown = (LOCKED_APPLY_FORM_KEYS as readonly string[]).includes(keyRaw);
  const isCustom = CUSTOM_KEY_RE.test(keyRaw);
  if (!lockedKnown && !isCustom && !fallback) return null;
  if (!keyRaw) return null;

  const type = isFieldType(row.type) ? row.type : fallback?.type ?? (isCustom ? 'text' : 'text');
  const locked = lockedKnown || fallback?.locked === true;
  const enabled = locked ? true : row.enabled !== false;
  const required = locked
    ? true
    : row.required === undefined
      ? Boolean(fallback?.required)
      : row.required === true;
  const label = String(row.label ?? fallback?.label ?? keyRaw).trim().slice(0, 80) || keyRaw;
  const order = Number.isFinite(Number(row.order)) ? Math.max(0, Math.min(9999, Math.floor(Number(row.order)))) : (fallback?.order ?? 500);
  const maxLengthRaw = Number(row.maxLength ?? fallback?.maxLength);
  const maxLength = Number.isFinite(maxLengthRaw) ? Math.max(1, Math.min(2000, Math.floor(maxLengthRaw))) : undefined;
  const options = type === 'select' ? normalizeOptions(row.options) ?? fallback?.options : undefined;

  return {
    key: keyRaw,
    enabled,
    required: locked ? true : Boolean(required),
    label,
    order,
    type,
    ...(options ? { options } : {}),
    ...(maxLength ? { maxLength } : {}),
    ...(locked ? { locked: true } : {}),
  };
}

/** Merge admin patch with defaults; locked keys always present and enabled. */
export function resolveApplyFormFields(raw: unknown): ApplyFormField[] {
  const incoming = Array.isArray(raw) ? raw : [];
  const byKey = new Map<string, unknown>();
  for (const item of incoming) {
    if (item && typeof item === 'object' && 'key' in item) {
      byKey.set(String((item as { key: unknown }).key), item);
    }
  }

  const result: ApplyFormField[] = [];
  for (const def of DEFAULT_APPLY_FORM_FIELDS) {
    const merged = normalizeOneField(byKey.get(def.key), def);
    if (merged) {
      result.push(merged);
      byKey.delete(def.key);
    }
  }

  let customCount = 0;
  for (const [key, item] of byKey) {
    if (!CUSTOM_KEY_RE.test(key)) continue;
    if (customCount >= MAX_CUSTOM_FIELDS) break;
    const merged = normalizeOneField(item);
    if (merged) {
      result.push(merged);
      customCount += 1;
    }
  }

  return result.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
}

export function publicApplyFormFields(fields: ApplyFormField[]): ApplyFormField[] {
  return fields
    .filter((f) => f.enabled)
    .map(({ key, required, label, order, type, options, maxLength }) => ({
      key,
      enabled: true,
      required,
      label,
      order,
      type,
      ...(options ? { options } : {}),
      ...(maxLength ? { maxLength } : {}),
    }));
}

/** Map Persian/Arabic-Indic digits then strip non-digits (shared with phone.util). */
function toAsciiDigits(raw: string): string {
  return String(raw || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
}

/** Iranian national ID checksum. Returns null if valid, else Persian error. */
export function validateIranNationalId(raw: string): string | null {
  const code = toAsciiDigits(raw);
  if (!/^\d{10}$/.test(code)) return 'کد ملی باید ۱۰ رقم باشد';
  if (/^(\d)\1{9}$/.test(code)) return 'کد ملی معتبر نیست';
  const check = Number(code[9]);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(code[i]) * (10 - i);
  const rem = sum % 11;
  const ok = rem < 2 ? check === rem : check === 11 - rem;
  return ok ? null : 'کد ملی معتبر نیست';
}

export function maskNationalId(raw: string | null | undefined): string | null {
  const digits = toAsciiDigits(String(raw || ''));
  if (digits.length < 4) return null;
  return `******${digits.slice(-4)}`;
}

export type ApplyAnswersInput = Record<string, unknown>;

export type ValidatedApplyPayload = {
  displayName: string;
  phone: string;
  acceptTerms: boolean;
  answers: Record<string, string | boolean>;
  socialHandles: Record<string, string>;
};

export function validateApplyAnswers(
  fields: ApplyFormField[],
  input: ApplyAnswersInput,
): { ok: true; data: ValidatedApplyPayload } | { ok: false; error: string } {
  const enabled = fields.filter((f) => f.enabled).sort((a, b) => a.order - b.order);
  const answers: Record<string, string | boolean> = {};
  const socialHandles: Record<string, string> = {};
  let displayName = '';
  let phone = '';
  let acceptTerms = false;

  for (const field of enabled) {
    const raw = input[field.key];
    const isEmpty =
      raw === undefined ||
      raw === null ||
      (typeof raw === 'string' && raw.trim() === '') ||
      (field.type === 'checkbox' && raw !== true && raw !== 'true');

    if (field.required && isEmpty) {
      return { ok: false, error: `${field.label} الزامی است` };
    }
    if (isEmpty) continue;

    if (field.type === 'checkbox') {
      const checked = raw === true || raw === 'true';
      if (field.key === 'acceptTerms') {
        acceptTerms = checked;
        if (!checked) return { ok: false, error: 'پذیرش شرایط همکاری لازم است' };
      }
      answers[field.key] = checked;
      continue;
    }

    let value = String(raw).trim();
    const max = field.maxLength ?? (field.type === 'textarea' ? 500 : 120);
    if (value.length > max) {
      return { ok: false, error: `${field.label} طولانی است` };
    }

    if (field.type === 'phone' || field.key === 'phone') {
      const digits = toAsciiDigits(value);
      const normalized = digits.length === 10 && digits.startsWith('9') ? `0${digits}` : digits;
      if (!/^09[0-9]{9}$/.test(normalized)) {
        return { ok: false, error: 'شماره موبایل معتبر نیست' };
      }
      phone = normalized;
      answers.phone = normalized;
      continue;
    }

    if (field.type === 'national_id' || field.key === 'nationalId') {
      const nidError = validateIranNationalId(value);
      if (nidError) return { ok: false, error: nidError };
      value = toAsciiDigits(value);
      answers.nationalId = value;
      continue;
    }

    if (field.type === 'select') {
      const allowed = (field.options || []).map((o) => o.value);
      if (allowed.length && !allowed.includes(value)) {
        return { ok: false, error: `${field.label} نامعتبر است` };
      }
    }

    if (field.key === 'displayName') {
      if (value.length < 2) return { ok: false, error: 'نام نمایشی خیلی کوتاه است' };
      displayName = value.slice(0, 80);
      answers.displayName = displayName;
      continue;
    }

    if (field.key === 'instagram' || field.key === 'telegram') {
      socialHandles[field.key] = value.slice(0, 80);
      answers[field.key] = value.slice(0, 80);
      continue;
    }

    answers[field.key] = value;
  }

  if (!displayName) return { ok: false, error: 'نام نمایشی الزامی است' };
  if (!phone) return { ok: false, error: 'شماره موبایل الزامی است' };
  if (!acceptTerms) return { ok: false, error: 'پذیرش شرایط همکاری لازم است' };

  return {
    ok: true,
    data: { displayName, phone, acceptTerms, answers, socialHandles },
  };
}

export function answersForAdminView(
  answers: Record<string, unknown> | null | undefined,
  fields: ApplyFormField[],
): Array<{ key: string; label: string; value: string }> {
  const map = answers && typeof answers === 'object' ? answers : {};
  const labelByKey = new Map(fields.map((f) => [f.key, f.label]));
  const rows: Array<{ key: string; label: string; value: string }> = [];
  const keys = new Set([...fields.map((f) => f.key), ...Object.keys(map)]);
  for (const key of keys) {
    if (key === 'phone' || key === 'acceptTerms') continue;
    const raw = map[key];
    if (raw === undefined || raw === null || raw === '') continue;
    let value = String(raw);
    if (key === 'nationalId') {
      // admin detail shows full; list uses mask separately
      value = String(raw).replace(/\D/g, '');
    }
    if (typeof raw === 'boolean') value = raw ? 'بله' : 'خیر';
    const field = fields.find((f) => f.key === key);
    if (field?.type === 'select' && field.options) {
      const opt = field.options.find((o) => o.value === String(raw));
      if (opt) value = opt.label;
    }
    rows.push({ key, label: labelByKey.get(key) || key, value });
  }
  return rows;
}
