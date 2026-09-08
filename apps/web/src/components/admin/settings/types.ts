import type { ThemeSettings } from '@/components/wholesale/ThemeApply';
import type { EnamadSealConfig } from '@/lib/enamad';

export interface InstallmentRule {
  id: string;
  minDownPaymentPercent: number;
  maxMonths: number;
  categoryId: string | null;
}

export interface ShippingCompany {
  id: string;
  label: string;
  isActive: boolean;
  sort: number;
}

export interface ShippingChannelRetail {
  baseFee: number;
  perKgFee: number;
  freeThreshold: number;
  kgPerPiece: number;
  detailsText: string;
  companies: ShippingCompany[];
}

export interface ShippingChannelWholesale {
  baseFee: number;
  freeThreshold: number;
  detailsText: string;
  companies: ShippingCompany[];
}

export interface ShippingPostChannel {
  enabled: boolean;
  originProvince: string;
  originCity: string;
  sameCityBase: number;
  sameProvinceBase: number;
  otherBase: number;
  extraKgFee: number;
  vatPercent: number;
}

export interface SmsOpsSide {
  orderPaidAdmin: boolean;
  abandonedCart: boolean;
  stockOutAdmin: boolean;
}

export interface SettingsPayload {
  business: {
    businessName: string;
    ownerName: string;
    phone: string;
    email: string;
    website: string;
    instagram: string;
    telegram: string;
    address: string;
    officeAddress: string;
    minOrderToman: number;
    defaultCreditDays: number;
    limitedStockMultiplier?: number;
    newBadgeDays?: number;
    enamadWholesale: EnamadSealConfig;
    enamadRetail: EnamadSealConfig;
  };
  shipping: {
    baseFee: number;
    perKgFee: number;
    freeThreshold: number;
    kgPerPiece?: number;
    retail: ShippingChannelRetail;
    wholesale: ShippingChannelWholesale;
    companies: ShippingCompany[];
    methods: Record<string, boolean>;
  };
  shippingPost: {
    retail: ShippingPostChannel;
    wholesale: ShippingPostChannel;
  };
  sms: {
    enabled: boolean;
    apiKey: string;
    lineNumber: string;
    otpTemplateId: number;
    adminPhoneWholesale: string;
    adminPhoneWholesale2: string;
    adminPhoneRetail: string;
    adminPhoneRetail2: string;
    events: Record<string, boolean>;
    templates: Record<string, string>;
  };
  smsOps: {
    retail: SmsOpsSide;
    wholesale: SmsOpsSide;
  };
  payment: {
    enabled: boolean;
    wholesaleEnabled: boolean;
    merchantId: string;
    sandbox: boolean;
    callbackUrl: string;
    retailEnabled: boolean;
    retailMerchantId: string;
    retailSandbox: boolean;
    retailCallbackUrl: string;
    digipayEnabled: boolean;
    digipayClientId: string;
    digipayClientSecret: string;
    digipayUsername: string;
    digipayPassword: string;
    digipaySandbox: boolean;
    digipayConfigured: boolean;
    torobpayEnabled: boolean;
    torobpayClientId: string;
    torobpayClientSecret: string;
    torobpayUsername: string;
    torobpayPassword: string;
    torobpaySandbox: boolean;
    torobpayConfigured: boolean;
    manualCardNumber: string;
    manualCardOwner: string;
  };
  installments: {
    minDownPaymentPercent: number;
    minDownPaymentAmount: number;
    maxMonths: number;
    rules: InstallmentRule[];
    minActiveInvoices?: number;
  };
  theme: ThemeSettings;
  marketing: {
    feedBrandName: string;
    ga4WholesaleId: string;
    ga4RetailId: string;
    gtmWholesaleId: string;
    gtmRetailId: string;
    gscWholesaleVerification: string;
    gscRetailVerification: string;
    yektanetPixelId: string;
    metaPixelId: string;
    adroScriptUrl: string;
    adroAccountId: string;
    afferScriptUrl: string;
    afsonaScriptUrl: string;
    takhfifanScriptUrl: string;
    yektanetPostbackUrl: string;
    afferPostbackUrl: string;
    afsonaPostbackUrl: string;
    takhfifanPostbackUrl: string;
    postbackUrl: string;
    broadcastPostbacks: boolean;
    basalamEnabled: boolean;
    basalamAccessToken: string;
    basalamVendorId: string;
    torobOrderSyncEnabled: boolean;
  };
}

export type SettingsTabId =
  | 'business'
  | 'shipping'
  | 'sms'
  | 'payment'
  | 'installments'
  | 'theme'
  | 'marketing';

export type SaleChannel = 'WHOLESALE' | 'RETAIL';
