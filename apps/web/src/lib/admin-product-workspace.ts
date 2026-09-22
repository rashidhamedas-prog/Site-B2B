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

export const UNCATEGORIZED_CATEGORY = 'uncategorized';

export const PRODUCT_LIST_STATUSES = [
  'ALL',
  'ACTIVE',
  'ARCHIVED',
  'OUT_OF_STOCK',
  'COMING_SOON',
] as const;

export type ProductListStatus = (typeof PRODUCT_LIST_STATUSES)[number];

export const PRODUCT_LIST_STATUS_LABEL: Record<ProductListStatus, string> = {
  ALL: 'همه وضعیت‌ها',
  ACTIVE: 'فعال',
  ARCHIVED: 'بایگانی',
  OUT_OF_STOCK: 'ناموجود',
  COMING_SOON: 'به زودی',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProductListFilterKey = 'categoryId' | 'status' | 'collectionId' | 'inStock';

export type ProductWorkspaceQuery = {
  channel: ProductListChannel;
  section: ProductEditorSection;
  q: string;
  categoryId: string;
  status: ProductListStatus;
  collectionId: string;
  inStock: boolean;
};

export function isProductListChannel(value: unknown): value is ProductListChannel {
  return value === 'ALL' || value === 'WHOLESALE' || value === 'RETAIL';
}

export function isProductEditorSection(value: unknown): value is ProductEditorSection {
  return typeof value === 'string' && (PRODUCT_EDITOR_SECTIONS as readonly string[]).includes(value);
}

export function isAdminCategoryUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function parseCategoryQuery(raw: string | null): string {
  const value = (raw || '').trim();
  if (!value) return '';
  if (value.toLowerCase() === UNCATEGORIZED_CATEGORY) return UNCATEGORIZED_CATEGORY;
  if (UUID_RE.test(value)) return value.toLowerCase();
  return '';
}

function parseCollectionQuery(raw: string | null): string {
  const value = (raw || '').trim();
  return UUID_RE.test(value) ? value.toLowerCase() : '';
}

function parseStatusQuery(raw: string | null): ProductListStatus {
  const value = (raw || '').trim().toUpperCase();
  return (PRODUCT_LIST_STATUSES as readonly string[]).includes(value)
    ? (value as ProductListStatus)
    : 'ALL';
}

export function parseProductWorkspaceQuery(search: {
  get(name: string): string | null;
}): ProductWorkspaceQuery {
  const rawChannel = (search.get('channel') || '').toUpperCase();
  const rawSection = (search.get('section') || '').toLowerCase();
  const inStock = (search.get('inStock') || '').trim().toLowerCase();
  return {
    channel: isProductListChannel(rawChannel) ? rawChannel : 'ALL',
    section: isProductEditorSection(rawSection) ? rawSection : 'identity',
    q: (search.get('q') || '').trim(),
    categoryId: parseCategoryQuery(search.get('categoryId')),
    status: parseStatusQuery(search.get('status')),
    collectionId: parseCollectionQuery(search.get('collectionId')),
    inStock: inStock === '1' || inStock === 'true',
  };
}

export function serializeProductWorkspaceQuery(input: {
  channel: ProductListChannel;
  section?: ProductEditorSection;
  q?: string;
  categoryId?: string;
  status?: ProductListStatus;
  collectionId?: string;
  inStock?: boolean;
}): string {
  const q = new URLSearchParams();
  if (input.channel !== 'ALL') q.set('channel', input.channel);
  if (input.section && input.section !== 'identity') q.set('section', input.section);
  if (input.q?.trim()) q.set('q', input.q.trim());
  const categoryId = parseCategoryQuery(input.categoryId || '');
  if (categoryId) q.set('categoryId', categoryId);
  if (input.status && input.status !== 'ALL') q.set('status', input.status);
  const collectionId = parseCollectionQuery(input.collectionId || '');
  if (collectionId) q.set('collectionId', collectionId);
  if (input.inStock) q.set('inStock', '1');
  return q.toString();
}

export function productListApiChannel(channel: ProductListChannel): string | undefined {
  return channel === 'ALL' ? undefined : channel;
}

export function productListFilterCount(query: Pick<
  ProductWorkspaceQuery,
  'categoryId' | 'status' | 'collectionId' | 'inStock'
>): number {
  let count = 0;
  if (query.categoryId) count += 1;
  if (query.status !== 'ALL') count += 1;
  if (query.collectionId) count += 1;
  if (query.inStock) count += 1;
  return count;
}

export function productListIsNarrowed(query: ProductWorkspaceQuery): boolean {
  return query.channel !== 'ALL' || !!query.q || productListFilterCount(query) > 0;
}

export function productListFilterChips(
  query: ProductWorkspaceQuery,
  names?: { categoryName?: string; collectionName?: string },
): Array<{ key: ProductListFilterKey; label: string }> {
  const chips: Array<{ key: ProductListFilterKey; label: string }> = [];
  if (query.categoryId === UNCATEGORIZED_CATEGORY) {
    chips.push({ key: 'categoryId', label: 'بدون دسته‌بندی' });
  } else if (query.categoryId) {
    chips.push({
      key: 'categoryId',
      label: `دسته: ${names?.categoryName || 'انتخاب‌شده'}`,
    });
  }
  if (query.status !== 'ALL') {
    chips.push({
      key: 'status',
      label: `وضعیت: ${PRODUCT_LIST_STATUS_LABEL[query.status]}`,
    });
  }
  if (query.collectionId) {
    chips.push({
      key: 'collectionId',
      label: `کالکشن: ${names?.collectionName || 'انتخاب‌شده'}`,
    });
  }
  if (query.inStock) chips.push({ key: 'inStock', label: 'فقط موجود' });
  return chips;
}
