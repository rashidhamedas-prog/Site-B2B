import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { ProductEntity } from '../product/entities/product.entity';
import { SettingsService } from '../settings/settings.service';

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
    return (process.env.NEXT_PUBLIC_RETAIL_URL || 'https://www.poshaktaranom.ir').replace(/\/$/, '');
  }

  private async brandName() {
    const m = await this.settings.marketing();
    return m.feedBrandName || 'پوشاک ترنم';
  }

  private async loadRows(): Promise<FeedRow[]> {
    const rows = await this.products.find({
      where: { status: 'ACTIVE' },
      relations: ['variants', 'category'],
      take: 2000,
    });
    const base = this.siteBase();
    const brand = await this.brandName();

    return rows
      .filter((p) => p.showOnRetail !== false && Number(p.retailPrice) > 0)
      .map((p) => {
        const price = Number(p.retailPrice);
        const variantStock = (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);
        const stock = variantStock > 0 ? variantStock : Number(p.stock) || 0;
        const images = (p.images || []).map((u) => absMedia(u, base)).filter(Boolean);
        const sizes = [...new Set((p.variants || []).map((v) => v.size).filter(Boolean))];
        const colors = [...new Set((p.variants || []).map((v) => v.color).filter(Boolean))];
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          sku: p.sku,
          retailPrice: price,
          stock,
          availabilityBool: stock > 0,
          availabilityStock: (stock > 0 ? 'in stock' : 'out of stock') as FeedRow['availabilityStock'],
          image: images[0] || '',
          images,
          link: `${base}/products/${p.slug || p.id}`,
          category: p.category?.name || p.fabric || 'مانتو',
          brand,
          sizes: sizes.join(','),
          colors: colors.join(','),
          guarantee: '۷ روز ضمانت بازگشت',
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
        format: 'XML',
        notes: 'ثبت لینک فید در پنل کسب‌وکار تورب؛ فیلدهای الزامی: قیمت، موجودی، لینک محصول، تصویر',
      },
      bam: {
        panel: 'https://business.bam.ir',
        site: 'https://bam.ir',
        feedCsv: `${api}/feeds/bam.csv`,
        feedXml: `${api}/feeds/bam.xml`,
        format: 'CSV یا XML',
        notes: 'ثبت فید در پنل کسب‌وکار بام',
      },
      requirements: ['retailPrice > 0', 'ACTIVE', 'link + image_link + availability'],
    };
  }

  @Get('torob.xml')
  @ApiOperation({ summary: 'فید XML تورب (Torob)' })
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async torob(@Res() res: Response) {
    const items = await this.loadRows();
    const body = items
      .map(
        (p) => `
  <product>
    <product_id>${xmlEscape(p.id)}</product_id>
    <page_unique>${xmlEscape(p.sku || p.id)}</page_unique>
    <title>${xmlEscape(p.name)}</title>
    <description>${xmlEscape((p.description || p.name).slice(0, 2000))}</description>
    <price>${p.retailPrice}</price>
    <old_price></old_price>
    <availability>${p.availabilityBool ? 'true' : 'false'}</availability>
    <image_link>${xmlEscape(p.image)}</image_link>
    ${p.images
      .slice(1, 5)
      .map((img) => `<image_link>${xmlEscape(img)}</image_link>`)
      .join('\n    ')}
    <link>${xmlEscape(p.link)}</link>
    <category>${xmlEscape(p.category)}</category>
    <brand>${xmlEscape(p.brand)}</brand>
    <guarantee>${xmlEscape(p.guarantee)}</guarantee>
    <sizes>${xmlEscape(p.sizes)}</sizes>
    <colors>${xmlEscape(p.colors)}</colors>
  </product>`,
      )
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
