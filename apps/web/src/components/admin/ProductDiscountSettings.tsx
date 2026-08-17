'use client';

export type ProductDiscountType = 'PERCENT' | 'FIXED';

export interface ProductDiscountSettingsValue {
  discountType: ProductDiscountType;
  discountPercent: string;
  discountAmount: string;
  discountStartsAt: string;
  discountEndsAt: string;
}

interface ProductDiscountSettingsProps {
  value: ProductDiscountSettingsValue;
  onChange: (patch: Partial<ProductDiscountSettingsValue>) => void;
  wholesaleBaseToman: number;
  retailBaseToman: number;
}

function formatToman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${Math.round(n).toLocaleString('fa-IR')} تومان`;
}

function previewPercent(base: number, percent: number): number | null {
  if (!(base > 0) || !(percent >= 1 && percent <= 99)) return null;
  const final = Math.round(base - (base * percent) / 100);
  return final > 0 && final < base ? final : null;
}

function previewFixed(
  base: number,
  amountToman: number
): { final: number; percent: number } | null {
  if (!(base > 0) || !(amountToman > 0) || amountToman >= base) return null;
  const final = Math.round(base - amountToman);
  if (!(final > 0)) return null;
  return { final, percent: Math.round((amountToman / base) * 100) };
}

/** Preview/save helper: final toman from original/base. Null if the sale cannot apply. */
export function computeSaleFinalToman(
  base: number,
  type: ProductDiscountType,
  percent: number,
  amountToman: number
): number | null {
  if (type === 'PERCENT') return previewPercent(base, percent);
  return previewFixed(base, amountToman)?.final ?? null;
}

export function applySaleToChannelToman(
  currentFinal: number,
  compareAt: number,
  type: ProductDiscountType,
  percent: number,
  amountToman: number
): { final: number; compare: number | null } {
  const base = compareAt > 0 ? compareAt : currentFinal;
  const next = computeSaleFinalToman(base, type, percent, amountToman);
  if (next == null) {
    return { final: currentFinal, compare: compareAt > 0 ? compareAt : null };
  }
  return { final: next, compare: base };
}

function isExpired(endsAt: string): boolean {
  if (!endsAt) return false;
  const end = new Date(endsAt);
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

function ChannelPreview({
  label,
  base,
  type,
  percent,
  amount,
}: {
  label: string;
  base: number;
  type: ProductDiscountType;
  percent: number;
  amount: number;
}) {
  if (!(base > 0)) {
    return (
      <p className="text-[11px] text-gray-400">
        {label}: قیمت پایه وارد نشده
      </p>
    );
  }
  if (type === 'PERCENT') {
    const final = previewPercent(base, percent);
    return (
      <p className="text-[11px] text-gray-600">
        {label}: پایه {formatToman(base)}
        {final != null ? ` → نهایی ${formatToman(final)}` : ' — درصد را بین ۱ تا ۹۹ بگذارید'}
      </p>
    );
  }
  const fixed = previewFixed(base, amount);
  if (!fixed) {
    return (
      <p className="text-[11px] text-amber-700">
        {label}: مبلغ ثابت باید از پایه ({formatToman(base)}) کمتر باشد
      </p>
    );
  }
  return (
    <p className="text-[11px] text-gray-600">
      {label}: پایه {formatToman(base)} → نهایی {formatToman(fixed.final)} (معادل {fixed.percent}٪)
    </p>
  );
}

export function ProductDiscountSettings({
  value,
  onChange,
  wholesaleBaseToman,
  retailBaseToman,
}: ProductDiscountSettingsProps) {
  const percent = Number(value.discountPercent);
  const amount = Number(value.discountAmount);
  const expired = isExpired(value.discountEndsAt);

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <p className="text-sm font-semibold text-amber-900">تنظیمات تخفیف</p>
      {expired ? (
        <p className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-amber-800">
          بازه تخفیف منقضی شده است. داده‌ها حفظ می‌شوند تا در صورت نیاز تاریخ را تمدید کنید.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">نوع تخفیف</label>
          <select
            value={value.discountType}
            onChange={(e) =>
              onChange({ discountType: e.target.value as ProductDiscountType })
            }
            className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
          >
            <option value="PERCENT">درصدی</option>
            <option value="FIXED">مبلغ ثابت</option>
          </select>
        </div>

        {value.discountType === 'PERCENT' ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              درصد تخفیف (۱ تا ۹۹)
            </label>
            <input
              type="number"
              min={1}
              max={99}
              value={value.discountPercent}
              onChange={(e) => onChange({ discountPercent: e.target.value })}
              placeholder="۲۰"
              className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              مبلغ تخفیف ثابت (تومان)
            </label>
            <input
              type="number"
              min={1}
              value={value.discountAmount}
              onChange={(e) => onChange({ discountAmount: e.target.value })}
              placeholder="25000"
              className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">شروع تخفیف</label>
          <input
            type="datetime-local"
            value={value.discountStartsAt}
            onChange={(e) => onChange({ discountStartsAt: e.target.value })}
            className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">پایان تخفیف</label>
          <input
            type="datetime-local"
            value={value.discountEndsAt}
            onChange={(e) => onChange({ discountEndsAt: e.target.value })}
            className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
        </div>
      </div>

      <div className="space-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
        <p className="text-[11px] font-medium text-gray-500">
          پیش‌نمایش از قیمت قبل از تخفیف (یا قیمت فعلی). با ذخیره، قیمت نهایی و قیمت قبلی روی محصول نوشته می‌شود.
        </p>
        <ChannelPreview
          label="عمده"
          base={wholesaleBaseToman}
          type={value.discountType}
          percent={percent}
          amount={amount}
        />
        <ChannelPreview
          label="تکی"
          base={retailBaseToman}
          type={value.discountType}
          percent={percent}
          amount={amount}
        />
      </div>
    </div>
  );
}
