export interface MenuChild {
  id: string;
  label: string;
  href: string;
  imageUrl?: string;
  description?: string;
}

export interface MenuItem {
  id: string;
  label: string;
  href: string;
  highlight?: boolean;
  imageUrl?: string;
  description?: string;
  children?: MenuChild[];
}

export interface MenusSettings {
  megaEnabled: boolean;
  main: MenuItem[];
  footer: MenuItem[];
  mobile: MenuItem[];
  legal: MenuItem[];
}

export const DEFAULT_MENUS: MenusSettings = {
  megaEnabled: true,
  main: [
    {
      id: 'products',
      label: 'محصولات',
      href: '/products',
      children: [
        { id: 'cat-blouse', label: 'شومیزی', href: '/products?fabric=لینن', description: 'شومیزی عمده' },
        { id: 'cat-manteau', label: 'مانتو', href: '/products', description: 'مانتو عمده' },
        { id: 'cat-set', label: 'ست', href: '/products', description: 'ست دو و سه تکه' },
      ],
    },
    { id: 'about', label: 'درباره ترنم', href: '/about' },
    { id: 'wholesale', label: 'شرایط عمده', href: '/wholesale' },
    { id: 'blog', label: 'وبلاگ', href: '/blog' },
    { id: 'contact', label: 'تماس با ما', href: '/contact' },
    {
      id: 'linen',
      label: 'کلکسیون لینن ترنم',
      href: '/linen-collection',
      highlight: true,
    },
  ],
  footer: [
    { id: 'f-products', label: 'محصولات', href: '/products' },
    { id: 'f-wholesale', label: 'شرایط عمده‌فروشی', href: '/wholesale' },
    { id: 'f-about', label: 'درباره ما', href: '/about' },
    { id: 'f-blog', label: 'وبلاگ', href: '/blog' },
    { id: 'f-contact', label: 'تماس با ما', href: '/contact' },
  ],
  mobile: [],
  legal: [
    { id: 'l-privacy', label: 'حریم خصوصی', href: '/privacy' },
    { id: 'l-terms', label: 'شرایط و قوانین', href: '/terms' },
    { id: 'l-returns', label: 'شرایط مرجوعی', href: '/returns' },
    { id: 'l-shipping', label: 'شرایط ارسال', href: '/shipping' },
  ],
};
