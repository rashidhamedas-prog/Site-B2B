export const WHOLESALE_STAT_KINDS = ['customers', 'years', 'models', 'team', 'default'] as const;

export type WholesaleStatKind = (typeof WHOLESALE_STAT_KINDS)[number];

const KIND_SET = new Set<string>(WHOLESALE_STAT_KINDS);

/** Explicit CMS icon names (English, same family as features icons). */
const ICON_OVERRIDE: Record<string, WholesaleStatKind> = {
  users: 'customers',
  user: 'customers',
  store: 'customers',
  storefront: 'customers',
  calendar: 'years',
  clock: 'years',
  zap: 'years',
  hanger: 'models',
  shirt: 'models',
  package: 'models',
  scissors: 'team',
  team: 'team',
  headphones: 'team',
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Maps a CMS stats row to a presentation glyph.
 * Explicit `icon` wins; otherwise infer from Persian/English label text.
 */
export function resolveWholesaleStatKind(input: { label?: string; icon?: string }): WholesaleStatKind {
  const icon = normalizeKey(input.icon || '');
  if (KIND_SET.has(icon)) return icon as WholesaleStatKind;
  if (icon && ICON_OVERRIDE[icon]) return ICON_OVERRIDE[icon];

  const label = `${input.label || ''} ${icon}`;
  if (/مشتری|بوتیک|فروشگاه|customer|store|boutique/.test(label)) return 'customers';
  if (/سال|تجربه|تأسیس|تاسیس|year|found/.test(label)) return 'years';
  if (/مدل|کاتالوگ|فصل|model|catalog/.test(label)) return 'models';
  if (/پرسنل|تیم|نفر|تولید|کارگاه|team|staff|workshop/.test(label)) return 'team';
  return 'default';
}
