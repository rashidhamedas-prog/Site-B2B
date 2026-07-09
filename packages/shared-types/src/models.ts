import type {
  CustomerType,
  CustomerSegment,
  CustomerStatus,
  OrderType,
  OrderStatus,
  ProductStatus,
  InvoiceType,
  InvoiceStatus,
  PaymentGateway,
  PaymentMethod,
  ShippingMethod,
  UserRole,
  ProductSize,
} from './enums';

// ─── Common ────────────────────────────────────────────────────────────────────

export interface Address {
  province: string;
  city: string;
  district?: string;
  street: string;
  postalCode?: string;
  fullAddress: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  meta?: PaginationMeta;
  errors?: ApiError[] | null;
  timestamp: string;
}

export interface ApiError {
  code: string;
  field?: string;
  message: string;
  messageEn?: string;
}

// ─── User ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  code: string;
  fullName: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

// ─── Customer ──────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  code: string;
  type: CustomerType;
  segment: CustomerSegment;
  fullName: string;
  businessName?: string;
  phone: string;
  phone2?: string;
  email?: string;
  province?: string;
  city?: string;
  address?: string;
  creditLimit: number;
  currentBalance: number;
  totalPurchased: number;
  source?: string;
  assignedRepId?: string;
  assignedRep?: Pick<User, 'id' | 'fullName'>;
  status: CustomerStatus;
  isPortalEnabled: boolean;
  tags?: string[];
  firstPurchaseAt?: string;
  lastPurchaseAt?: string;
  lastContactAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Product ───────────────────────────────────────────────────────────────────

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  color: string;
  colorCode?: string;
  colorNameFa?: string;
  size: ProductSize;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  wholesalePriceOverride?: number;
  retailPriceOverride?: number;
  isActive: boolean;
}

export interface ProductImage {
  id?: string;
  url: string;
  altText?: string;
  sortOrder?: number;
  isPrimary?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  nameFa?: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  fabric?: string;
  fabricFa?: string;
  wholesalePrice: number;
  retailPrice: number;
  costPrice?: number;
  status: ProductStatus;
  isWashTreated: boolean;
  isFeatured: boolean;
  /** Runtime stores URL strings; ProductImage[] for rich metadata when needed */
  images: string[] | ProductImage[];
  variants: ProductVariant[];
  tags?: string[];
  seoMeta?: SeoMeta;
  totalStock: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Order ─────────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  color: string;
  size: ProductSize;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  number: string;
  type: OrderType;
  status: OrderStatus;
  customerId: string;
  customerName: string;
  customerPhone: string;
  assignedRepId?: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod?: PaymentMethod;
  paymentTermDays: number;
  shippingMethod?: ShippingMethod;
  shippingAddress?: Address;
  trackingCode?: string;
  notes?: string;
  internalNotes?: string;
  orderedAt: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Invoice ───────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  customerId: string;
  customerName: string;
  orderId?: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentDueDate?: string;
  issueDateJalali: string;
  dueDateJalali?: string;
  pdfUrl?: string;
  sentAt?: string;
  paidAt?: string;
  voidedAt?: string;
  createdAt: string;
}

// ─── SEO ───────────────────────────────────────────────────────────────────────

export interface SeoMeta {
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  ogImage?: string;
  noIndex?: boolean;
}
