import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from '../product/entities/product.entity';
import { SettingsService } from '../settings/settings.service';

/**
 * Lightweight Basalam Core API client (https://developers.basalam.com / https://doc.basalam.com).
 * Admin stores Personal Access Token + vendorId; sync pushes ACTIVE retail products.
 */
@Injectable()
export class BasalamService {
  private readonly logger = new Logger(BasalamService.name);
  private readonly coreBase = 'https://core.basalam.com/v3';

  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    private readonly settings: SettingsService,
  ) {}

  private async authHeaders() {
    const m = await this.settings.marketing();
    if (!m.basalamAccessToken?.trim()) {
      throw new BadRequestException('توکن باسلام در تنظیمات مارکتینگ تنظیم نشده است');
    }
    return {
      Authorization: `Bearer ${m.basalamAccessToken.trim()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  async me() {
    const headers = await this.authHeaders();
    const res = await fetch(`${this.coreBase}/users/me`, { headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadRequestException(json?.message || `Basalam users/me failed (${res.status})`);
    }
    return json;
  }

  async status() {
    const m = await this.settings.marketing();
    const configured = !!(m.basalamAccessToken && m.basalamVendorId);
    if (!configured) {
      return {
        configured: false,
        docs: 'https://doc.basalam.com',
        developers: 'https://developers.basalam.com',
        hint: 'در پنل باسلام کلاینت بسازید، توکن بگیرید و vendorId + accessToken را در تنظیمات ذخیره کنید.',
      };
    }
    try {
      const me = await this.me();
      return {
        configured: true,
        vendorId: m.basalamVendorId,
        userId: me?.id,
        vendorTitle: me?.vendor?.title,
        docs: 'https://doc.basalam.com',
      };
    } catch (e: any) {
      return { configured: true, ok: false, error: e?.message || String(e) };
    }
  }

  /**
   * Push / update product stock & price to Basalam using bulk update when basalamProductId map exists.
   * Mapping lives in marketing.basalamProductMap: { [localProductId]: basalamProductId }
   */
  async syncInventory(limit = 50) {
    const m = await this.settings.marketing();
    if (!m.basalamEnabled) {
      throw new BadRequestException('همگام‌سازی باسلام غیرفعال است');
    }
    const vendorId = Number(m.basalamVendorId);
    if (!vendorId) throw new BadRequestException('basalamVendorId نامعتبر است');

    const map = (m.basalamProductMap || {}) as Record<string, number>;
    const headers = await this.authHeaders();
    const rows = await this.products.find({
      where: { status: 'ACTIVE' },
      relations: ['variants'],
      take: limit,
    });

    const updates: Array<{ id: number; price?: number; stock?: number; status?: number }> = [];
    const unmapped: string[] = [];

    for (const p of rows) {
      if (!(Number(p.retailPrice) > 0)) continue;
      const basalamId = map[p.id];
      if (!basalamId) {
        unmapped.push(p.sku || p.id);
        continue;
      }
      const variantStock = (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);
      const stock = variantStock > 0 ? variantStock : Number(p.stock) || 0;
      // Basalam prices are typically in Toman for vendor panel; API often expects Rial — send IRR as stored.
      updates.push({
        id: Number(basalamId),
        price: Number(p.retailPrice),
        stock,
      });
    }

    if (!updates.length) {
      return {
        ok: true,
        updated: 0,
        unmappedCount: unmapped.length,
        unmappedSample: unmapped.slice(0, 20),
        hint: 'برای هر محصول در ادمین، شناسه محصول باسلام را در basalamProductMap ثبت کنید یا ابتدا محصول را در غرفه بسازید.',
      };
    }

    // Official bulk update endpoint (Core service).
    const url = `${this.coreBase}/vendors/${vendorId}/products/bulk`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ data: updates }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.logger.warn(`Basalam bulk update failed: ${res.status} ${JSON.stringify(json)}`);
      // Fallback: try per-product PATCH
      let ok = 0;
      const errors: string[] = [];
      for (const u of updates.slice(0, 20)) {
        try {
          const r = await fetch(`${this.coreBase}/products/${u.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ price: u.price, stock: u.stock }),
          });
          if (r.ok) ok += 1;
          else errors.push(`${u.id}:${r.status}`);
        } catch (e: any) {
          errors.push(`${u.id}:${e?.message}`);
        }
      }
      return { ok: false, bulkStatus: res.status, bulkBody: json, fallbackUpdated: ok, errors };
    }

    return {
      ok: true,
      updated: updates.length,
      unmappedCount: unmapped.length,
      unmappedSample: unmapped.slice(0, 20),
      response: json,
    };
  }

  /** Catalog export helpers for manual import into Basalam panel when API map is empty. */
  async catalogExport(limit = 200) {
    const base = (process.env.NEXT_PUBLIC_RETAIL_URL || 'https://www.poshaktaranom.ir').replace(/\/$/, '');
    const rows = await this.products.find({
      where: { status: 'ACTIVE' },
      relations: ['variants', 'category'],
      take: limit,
    });
    return rows
      .filter((p) => Number(p.retailPrice) > 0)
      .map((p) => {
        const variantStock = (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);
        const stock = variantStock > 0 ? variantStock : Number(p.stock) || 0;
        return {
          localId: p.id,
          sku: p.sku,
          title: p.name,
          priceIrr: Number(p.retailPrice),
          priceToman: Math.round(Number(p.retailPrice) / 10),
          stock,
          category: p.category?.name || p.fabric,
          link: `${base}/products/${p.slug || p.id}`,
          image: p.images?.[0] || null,
        };
      });
  }
}
