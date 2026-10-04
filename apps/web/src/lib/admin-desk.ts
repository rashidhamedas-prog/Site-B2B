/** Admin home desk: queues and surfaces for wholesale (.com) and retail (.ir). */

export type DeskChannelKey = 'wholesale' | 'retail';

export interface ChannelSnapshot {
  revenueThisMonth: number;
  ordersThisMonth: number;
  pendingReview: number;
  activeCustomers: number;
  openTickets: number;
}

export interface DeskOps {
  openReturns?: number;
  criticalStock?: number;
  unpaidInvoices?: number;
}

export interface DeskStats {
  orders: { pending: number };
  ordersByStatus?: Record<string, number>;
  customers: { pending: number };
  revenue: { outstanding: number };
  lowStock: unknown[];
  channels?: { wholesale?: ChannelSnapshot; retail?: ChannelSnapshot };
  ops?: DeskOps;
}

export interface AttentionItem {
  id: string;
  href: string;
  label: string;
  detail: string;
}

export interface DeskSurface {
  href: string;
  label: string;
  hint: string;
}

export interface DeskSurfaceGroup {
  title: string;
  items: DeskSurface[];
}

const fa = (n: number) => Math.max(0, Math.round(n)).toLocaleString('fa-IR');

export function orderChannel(type?: string | null): DeskChannelKey {
  const key = String(type || '').toUpperCase();
  return key === 'RETAIL' || key === 'RETAIL_WEBSITE' ? 'retail' : 'wholesale';
}

export function channelLabel(key: DeskChannelKey): string {
  return key === 'retail' ? 'تک' : 'عمده';
}

export function growthSentence(growth: number): string {
  const n = Math.round(Number(growth) || 0);
  if (n > 0) return `${fa(n)}٪ بیشتر از ماه قبل`;
  if (n < 0) return `${fa(Math.abs(n))}٪ کمتر از ماه قبل`;
  return 'هم‌اندازه ماه قبل';
}

export function attentionItems(stats: DeskStats): AttentionItem[] {
  const awaiting = stats.ordersByStatus?.AWAITING_PAYMENT ?? 0;
  const tickets = (stats.channels?.wholesale?.openTickets ?? 0) + (stats.channels?.retail?.openTickets ?? 0);
  const returns = stats.ops?.openReturns ?? 0;
  const stock = stats.ops?.criticalStock ?? stats.lowStock.length;
  const unpaid = stats.ops?.unpaidInvoices ?? 0;
  const items: AttentionItem[] = [];

  if (stats.orders.pending > 0) {
    items.push({
      id: 'review',
      href: '/admin/orders?status=PENDING_REVIEW',
      label: 'بررسی سفارش',
      detail: `${fa(stats.orders.pending)} در صف`,
    });
  }
  if (awaiting > 0) {
    items.push({
      id: 'unpaid',
      href: '/admin/orders?status=AWAITING_PAYMENT',
      label: 'پرداخت نشده',
      detail: `${fa(awaiting)} سفارش`,
    });
  }
  if (stats.customers.pending > 0) {
    items.push({
      id: 'customers',
      href: '/admin/customers?status=PENDING',
      label: 'تأیید مشتری',
      detail: `${fa(stats.customers.pending)} درخواست`,
    });
  }
  if (tickets > 0) {
    items.push({
      id: 'tickets',
      href: '/admin/support',
      label: 'تیکت باز',
      detail: `${fa(tickets)} گفتگو`,
    });
  }
  if (returns > 0) {
    items.push({
      id: 'returns',
      href: '/admin/rma',
      label: 'مرجوعی',
      detail: `${fa(returns)} پرونده`,
    });
  }
  if (stock > 0) {
    items.push({
      id: 'stock',
      href: '/admin/inventory',
      label: 'موجودی کم',
      detail: `${fa(stock)} تنوع زیر ۱۰`,
    });
  }
  if (unpaid > 0 || stats.revenue.outstanding > 0) {
    items.push({
      id: 'invoices',
      href: '/admin/invoices',
      label: unpaid > 0 ? 'فاکتور باز' : 'مطالبات',
      detail: unpaid > 0 ? `${fa(unpaid)} فاکتور` : 'مانده وصول‌نشده',
    });
  }
  return items;
}

/** Every admin desk that serves the wholesale or retail storefront. */
export const DESK_SURFACES: DeskSurfaceGroup[] = [
  {
    title: 'فروش',
    items: [
      { href: '/admin/orders', label: 'سفارش‌ها', hint: 'عمده و تک' },
      { href: '/admin/customers', label: 'مشتریان', hint: 'تأیید و پرونده' },
      { href: '/admin/customers/marketing', label: 'بازاریابی', hint: 'پیگیری و بدون سفارش' },
      { href: '/admin/customers/boutique-referrals', label: 'معرفی بوتیک', hint: 'همکار معرفی عمده' },
      { href: '/admin/invoices', label: 'فاکتورها', hint: 'مانده و پیش‌فاکتور' },
      { href: '/admin/payments', label: 'پرداخت‌ها', hint: 'زرین‌پال، دیجی‌پی، ترب‌پی' },
      { href: '/admin/rma', label: 'مرجوعی', hint: 'بازگشت و تعویض' },
      { href: '/admin/support', label: 'پشتیبانی', hint: 'تیکت عمده و تک' },
    ],
  },
  {
    title: 'کالا',
    items: [
      { href: '/admin/products', label: 'محصولات', hint: 'ویترین هر دو سایت' },
      { href: '/admin/categories', label: 'دسته‌ها', hint: 'ناوبری فروشگاه' },
      { href: '/admin/collections', label: 'کالکشن‌ها', hint: 'چیدمان ویترین' },
      { href: '/admin/inventory', label: 'انبار', hint: 'موجودی عمده و تک' },
      { href: '/admin/discounts', label: 'تخفیف‌ها', hint: 'کد و کمپین' },
    ],
  },
  {
    title: 'رشد',
    items: [
      { href: '/admin/blog', label: 'وبلاگ', hint: 'کانال عمده و تک' },
      { href: '/admin/seo', label: 'سئو', hint: 'ریدایرکت و مسیر' },
      { href: '/admin/pages', label: 'صفحات', hint: 'محتوای ثابت' },
      { href: '/admin/site-content', label: 'محتوای سایت', hint: 'هوم و بلوک‌ها' },
      { href: '/admin/settings?section=navigation', label: 'منوها', hint: 'ناوبری ویترین' },
      { href: '/admin/notifications', label: 'اعلان‌ها', hint: 'پیامک و الگو' },
      { href: '/admin/reports', label: 'گزارش‌ها', hint: 'فروش به تفکیک کانال' },
    ],
  },
  {
    title: 'سیستم',
    items: [
      { href: '/admin/sales-partners', label: 'همکار بازاریاب', hint: 'لینک و پورسانت' },
      { href: '/admin/partners', label: 'تأمین ارسال', hint: 'ارسال توسط تأمین‌کننده' },
      { href: '/admin/omnichannel', label: 'انتشار', hint: 'کانال‌های بیرونی' },
      { href: '/admin/users', label: 'کاربران ادمین', hint: 'نقش داخلی' },
      { href: '/admin/settings', label: 'تنظیمات', hint: 'پرداخت، پیامک، سئو' },
    ],
  },
];
