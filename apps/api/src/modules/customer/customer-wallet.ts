export const WALLET_DIRECTIONS = ['CREDIT', 'DEBIT'] as const;
export type WalletDirection = (typeof WALLET_DIRECTIONS)[number];

export const WALLET_REASON_CODES = [
  'OPENING',
  'ADMIN_CREDIT',
  'ADMIN_DEBIT',
  'ORDER_APPLY',
  'ORDER_REFUND',
  'RMA',
  'INVOICE',
  'ADJUSTMENT',
] as const;
export type WalletReasonCode = (typeof WALLET_REASON_CODES)[number];

export const WALLET_REASON_LABEL_FA: Record<WalletReasonCode, string> = {
  OPENING: 'مانده اولیه',
  ADMIN_CREDIT: 'افزایش توسط ادمین',
  ADMIN_DEBIT: 'کاهش توسط ادمین',
  ORDER_APPLY: 'مصرف در سفارش',
  ORDER_REFUND: 'برگشت سفارش',
  RMA: 'اعتبار مرجوعی',
  INVOICE: 'فاکتور',
  ADJUSTMENT: 'تعدیل سیستم',
};

const MAX_RIAL = 50_000_000_000;
const NOTE_MAX = 500;

export function isWalletDirection(value: unknown): value is WalletDirection {
  return typeof value === 'string' && (WALLET_DIRECTIONS as readonly string[]).includes(value);
}

export function isWalletReasonCode(value: unknown): value is WalletReasonCode {
  return typeof value === 'string' && (WALLET_REASON_CODES as readonly string[]).includes(value);
}

export function walletReasonLabelFa(code?: string | null): string {
  const key = String(code || '').toUpperCase();
  return isWalletReasonCode(key) ? WALLET_REASON_LABEL_FA[key] : key || '—';
}

/** Admin form is تومان; ledger and customers.balance stay ریال. */
export function tomanToRial(toman: number): number {
  const n = Math.round(Number(toman) || 0);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('مبلغ باید بزرگ‌تر از صفر باشد');
  }
  const rial = n * 10;
  if (rial > MAX_RIAL) {
    throw new Error('مبلغ از سقف مجاز بیشتر است');
  }
  return rial;
}

export function rialToToman(rial: number): number {
  return Math.round((Number(rial) || 0) / 10);
}

export function sanitizeWalletNote(raw?: string | null): string {
  return String(raw || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .slice(0, NOTE_MAX);
}

export function assertPositiveRial(amount: number): number {
  const n = Math.trunc(Number(amount) || 0);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_RIAL) {
    throw new Error('مبلغ نامعتبر است');
  }
  return n;
}
