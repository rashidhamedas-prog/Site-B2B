export type ApplicationRow = {
  id: string;
  displayName: string;
  phoneMasked: string;
  status: string;
  createdAt: string;
};

export type PartnerRow = {
  id: string;
  displayName: string;
  status: string;
  statusLabel: string;
  statusReason: string | null;
  phoneMasked: string;
  riskFlags?: string[];
};

export type CatalogRow = {
  productId: string;
  name: string;
  slug: string | null;
  priceIrr: number;
  vendorSku: boolean;
  eligible: boolean;
  previewCommissionPercent: number;
  marginIrr: number;
  minMarginIrr: number;
  canEnable: boolean;
};

export type RuleRow = {
  id: string;
  scope: string;
  percent: number;
  active: boolean;
  productId: string | null;
  categoryId: string | null;
  salesPartnerId: string | null;
  note: string | null;
};

export type PayoutRow = {
  id: string;
  salesPartnerId: string;
  status: string;
  amountIrr: number;
  bankReferenceMasked: string | null;
  paidAt: string | null;
};

export type Settings = {
  enabled: boolean;
  mode: 'OFF' | 'PREVIEW' | 'CANARY' | 'LIVE';
  applyOpen: boolean;
  commissionHoldDays: number | null;
  minPayoutIrr: number;
  dailyDraftCap: number;
  termsVersion: string;
};

export type DraftRow = {
  id: string;
  salesPartnerId?: string;
  status?: string;
  statusLabel: string;
  merchandiseIrr: number;
  convertedOrderId: string | null;
  customerPhoneMasked: string | null;
  attribution?: { salesSource: string; salesPartnerId: string | null; salesPartnerSubmissionId: string | null } | null;
};

export type AuditRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type Report = {
  applications: { total: number; byStatus: Record<string, number>; pendingReview?: number };
  partners: { total: number; byStatus: Record<string, number>; active?: number };
  drafts: {
    sampleSize: number;
    byStatus: Record<string, number>;
    converted: number;
    customerConfirmRate: number | null;
  };
  commissions?: {
    held: number;
    available: number;
    paid: number;
    reversed: number;
    sampleSize?: number;
  };
  payouts?: { count: number; paidIrr: number };
  note: string;
  generatedAt?: string;
};

export type Tab =
  | 'dashboard'
  | 'applications'
  | 'partners'
  | 'orders'
  | 'catalog'
  | 'rules'
  | 'payouts'
  | 'settings'
  | 'reports';
