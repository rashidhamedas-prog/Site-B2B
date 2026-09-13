export type ProductListChannel = 'ALL' | 'WHOLESALE' | 'RETAIL';

export const PRODUCT_EDITOR_SECTIONS = [
  'identity',
  'specs',
  'seo',
  'content',
  'pricing',
  'channels',
  'merch',
  'media',
] as const;

export type ProductEditorSection = (typeof PRODUCT_EDITOR_SECTIONS)[number];

export const PRODUCT_EDITOR_SECTION_LABEL: Record<ProductEditorSection, string> = {
  identity: 'هویت',
  specs: 'مشخصات',
  seo: 'سئو',
  content: 'محتوا',
  pricing: 'قیمت',
  channels: 'کانال',
  merch: 'ویترین',
  media: 'رسانه',
};

export const PRODUCT_CHANNEL_LABEL: Record<ProductListChannel, string> = {
  ALL: 'کامل',
  WHOLESALE: 'عمده',
  RETAIL: 'تکی',
};

export function isProductListChannel(value: unknown): value is ProductListChannel {
  return value === 'ALL' || value === 'WHOLESALE' || value === 'RETAIL';
}

export function isProductEditorSection(value: unknown): value is ProductEditorSection {
  return typeof value === 'string' && (PRODUCT_EDITOR_SECTIONS as readonly string[]).includes(value);
}

export function parseProductWorkspaceQuery(search: {
  get(name: string): string | null;
}): { channel: ProductListChannel; section: ProductEditorSection; q: string } {
  const rawChannel = (search.get('channel') || '').toUpperCase();
  const rawSection = (search.get('section') || '').toLowerCase();
  return {
    channel: isProductListChannel(rawChannel) ? rawChannel : 'ALL',
    section: isProductEditorSection(rawSection) ? rawSection : 'identity',
    q: (search.get('q') || '').trim(),
  };
}

export function serializeProductWorkspaceQuery(input: {
  channel: ProductListChannel;
  section?: ProductEditorSection;
  q?: string;
}): string {
  const q = new URLSearchParams();
  if (input.channel !== 'ALL') q.set('channel', input.channel);
  if (input.section && input.section !== 'identity') q.set('section', input.section);
  if (input.q?.trim()) q.set('q', input.q.trim());
  return q.toString();
}

export function productListApiChannel(channel: ProductListChannel): string | undefined {
  return channel === 'ALL' ? undefined : channel;
}
