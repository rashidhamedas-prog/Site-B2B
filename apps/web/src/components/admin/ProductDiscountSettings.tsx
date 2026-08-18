'use client';

export type ProductDiscountType = 'PERCENT' | 'FIXED';

export interface ProductDiscountSettingsValue {
  wholesaleIsDiscounted: boolean;
  wholesaleDiscountType: ProductDiscountType;
  wholesaleDiscountPercent: string;
  wholesaleDiscountAmount: string;
  wholesaleDiscountStartsAt: string;
  wholesaleDiscountEndsAt: string;
  retailIsDiscounted: boolean;
  retailDiscountType: ProductDiscountType;
  retailDiscountPercent: string;
  retailDiscountAmount: string;
  retailDiscountStartsAt: string;
  retailDiscountEndsAt: string;
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

/** Preview helper: final toman from original/base. Null if the sale cannot apply. */
export function computeSaleFinalToman(
  base: number,
  type: ProductDiscountType,
  percent: number,
  amountToman: number
): number | null {
  if (type === 'PERCENT') return previewPercent(base, percent);
  return previewFixed(base, amountToman)?.final ?? null;
}

export function validateChannelDiscount(opts: {
  enabled: boolean;
  type: ProductDiscountType;
  percent: string;
  amountToman: string;
  baseToman: number;
  label: string;
}): string | null {
  if (!opts.enabled) return null;
  if (!(opts.baseToman > 0)) {
    return `برای تخفیف ${opts.label} ابتدا قیمت اصلی را وارد کنید`;
  }
  if (opts.type === 'PERCENT') {
    const pct = Number(opts.percent);
    if (!Number.isFinite(pct) || pct < 1 || pct > 99) {
      return `درصد تخفیف ${opts.label} باید بین ۱ تا ۹۹ باشد`;
    }
    if (previewPercent(opts.baseToman, pct) == null) {
      return `درصد تخفیف ${opts.label} باید بین ۱ تا ۹۹ باشد`;
    }
    return null;
  }
  const amt = Number(opts.amountToman);
  if (!Number.isFinite(amt) || amt <= 0 || amt >= opts.baseToman) {
    return `مبلغ تخفیف ثابت ${opts.label} باید از قیمت اصلی کمتر باشد`;
  }
  return null;
}

function isExpired(endsAt: string): boolean {
  if (!endsAt) return false;
  const end = new Date(endsAt);
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

function ChannelPreview({
  enabled,
  base,
  type,
  percent,
  amount,
}: {
  enabled: boolean;
  base: number;
  type: ProductDiscountType;
  percent: number;
  amount: number;
}) {
  if (!enabled) {
    return (
      <p className="text-[11px] text-gray-400">تخفیف این کانال خاموش است — قیمت اصلی ذخیره می‌شود.</p>
    );
  }
  if (!(base > 0)) {
    return <p className="text-[11px] text-gray-400">قیمت اصلی وارد نشده</p>;
  }
  if (type === 'PERCENT') {
    const final = previewPercent(base, percent);
    return (
      <p className="text-[11px] text-gray-600">
        پایه {formatToman(base)}
        {final != null ? ` → نهایی ${formatToman(final)}` : ' — درصد را بین ۱ تا ۹۹ بگذارید'}
      </p>
    );
  }
  const fixed = previewFixed(base, amount);
  if (!fixed) {
    return (
      <p className="text-[11px] text-amber-700">
        مبلغ ثابت باید از پایه ({formatToman(base)}) کمتر باشد
      </p>
    );
  }
  return (
    <p className="text-[11px] text-gray-600">
      پایه {formatToman(base)} → نهایی {formatToman(fixed.final)} (معادل {fixed.percent}٪)
    </p>
  );
}

function ChannelDiscountBlock({
  title,
  enabledKey,
  typeKey,
  percentKey,
  amountKey,
  startsKey,
  endsKey,
  value,
  onChange,
  baseToman,
}: {
  title: string;
  enabledKey: 'wholesaleIsDiscounted' | 'retailIsDiscounted';
  typeKey: 'wholesaleDiscountType' | 'retailDiscountType';
  percentKey: 'wholesaleDiscountPercent' | 'retailDiscountPercent';
  amountKey: 'wholesaleDiscountAmount' | 'retailDiscountAmount';
  startsKey: 'wholesaleDiscountStartsAt' | 'retailDiscountStartsAt';
  endsKey: 'wholesaleDiscountEndsAt' | 'retailDiscountEndsAt';
  value: ProductDiscountSettingsValue;
  onChange: (patch: Partial<ProductDiscountSettingsValue>) => void;
  baseToman: number;
}) {
  const enabled = value[enabledKey];
  const type = value[typeKey];
  const percent = value[percentKey];
  const amount = value[amountKey];
  const startsAt = value[startsKey];
  const endsAt = value[endsKey];
  const expired = enabled && isExpired(endsAt);

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange({ [enabledKey]: e.target.checked })}
          className="rounded"
        />
        <span className="text-sm font-semibold text-amber-900">{title}</span>
      </label>

      {expired ? (
        <p className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-amber-800">
          بازه تخفیف منقضی شده است. داده‌ها حفظ می‌شوند تا در صورت نیاز تاریخ را تمدید کنید.
        </p>
      ) : null}

      {enabled ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">نوع تخفیف</label>
              <select
                value={type}
                onChange={(e) =>
                  onChange({ [typeKey]: e.target.value as ProductDiscountType })
                }
                className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
              >
                <option value="PERCENT">درصدی</option>
                <option value="FIXED">مبلغ ثابت</option>
              </select>
            </div>

            {type === 'PERCENT' ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  درصد تخفیف (۱ تا ۹۹)
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={percent}
                  onChange={(e) => onChange({ [percentKey]: e.target.value })}
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
                  value={amount}
                  onChange={(e) => onChange({ [amountKey]: e.target.value })}
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
                value={startsAt}
                onChange={(e) => onChange({ [startsKey]: e.target.value })}
                className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">پایان تخفیف</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => onChange({ [endsKey]: e.target.value })}
                className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
              />
            </div>
          </div>
        </>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
        <ChannelPreview
          enabled={enabled}
          base={baseToman}
          type={type}
          percent={Number(percent)}
          amount={Number(amount)}
        />
      </div>
    </div>
  );
}

export function ProductDiscountSettings({
  value,
  onChange,
  wholesaleBaseToman,
  retailBaseToman,
}: ProductDiscountSettingsProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-800">تخفیف مستقل هر کانال</p>
      <p className="text-[11px] text-gray-500">
        عمده و تکی جدا هستند. می‌توانید فقط یکی، هر دو با درصد متفاوت، یا هیچ‌کدام را فعال کنید. قیمت
        اصلی در فرم همان پایه است؛ قیمت نهایی را سرور حساب می‌کند.
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChannelDiscountBlock
          title="تخفیف عمده‌فروشی"
          enabledKey="wholesaleIsDiscounted"
          typeKey="wholesaleDiscountType"
          percentKey="wholesaleDiscountPercent"
          amountKey="wholesaleDiscountAmount"
          startsKey="wholesaleDiscountStartsAt"
          endsKey="wholesaleDiscountEndsAt"
          value={value}
          onChange={onChange}
          baseToman={wholesaleBaseToman}
        />
        <ChannelDiscountBlock
          title="تخفیف تک‌فروشی"
          enabledKey="retailIsDiscounted"
          typeKey="retailDiscountType"
          percentKey="retailDiscountPercent"
          amountKey="retailDiscountAmount"
          startsKey="retailDiscountStartsAt"
          endsKey="retailDiscountEndsAt"
          value={value}
          onChange={onChange}
          baseToman={retailBaseToman}
        />
      </div>
    </div>
  );
}
