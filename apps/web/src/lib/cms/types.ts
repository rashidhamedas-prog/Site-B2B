export type BlockType =
  | 'announcement'
  | 'chrome'
  | 'hero'
  | 'stats'
  | 'features'
  | 'process'
  | 'testimonials'
  | 'faq'
  | 'cta'
  | 'products'
  | 'comingSoon'
  | 'text'
  | 'image'
  | 'gallery'
  | 'html'
  | 'contact'
  | 'links';

export interface ContentBlock {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
}

export interface SiteContentDoc {
  id?: string;
  channel: string;
  pageKey: string;
  title: string;
  blocks: ContentBlock[];
  seo?: Record<string, string> | null;
  isPublished?: boolean;
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  announcement: 'نوار اعلان (بالا)',
  chrome: 'هدر / فوتر / شناور',
  hero: 'هیرو',
  stats: 'آمار و شمارنده',
  features: 'ویژگی‌ها / کارت‌ها',
  process: 'فرآیند / مراحل',
  testimonials: 'نظرات مشتریان',
  faq: 'سوالات متداول',
  cta: 'دعوت به اقدام',
  products: 'محصولات برتر',
  comingSoon: 'به‌زودی / پیش‌خرید',
  text: 'متن',
  image: 'تصویر',
  gallery: 'گالری',
  html: 'HTML',
  contact: 'تماس / آدرس',
  links: 'لیست لینک',
};

export function newBlockId() {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
