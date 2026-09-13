export const SETTINGS_SECTIONS = [
  'business',
  'navigation',
  'shipping',
  'sms',
  'payment',
  'installments',
  'seo',
  'marketing',
  'theme',
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number];
export type SettingsChannel = 'WHOLESALE' | 'RETAIL';

export const SETTINGS_SECTION_LABEL: Record<SettingsSectionId, string> = {
  business: 'هویت فروشگاه',
  navigation: 'ناوبری',
  shipping: 'روش‌های ارسال',
  sms: 'پیامک',
  payment: 'درگاه پرداخت',
  installments: 'قوانین اقساط',
  seo: 'سئو و جست‌وجو',
  marketing: 'پیکسل و فید',
  theme: 'ظاهر و نوار روان',
};

export const SETTINGS_SECTION_HINT: Record<SettingsSectionId, string> = {
  business: 'نام، تماس، اینماد',
  navigation: 'منوی تکی / عمده',
  shipping: 'تکی و عمده جدا',
  sms: 'sms.ir و رویدادها',
  payment: 'زرین‌پال، دیجی‌پی، ترب‌پی',
  installments: 'پیش‌پرداخت و ماه',
  seo: 'عنوان، OG، سازمان',
  marketing: 'GA4 و پیکسل',
  theme: 'تم و خبر هوم',
};

export function isSettingsSectionId(value: unknown): value is SettingsSectionId {
  return typeof value === 'string' && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export function isSettingsChannel(value: unknown): value is SettingsChannel {
  return value === 'WHOLESALE' || value === 'RETAIL';
}

export function parseSettingsWorkspaceQuery(search: {
  get(name: string): string | null;
}): { section: SettingsSectionId; channel: SettingsChannel; q: string } {
  const rawSection = (search.get('section') || '').toLowerCase();
  const rawChannel = (search.get('channel') || '').toUpperCase();
  return {
    section: isSettingsSectionId(rawSection) ? rawSection : 'business',
    channel: isSettingsChannel(rawChannel) ? rawChannel : 'WHOLESALE',
    q: (search.get('q') || '').trim(),
  };
}

export function serializeSettingsWorkspaceQuery(input: {
  section?: SettingsSectionId;
  channel?: SettingsChannel;
  q?: string;
}): string {
  const q = new URLSearchParams();
  if (input.section && input.section !== 'business') q.set('section', input.section);
  if (input.channel && input.channel !== 'WHOLESALE') q.set('channel', input.channel);
  if (input.q?.trim()) q.set('q', input.q.trim());
  return q.toString();
}

export function settingsSectionMatchesQuery(
  id: SettingsSectionId,
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;
  return SETTINGS_SECTION_LABEL[id].includes(q) || SETTINGS_SECTION_HINT[id].includes(q) || id.includes(q);
}

export const DEFAULT_SEO_SETTINGS = {
  wholesale: {
    defaultTitle: 'پوشاک ترنم | تولیدی مانتو زنانه مشهد',
    defaultDescription:
      'تولیدی مانتو شومیزی زنانه لینن و کتان در مشهد. فروش عمده به بوتیک‌ها در سراسر ایران.',
    ogImageUrl: '/og-wholesale.jpg',
    ogImageAlt: 'پوشاک ترنم — تولیدی مانتو زنانه مشهد',
  },
  retail: {
    defaultTitle: 'فروشگاه پوشاک ترنم | خرید آنلاین مانتو',
    defaultDescription:
      'مانتو و شومیز را تکی، مستقیم از تولیدی ترنم در مشهد بخرید. ارسال سریع، پرداخت امن و امکان تعویض سایز.',
    ogImageUrl: '/og-retail.jpg',
    ogImageAlt: 'فروشگاه پوشاک ترنم',
  },
};

export const SMS_EVENT_KEYS = [
  'orderRegistered',
  'orderConfirmed',
  'orderShipped',
  'paymentReceived',
  'orderRegisteredAdmin',
  'wholesaleRegistrationAdmin',
  'wholesaleApproved',
  'fulfillmentPendingAccept',
  'fulfillmentShipped',
  'fulfillmentAcceptExpired',
] as const;

export function resolveSmsEvents(raw: Record<string, boolean> | undefined): Record<string, boolean> {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out: Record<string, boolean> = {};
  for (const key of SMS_EVENT_KEYS) {
    out[key] = src[key] !== false;
  }
  return out;
}
