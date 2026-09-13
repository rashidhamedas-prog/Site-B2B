export const CUSTOMER_STATUSES = ['PENDING', 'ACTIVE', 'INACTIVE'] as const;
export type CustomerAccountStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_SEGMENTS = ['VIP', 'A', 'B', 'C'] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const CUSTOMER_CHANNELS = ['ALL', 'RETAIL', 'WHOLESALE'] as const;
export type CustomerListChannel = (typeof CUSTOMER_CHANNELS)[number];

export const CUSTOMER_RECORD_TABS = [
  'identity',
  'addresses',
  'orders',
  'wallet',
  'marketing',
] as const;

export type CustomerRecordTab = (typeof CUSTOMER_RECORD_TABS)[number];

export const CUSTOMER_RECORD_TAB_LABEL: Record<CustomerRecordTab, string> = {
  identity: 'هویت',
  addresses: 'آدرس‌ها',
  orders: 'سفارش‌ها',
  wallet: 'کیف پول',
  marketing: 'بازاریابی',
};

export const CUSTOMER_MARKETING_TABS = ['today', 'funnel', 'rules'] as const;
export type CustomerMarketingTab = (typeof CUSTOMER_MARKETING_TABS)[number];

export function isCustomerAccountStatus(value: unknown): value is CustomerAccountStatus {
  return typeof value === 'string' && (CUSTOMER_STATUSES as readonly string[]).includes(value);
}

export function isCustomerSegment(value: unknown): value is CustomerSegment {
  return typeof value === 'string' && (CUSTOMER_SEGMENTS as readonly string[]).includes(value);
}

export function isCustomerListChannel(value: unknown): value is CustomerListChannel {
  return typeof value === 'string' && (CUSTOMER_CHANNELS as readonly string[]).includes(value);
}

export function isCustomerRecordTab(value: unknown): value is CustomerRecordTab {
  return typeof value === 'string' && (CUSTOMER_RECORD_TABS as readonly string[]).includes(value);
}

export function isCustomerMarketingTab(value: unknown): value is CustomerMarketingTab {
  return typeof value === 'string' && (CUSTOMER_MARKETING_TABS as readonly string[]).includes(value);
}

export function parseCustomerWorkspaceQuery(search: {
  get(name: string): string | null;
}): {
  channel: CustomerListChannel;
  q: string;
  status: CustomerAccountStatus | '';
  segment: CustomerSegment | '';
  tab: CustomerRecordTab;
  marketingTab: CustomerMarketingTab;
} {
  const rawChannel = (search.get('channel') || '').toUpperCase();
  const rawStatus = (search.get('status') || '').toUpperCase();
  const rawSegment = (search.get('segment') || '').toUpperCase();
  const rawTab = (search.get('tab') || '').toLowerCase();
  const rawMarketing = (search.get('mtab') || '').toLowerCase();
  return {
    channel: isCustomerListChannel(rawChannel) ? rawChannel : 'ALL',
    q: (search.get('q') || '').trim(),
    status: isCustomerAccountStatus(rawStatus) ? rawStatus : '',
    segment: isCustomerSegment(rawSegment) ? rawSegment : '',
    tab: isCustomerRecordTab(rawTab) ? rawTab : 'identity',
    marketingTab: isCustomerMarketingTab(rawMarketing) ? rawMarketing : 'today',
  };
}

export function serializeCustomerWorkspaceQuery(input: {
  channel?: CustomerListChannel;
  q?: string;
  status?: string;
  segment?: string;
  tab?: CustomerRecordTab;
  marketingTab?: CustomerMarketingTab;
}): string {
  const q = new URLSearchParams();
  if (input.channel && input.channel !== 'ALL') q.set('channel', input.channel);
  if (input.q?.trim()) q.set('q', input.q.trim());
  if (input.status && isCustomerAccountStatus(input.status)) q.set('status', input.status);
  if (input.segment && isCustomerSegment(input.segment)) q.set('segment', input.segment);
  if (input.tab && input.tab !== 'identity') q.set('tab', input.tab);
  if (input.marketingTab && input.marketingTab !== 'today') q.set('mtab', input.marketingTab);
  return q.toString();
}

export function customerListApiChannel(channel: CustomerListChannel): string | undefined {
  return channel === 'ALL' ? undefined : channel;
}
