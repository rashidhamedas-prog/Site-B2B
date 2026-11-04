// Shared shipping contract (phase 00). Phases 01–04 implement against these
// shapes; change them only through a contract PR so parallel phases stay aligned.
// All money is integer IRR. Never use toman or floats inside the calculation path.

export type ShippingChannel = 'RETAIL' | 'WHOLESALE';

export type ShippingZone = 'SAME_CITY' | 'SAME_PROVINCE' | 'OTHER';

export type FeeSource = 'tariff' | 'tapin' | 'fallback';

export type FallbackReason =
  | 'timeout'
  | 'breaker'
  | 'no_province_code'
  | 'upstream_error'
  | 'no_tariff';

export type WeightSource = 'PRODUCT' | 'CATEGORY' | 'FIXED';

/** Per-line weight source actually used by `resolveOrderWeight`. */
export type WeightSourceUsed = 'PRODUCT' | 'CATEGORY' | 'DEFAULT' | 'MIXED';

/** Row of `shipping_rates` (phase 01). unique(channel, methodId, zone). */
export interface ShippingRate {
  id: string;
  channel: ShippingChannel;
  methodId: string;
  zone: ShippingZone;
  baseIrr: number;
  perKgIrr: number;
  minIrr: number;
  /** 0 = no cap */
  maxIrr: number;
  /** 0 = use the channel threshold */
  freeThresholdIrr: number;
  /** 0 = unlimited */
  maxWeightGrams: number;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  isActive: boolean;
}

export type ShippingRateInput = Omit<ShippingRate, 'id'>;

/** Keys added to `app_settings.shipping` (phase 01). Existing keys are untouched. */
export interface ShippingEngineSettings {
  weightSource: WeightSource;
  defaultPieceGrams: number;
  /** categoryId → grams per piece */
  categoryGrams: Record<string, number>;
  packagingDefaultGrams: number;
  /** Final fee rounding step in toman (applied once, to IRR output ×10). */
  roundingToman: number;
  volumetricDivisor: number;
}

export const DEFAULT_SHIPPING_ENGINE_SETTINGS: ShippingEngineSettings = {
  weightSource: 'PRODUCT',
  defaultPieceGrams: 450,
  categoryGrams: {},
  packagingDefaultGrams: 0,
  roundingToman: 1000,
  volumetricDivisor: 6000,
};

export interface QuoteItemInput {
  productId: string;
  qty: number;
  weightGrams?: number | null;
  packagingGrams?: number | null;
  isVolumetric?: boolean;
  /** cm, only meaningful when isVolumetric */
  dimensionsCm?: { l: number; w: number; h: number } | null;
}

export interface ResolvedWeight {
  weightGrams: number;
  weightSourceUsed: WeightSourceUsed;
  weightIsEstimated: boolean;
  notes: string[];
}

/** Phase 01 implements in `shipping-weight.ts`. */
export type ResolveOrderWeight = (
  items: Array<QuoteItemInput & { categoryId?: string | null }>,
  settings: ShippingEngineSettings,
) => ResolvedWeight;

export interface QuoteDestination {
  province?: string | null;
  city?: string | null;
}

/**
 * Engine input (phase 02). Free-shipping basis = goodsIrr - discountIrr
 * (no wallet, no shipping). Client-sent `fee` / `freeShipping` / `shippingFee`
 * are never part of this type and must be ignored by callers.
 */
export interface QuoteInput {
  channel: ShippingChannel;
  method: string;
  items?: QuoteItemInput[];
  /** Fallback when items are absent → weightIsEstimated: true */
  pieces?: number;
  goodsIrr: number;
  discountIrr: number;
  destination: QuoteDestination;
  couponFreeShipping?: boolean;
}

export interface QuoteResult {
  channel: ShippingChannel;
  method: string;
  methodLabel: string;
  zone: ShippingZone;
  weightGrams: number;
  billableKg: number;
  weightSource: WeightSourceUsed;
  weightIsEstimated: boolean;
  baseIrr: number;
  perKgIrr: number;
  /** Fee before free-shipping and before rounding */
  grossIrr: number;
  discountIrr: number;
  thresholdIrr: number;
  freeShipping: boolean;
  /** Final, rounded once to roundingToman. 0 when freeShipping. */
  feeIrr: number;
  feeSource: FeeSource;
  fallbackReason?: FallbackReason;
  etaDays: { min: number | null; max: number | null } | null;
  notes: string[];
}

/** Error codes for 400 responses (Persian message + code). */
export type QuoteErrorCode =
  | 'SHIPPING_METHOD_INACTIVE'
  | 'SHIPPING_DESTINATION_UNSUPPORTED'
  | 'SHIPPING_WEIGHT_EXCEEDED'
  | 'SHIPPING_INVALID_INPUT';

/** Online post quote (phase 03) → feeds the phase-02 engine as base fee. */
export interface PostQuoteOutcome {
  feeSource: FeeSource;
  fallbackReason?: FallbackReason;
  /** Gross IRR from Tapin or the stored post tariff, before engine clamp/round/free. */
  grossIrr: number;
  zone: ShippingZone;
}

export interface PostBreakerStatus {
  state: 'closed' | 'open' | 'half_open';
  consecutiveFailures: number;
  openedAt: string | null;
  reopensAt: string | null;
  cacheTtlSeconds: number;
}

/** Config validation (phase 04), shared by client and server. */
export interface ShippingConfigIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  field?: string;
}

/**
 * HTTP surface (all under /v1):
 * - GET  /shipping/quote            legacy query API, kept for compatibility (phase 02 routes through engine)
 * - POST /shipping/preview          body QuoteInput → QuoteResult (phase 02; used by checkouts and admin calculator)
 * - GET/PUT /admin/shipping/rates?channel=   ShippingRate[] (phase 01)
 * - PATCH /admin/products/:id/weight, PATCH /admin/products/weights (phase 01)
 * - GET  /admin/shipping/post-status → PostBreakerStatus (phase 03)
 */
export const SHIPPING_ROUTES = {
  quote: '/shipping/quote',
  preview: '/shipping/preview',
  adminRates: '/admin/shipping/rates',
  adminPostStatus: '/admin/shipping/post-status',
} as const;

/**
 * Round IRR once to a toman step (step IRR = roundingToman × 10).
 * 1_234_567 IRR: roundingToman=100 → 1_235_000; roundingToman=1000 → 1_230_000.
 */
export function roundFeeIrr(feeIrr: number, roundingToman: number): number {
  const stepIrr = Math.max(0, Math.round(roundingToman)) * 10;
  const v = Math.max(0, Math.round(feeIrr));
  if (stepIrr <= 0) return v;
  return Math.round(v / stepIrr) * stepIrr;
}
