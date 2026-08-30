import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { ProductEntity } from '../product/entities/product.entity';
import { SettingsService } from '../settings/settings.service';
import { resolveChannelSale } from '../product/product-sale';
import {
  enumeratePublishableOptions,
  RETAIL_CANONICAL_ORIGIN,
  sanitizeGuarantee,
} from '../torob/torob-product-projection';

function xmlEscape(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absMedia(url: string | undefined, base: string) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/media/${url}`;
}

type FeedRow = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  sku?: string | null;
  retailPrice: number;
  retailCompareAtPrice: number | null;
  stock: number;
  availabilityBool: boolean;
  availabilityStock: 'in stock' | 'out of stock';
  image: string;
  images: string[];
  link: string;
  category: string;
  brand: string;
  sizes: string;
  colors: string;
  guarantee: string;
  listPriceIrr: number;
  salePriceIrr: number | null;
};

@ApiTags('feeds')
@Controller({ path: 'feeds', version: '1' })
export class FeedsController {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    private readonly settings: SettingsService,
  ) {}

  private siteBase() {
    const raw = process.env.NEXT_PUBLIC_RETAIL_URL || 'https://www.poshaktaranom.ir';
    try {
      const u = new URL(String(raw).trim());
      const host = u.hostname.toLowerCase();
      if (host === 'poshaktaranom.ir' || host === 'www.poshaktaranom.ir') {
        return 'https://www.poshaktaranom.ir';
      }
      return `${u.protocol}//${u.host}`.replace(/\/$/, '');
    } catch {
      return 'https://www.poshaktaranom.ir';
    }
  }

  /** Site stores IRR; Torob product feed + UI show Toman. */
  private toToman(irr: number) {
    return Math.max(0, Math.round(Number(irr || 0) / 10));
  }

  private async brandName() {
    const m = await this.settings.marketing();
    return m.feedBrandName || 'پوشاک ترنم';
  }

  private async loadAllActive() {
    const out: ProductEntity[] = [];
    const pageSize = 200;
    for (let page = 0; ; page += 1) {
      const rows = await this.products.find({
        where: { status: 'ACTIVE' },
        relations: ['variants', 'category'],
        order: { createdAt: 'DESC', id: 'ASC' },
        skip: page * pageSize,
        take: pageSize,
      });
      out.push(...rows);
      if (rows.length < pageSize) break;
    }
    return out;
  }

  private async loadRows(): Promise<FeedRow[]> {
    const rows = await this.loadAllActive();
    const base = this.siteBase();
    const brand = await this.brandName();

    return rows
      .filter((p) => p.showOnRetail !== false && p.status === 'ACTIVE' && Number(p.retailPrice) > 0)
      .map((p) => {
        const sale = resolveChannelSale(p, 'RETAIL');
        const payable = sale.payable;
        const listPrice = sale.active && sale.original ? sale.original : payable;
        const variantStock = (p.variants || []).reduce((s, v) => s + (Number(v.retailStock) || 0), 0);
        const stock = variantStock > 0 ? variantStock : Number(p.retailStock) || 0;
        const images = (p.images || [])
          .map((u) => absMedia(u, base).replace(/^http:\/\//i, 'https://'))
          .filter(Boolean);
        const sizes = [...new Set((p.variants || []).map((v) => v.size).filter(Boolean))];
        const colors = [...new Set((p.variants || []).map((v) => v.color).filter(Boolean))];
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          sku: p.sku,
          retailPrice: payable,
          retailCompareAtPrice: p.retailCompareAtPrice != null ? Number(p.retailCompareAtPrice) : null,
          listPriceIrr: listPrice,
          salePriceIrr: sale.active ? payable : null,
          stock,
          availabilityBool: stock > 0,
          availabilityStock: (stock > 0 ? 'in stock' : 'out of stock') as FeedRow['availabilityStock'],
          image: images[0] || '',
          images,
          link: `${base}/products/${String(p.slug || p.id).replace(/^\/+|\/+$/g, '')}`,
          category: p.category?.name || p.fabric || 'مانتو',
          brand,
          sizes: sizes.join(','),
          colors: colors.join(','),
          guarantee: sanitizeGuarantee(p.guarantee) || '',
        };
      });
  }

  @Get()
  @ApiOperation({ summary: 'فهرست URLهای فید مارکت‌پلیس' })
  index() {
    const api = (process.env.PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.poshaktaranom.com/v1').replace(
      /\/$/,
      '',
    );
    return {
      torob: {
        panel: 'https://panel.torob.com',
        site: 'https://torob.com',
        feed: `${api}/feeds/torob.xml`,
        feedRetail: 'https://www.poshaktaranom.ir/api/v1/feeds/torob.xml',
        ordersApi: 'https://www.poshaktaranom.ir/api/torob/v1/orders',
        productApi: 'https://www.poshaktaranom.ir/v1/torob_api/v3/products',
        format: 'XML (fallback) + JSON Product API v3 + JSON (سفارش‌ها)',
        notes:
          'روش پیشنهادی: Product API v3 روی www.poshaktaranom.ir. فید XML fallback است و از همان projection استفاده می‌کند. سفارش‌ها: /torob/v1/orders. مستند: github.com/torob/Torob-Sync',
      },
      bam: {
        panel: 'https://business.bam.ir',
        site: 'https://bam.ir',
        feedCsv: `${api}/feeds/bam.csv`,
        feedXml: `${api}/feeds/bam.xml`,
        format: 'CSV یا XML',
        notes: 'ثبت فید در پنل کسب‌وکار بام',
      },
      googleMerchant: {
        feed: `${api}/feeds/google-merchant.xml`,
        feedRetail: 'https://www.poshaktaranom.ir/feeds/google-merchant.xml',
        format: 'RSS 2.0 + Google Merchant g: namespace',
        notes: 'فقط کانال تکی؛ محصولات پیش‌نویس/مخفی حذف می‌شوند؛ sale_price فقط وقتی تخفیف فعال است',
      },
      requirements: ['retailPrice > 0', 'ACTIVE', 'showOnRetail', 'link + image_link + availability'],
    };
  }

  @Get('google-merchant.xml')
  @ApiOperation({ summary: 'فید Google Merchant (خرده‌فروشی)' })
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=600')
  async googleMerchant() {
    const items = (await this.loadRows()).filter((p) => p.image && p.link);
    const base = this.siteBase();
    const body = items
      .map((p) => {
        const sale =
          p.salePriceIrr != null && p.salePriceIrr > 0 && p.salePriceIrr < p.listPriceIrr
            ? `\n      <g:sale_price>${p.salePriceIrr} IRR</g:sale_price>`
            : '';
        return `
    <item>
      <g:id>${xmlEscape(p.sku || p.id)}</g:id>
      <title>${xmlEscape(p.name)}</title>
      <description>${xmlEscape((p.description || p.name).slice(0, 5000))}</description>
      <link>${xmlEscape(p.link)}</link>
      <g:image_link>${xmlEscape(p.image)}</g:image_link>
      <g:availability>${p.availabilityBool ? 'in_stock' : 'out_of_stock'}</g:availability>
      <g:price>${p.listPriceIrr} IRR</g:price>${sale}
      <g:brand>${xmlEscape(p.brand)}</g:brand>
      <g:condition>new</g:condition>
    </item>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>پوشاک ترنم</title>
    <link>${xmlEscape(base)}</link>
    <description>فید محصولات فروشگاه تکی پوشاک ترنم</description>
    ${body}
  </channel>
</rss>`;
  }

  @Get('torob.xml')
  @ApiOperation({ summary: 'فید XML تورب (Torob)' })
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async torob(@Res() res: Response) {
    const rows = await this.loadAllActive();
    const brand = await this.brandName();
    const mediaOrigin = this.siteBase();
    const items = rows.flatMap((product) =>
      enumeratePublishableOptions(product as any, mediaOrigin, RETAIL_CANONICAL_ORIGIN)
        .filter((row) => row.publishable && row.payload)
        .map((row) => row.payload!),
    );
    const body = items
      .map((p) => {
        const guarantee = p.guarantee
          ? `\n    <guarantee>${xmlEscape(p.guarantee)}</guarantee>`
          : '';
        const oldPrice =
          p.old_price != null ? `\n    <old_price>${p.old_price}</old_price>` : '\n    <old_price></old_price>';
        return `
  <product>
    <product_id>${xmlEscape(p.product_group_id)}</product_id>
    <page_unique>${xmlEscape(p.page_unique)}</page_unique>
    <title>${xmlEscape(p.title)}</title>
    <description>${xmlEscape((p.short_desc || p.title).slice(0, 2000))}</description>
    <price>${p.current_price}</price>${oldPrice}
    <availability>${p.availability ? 'true' : 'false'}</availability>
    ${p.image_links.map((img) => `<image_link>${xmlEscape(img)}</image_link>`).join('\n    ')}
    <link>${xmlEscape(p.page_url)}</link>
    <category>${xmlEscape(p.spec.category || '')}</category>
    <brand>${xmlEscape(brand)}</brand>${guarantee}
    <sizes>${xmlEscape(p.spec.size || '')}</sizes>
    <colors>${xmlEscape(p.spec.color || '')}</colors>
  </product>`;
      })
      .join('');

    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<products>${body}\n</products>`);
  }

  @Get('bam.csv')
  @ApiOperation({ summary: 'فید CSV بام (Bam)' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async bamCsv(@Res() res: Response) {
    const items = await this.loadRows();
    const header =
      'product_id,title,description,price,old_price,availability,image_link,link,category,brand,sizes,colors,guarantee';
    const esc = (s: string) => `"${String(s || '').replace(/"/g, '""')}"`;
    const lines = items.map((p) =>
      [
        p.id,
        esc(p.name),
        esc((p.description || p.name).slice(0, 2000)),
        p.retailPrice,
        '',
        p.availabilityStock,
        esc(p.image),
        esc(p.link),
        esc(p.category),
        esc(p.brand),
        esc(p.sizes.replace(/,/g, '|')),
        esc(p.colors.replace(/,/g, '|')),
        esc(p.guarantee),
      ].join(','),
    );
    res.send('\uFEFF' + [header, ...lines].join('\n'));
  }

  @Get('bam.xml')
  @ApiOperation({ summary: 'فید XML بام (Bam)' })
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async bamXml(@Res() res: Response) {
    const items = await this.loadRows();
    const body = items
      .map(
        (p) => `
  <product>
    <product_id>${xmlEscape(p.id)}</product_id>
    <title>${xmlEscape(p.name)}</title>
    <description>${xmlEscape((p.description || p.name).slice(0, 2000))}</description>
    <price>${p.retailPrice}</price>
    <old_price></old_price>
    <availability>${xmlEscape(p.availabilityStock)}</availability>
    <image_link>${xmlEscape(p.image)}</image_link>
    <link>${xmlEscape(p.link)}</link>
    <category>${xmlEscape(p.category)}</category>
    <brand>${xmlEscape(p.brand)}</brand>
    <sizes>${xmlEscape(p.sizes.replace(/,/g, '|'))}</sizes>
    <colors>${xmlEscape(p.colors.replace(/,/g, '|'))}</colors>
    <guarantee>${xmlEscape(p.guarantee)}</guarantee>
  </product>`,
      )
      .join('');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<products>${body}\n</products>`);
  }
}
