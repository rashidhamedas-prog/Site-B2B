'use client';

import { Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SecretField, TextField, ToggleRow } from './fields';
import { SettingsSection } from './primitives';
import type { SettingsPayload } from './types';

export function PaymentTab({
  data,
  showSecret,
  onToggleSecret,
  onChange,
  digipayBusy,
  digipayMsg,
  onTestDigipay,
  torobpayBusy,
  torobpayMsg,
  onTestTorobpay,
}: {
  data: SettingsPayload;
  showSecret: Record<string, boolean>;
  onToggleSecret: (key: string) => void;
  onChange: (next: SettingsPayload) => void;
  digipayBusy: boolean;
  digipayMsg: { ok: boolean; text: string } | null;
  onTestDigipay: () => void;
  torobpayBusy: boolean;
  torobpayMsg: { ok: boolean; text: string } | null;
  onTestTorobpay: () => void;
}) {
  const p = data.payment;
  const set = (patch: Partial<SettingsPayload['payment']>) =>
    onChange({ ...data, payment: { ...p, ...patch } });

  return (
    <div className="space-y-5">
      <SettingsSection title="کلید اصلی پرداخت">
        <ToggleRow label="فعال‌سازی پرداخت آنلاین (کلی)" hint="اگر خاموش باشد هیچ درگاهی کار نمی‌کند" value={p.enabled} onChange={(v) => set({ enabled: v })} />
      </SettingsSection>
      <SettingsSection title="پرداخت درب منزل / نقدی">
        <ToggleRow
          label="نمایش پرداخت درب منزل در فروشگاه تکی"
          hint="اگر خاموش باشد کارت نقدی از چک‌اوت .ir حذف می‌شود و سرور سفارش نقدی تکی را رد می‌کند"
          value={p.retailCashEnabled === true}
          onChange={(v) => set({ retailCashEnabled: v })}
        />
        <ToggleRow
          label="پرداخت نقدی / حساب با فروشگاه در عمده"
          hint="اگر خاموش باشد مشتری عمده فقط آنلاین یا اقساط می‌بیند"
          value={p.wholesaleCashEnabled === true}
          onChange={(v) => set({ wholesaleCashEnabled: v })}
        />
      </SettingsSection>
      <SettingsSection tone="wholesale" title="زرین‌پال عمده" badge=".com">
        <ToggleRow label="فعال‌سازی درگاه عمده" value={p.wholesaleEnabled !== false} onChange={(v) => set({ wholesaleEnabled: v })} />
        <SecretField label="مرچنت کد عمده" value={p.merchantId} shown={!!showSecret.merchantId} onToggle={() => onToggleSecret('merchantId')} onChange={(v) => set({ merchantId: v })} />
        <ToggleRow label="Sandbox عمده" value={p.sandbox} onChange={(v) => set({ sandbox: v })} />
        <TextField label="آدرس بازگشت عمده" value={p.callbackUrl ?? ''} dir="ltr" onChange={(v) => set({ callbackUrl: v })} />
      </SettingsSection>
      <SettingsSection tone="retail" title="دیجی‌پی UPG تکی" badge=".ir">
        <ToggleRow label="نمایش دیجی‌پی در چک‌اوت تکی" value={p.digipayEnabled !== false} onChange={(v) => set({ digipayEnabled: v })} />
        <SecretField label="شناسه کلاینت UPG" value={p.digipayClientId ?? ''} shown={!!showSecret.digipayClientId} onToggle={() => onToggleSecret('digipayClientId')} onChange={(v) => set({ digipayClientId: v })} />
        <SecretField label="رمز کلاینت UPG" value={p.digipayClientSecret ?? ''} shown={!!showSecret.digipayClientSecret} onToggle={() => onToggleSecret('digipayClientSecret')} onChange={(v) => set({ digipayClientSecret: v })} />
        <SecretField label="نام کاربری UPG" value={p.digipayUsername ?? ''} shown={!!showSecret.digipayUsername} onToggle={() => onToggleSecret('digipayUsername')} onChange={(v) => set({ digipayUsername: v })} />
        <SecretField label="رمز عبور UPG" value={p.digipayPassword ?? ''} shown={!!showSecret.digipayPassword} onToggle={() => onToggleSecret('digipayPassword')} onChange={(v) => set({ digipayPassword: v })} />
        <ToggleRow label="حالت آزمایشی دیجی‌پی (UAT)" value={!!p.digipaySandbox} onChange={(v) => set({ digipaySandbox: v })} />
        <button type="button" onClick={onTestDigipay} disabled={digipayBusy} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 disabled:opacity-60">
          {digipayBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          تست اتصال دیجی‌پی
        </button>
        {digipayMsg ? <p className={cn('rounded-lg border px-3 py-2 text-xs', digipayMsg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950')}>{digipayMsg.text}</p> : null}
      </SettingsSection>
      <SettingsSection tone="retail" title="ترب‌پی CPG تکی" badge=".ir">
        <ToggleRow label="نمایش ترب‌پی در چک‌اوت تکی" value={p.torobpayEnabled !== false} onChange={(v) => set({ torobpayEnabled: v })} />
        <SecretField label="کد پذیرنده" value={p.torobpayClientId ?? ''} shown={!!showSecret.torobpayClientId} onToggle={() => onToggleSecret('torobpayClientId')} onChange={(v) => set({ torobpayClientId: v })} />
        <SecretField label="کلید" value={p.torobpayClientSecret ?? ''} shown={!!showSecret.torobpayClientSecret} onToggle={() => onToggleSecret('torobpayClientSecret')} onChange={(v) => set({ torobpayClientSecret: v })} />
        <SecretField label="نام کاربری فعال‌سازی" value={p.torobpayUsername ?? ''} shown={!!showSecret.torobpayUsername} onToggle={() => onToggleSecret('torobpayUsername')} onChange={(v) => set({ torobpayUsername: v })} />
        <SecretField label="رمز عبور فعال‌سازی" value={p.torobpayPassword ?? ''} shown={!!showSecret.torobpayPassword} onToggle={() => onToggleSecret('torobpayPassword')} onChange={(v) => set({ torobpayPassword: v })} />
        <ToggleRow label="حالت آزمایشی ترب‌پی" value={!!p.torobpaySandbox} onChange={(v) => set({ torobpaySandbox: v })} />
        <button type="button" onClick={onTestTorobpay} disabled={torobpayBusy} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 disabled:opacity-60">
          {torobpayBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          تست اتصال ترب‌پی
        </button>
        {torobpayMsg ? <p className={cn('rounded-lg border px-3 py-2 text-xs', torobpayMsg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950')}>{torobpayMsg.text}</p> : null}
      </SettingsSection>
      <SettingsSection tone="retail" title="زرین‌پال فروشگاه تکی" badge=".ir">
        <ToggleRow label="فعال‌سازی درگاه تکی" value={p.retailEnabled !== false} onChange={(v) => set({ retailEnabled: v })} />
        <SecretField label="مرچنت کد تکی" value={p.retailMerchantId ?? ''} shown={!!showSecret.retailMerchantId} onToggle={() => onToggleSecret('retailMerchantId')} onChange={(v) => set({ retailMerchantId: v })} />
        <ToggleRow label="Sandbox تکی" value={!!p.retailSandbox} onChange={(v) => set({ retailSandbox: v })} />
        <TextField label="آدرس بازگشت تکی" value={p.retailCallbackUrl ?? ''} dir="ltr" onChange={(v) => set({ retailCallbackUrl: v })} />
      </SettingsSection>
      <SettingsSection title="کارت به کارت">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="شماره کارت" value={p.manualCardNumber} dir="ltr" onChange={(v) => set({ manualCardNumber: v })} />
          <TextField label="صاحب کارت" value={p.manualCardOwner} onChange={(v) => set({ manualCardOwner: v })} />
        </div>
      </SettingsSection>
    </div>
  );
}
