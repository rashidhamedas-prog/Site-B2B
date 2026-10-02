export const SUPPORT_STATUS_FA: Record<string, string> = {
  OPEN: 'باز',
  IN_PROGRESS: 'در حال بررسی',
  WAITING_CUSTOMER: 'منتظر پاسخ شما',
  RESOLVED: 'حل‌شده',
  CLOSED: 'بسته',
};

export const SUPPORT_CATEGORY_FA: Record<string, string> = {
  ORDER: 'سفارش',
  PRODUCT: 'محصول',
  PAYMENT: 'پرداخت',
  SHIPPING: 'ارسال',
  ACCOUNT: 'حساب کاربری',
  OTHER: 'سایر',
};

export const SUPPORT_PRIORITY_FA: Record<string, string> = {
  LOW: 'کم',
  NORMAL: 'عادی',
  HIGH: 'بالا',
  URGENT: 'فوری',
};

export const SUPPORT_CATEGORIES = Object.keys(SUPPORT_CATEGORY_FA);
export const SUPPORT_PRIORITIES = Object.keys(SUPPORT_PRIORITY_FA);
export const SUPPORT_STATUSES = Object.keys(SUPPORT_STATUS_FA);

export type SupportTicketRow = {
  id: string;
  publicNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  channel?: string;
  customerId?: string;
  orderId?: string | null;
  assigneeUserId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportMessage = {
  id: string;
  authorType: string;
  body: string;
  isInternal?: boolean;
  createdAt: string;
};

export type SupportTicketDetail = SupportTicketRow & {
  messages: SupportMessage[];
};
