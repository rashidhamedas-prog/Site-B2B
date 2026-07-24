import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import { ProductEntity } from '../product/entities/product.entity';

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

@ApiTags('feeds')
@Controller({ path: 'feeds', version: '1' })
export class FeedsController {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
  ) {}

  private siteBase() {
    return process.env.NEXT_PUBLIC_RETAIL_URL || 'https://www.poshaktaranom.ir';
  }

  @Get('torob.xml')
  @ApiOperation({ summary: 'فید XML توروب' })
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async torob(@Res() res: Response) {
    const rows = await this.products.find({
      where: { status: 'ACTIVE' },
      relations: ['variants', 'category'],
      take: 2000,
    });
    const base = this.siteBase().replace(/\/$/, '');

    const items = rows
      .filter((p) => Number(p.retailPrice) > 0)
      .map((p) => {
        const price = Number(p.retailPrice);
        const variantStock = (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);
        const stock = variantStock > 0 ? variantStock : Number(p.stock) || 0;
        const avail = stock > 0 ? 'true' : 'false';
        const img = absMedia(p.images?.[0], base);
        const link = `${base}/products/${p.slug || p.id}`;
        const sizes = [...new Set((p.variants || []).map((v) => v.size).filter(Boolean))].join(',');
        const colors = [...new Set((p.variants || []).map((v) => v.color).filter(Boolean))].join(',');
        // Only emit old_price when a real compare-at / discount field exists (not fabricated).
        const oldPrice = '';
        return `
  <product>
    <product_id>${xmlEscape(p.id)}</product_id>
    <title>${xmlEscape(p.name)}</title>
    <price>${price}</price>
    <old_price>${oldPrice}</old_price>
    <availability>${avail}</availability>
    <image_link>${xmlEscape(img)}</image_link>
    <link>${xmlEscape(link)}</link>
    <category>${xmlEscape(p.category?.name || p.fabric || 'مانتو')}</category>
    <brand>پوشاک ترنم</brand>
    <sizes>${xmlEscape(sizes)}</sizes>
    <colors>${xmlEscape(colors)}</colors>
  </product>`;
      })
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<products>${items}\n</products>`;
    res.send(xml);
  }

  @Get('bam.csv')
  @ApiOperation({ summary: 'فید CSV بام' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async bam(@Res() res: Response) {
    const rows = await this.products.find({
      where: { status: 'ACTIVE' },
      relations: ['variants', 'category'],
      take: 2000,
    });
    const base = this.siteBase().replace(/\/$/, '');
    const header = 'product_id,title,price,old_price,availability,image_link,link,category,brand,sizes,colors';
    const lines = rows
      .filter((p) => Number(p.retailPrice) > 0)
      .map((p) => {
        const price = Number(p.retailPrice);
        const variantStock = (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);
        const stock = variantStock > 0 ? variantStock : Number(p.stock) || 0;
        const avail = stock > 0 ? 'in stock' : 'out of stock';
        const img = absMedia(p.images?.[0], base);
        const link = `${base}/products/${p.slug || p.id}`;
        const sizes = [...new Set((p.variants || []).map((v) => v.size).filter(Boolean))].join('|');
        const colors = [...new Set((p.variants || []).map((v) => v.color).filter(Boolean))].join('|');
        const esc = (s: string) => `"${String(s || '').replace(/"/g, '""')}"`;
        return [
          p.id,
          esc(p.name),
          price,
          '', // no fabricated old_price
          avail,
          esc(img),
          esc(link),
          esc(p.category?.name || p.fabric || 'مانتو'),
          esc('پوشاک ترنم'),
          esc(sizes),
          esc(colors),
        ].join(',');
      });

    res.send('\uFEFF' + [header, ...lines].join('\n'));
  }
}
