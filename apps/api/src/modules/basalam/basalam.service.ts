import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationHealthTracker } from '../../common/integration-health';
import { ProductEntity } from '../product/entities/product.entity';
import { SettingsService } from '../settings/settings.service';

/**
 * Lightweight Basalam Core API client (https://developers.basalam.com / https://doc.basalam.com).
 * Admin stores Personal Access Token + vendorId; sync pushes ACTIVE retail products.
 *
 * Only uses endpoints already wired here — do not invent private Basalam APIs.
 * Retry: syncInventory PATCH by basalam product id is idempotent (same price/stock → same state).
 */
@Injectable()
export class BasalamService {
  private readonly logger = new Logger(BasalamService.name);
  private readonly coreBase = 'https://core.basalam.com/v3';
  private readonly tracker = new IntegrationHealthTracker();
  private syncInFlight = false;

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

  health() {
    const snap = this.tracker.snapshot();
    const ok =
      snap.errorCount === 0 ||
      (snap.lastSuccessAt != null &&
        (snap.lastErrorAt == null || snap.lastSuccessAt >= snap.lastErrorAt));
    return {
      integration: 'basalam' as const,
      ok,
      ...snap,
      syncInFlight: this.syncInFlight,
      retry: {
        idempotent: true,
        notes:
          'PATCH vendors/{vendorId}/products/bulk and PATCH products/{id} upsert price/stock by Basalam product id; safe to retry. Concurrent syncs are serialized in-process.',
      },
      docs: 'https://doc.basalam.com',
      developers: 'https://developers.basalam.com',
    };
  }

  async me() {
    const headers = await this.authHeaders();
    const res = await fetch(`${this.coreBase}/users/me`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadRequestException(json?.message || `Basalam users/me failed (${res.status})`);
    }
    return json;
  }

  async status() {
    const m = await this.settings.marketing();
    const configured = !!(m.basalamAccessToken && m.basalamVendorId);
    const health = this.health();
    if (!configured) {
      return {
        configured: false,
        ok: false,
        lastSuccessAt: health.lastSuccessAt,
        lastErrorAt: health.lastErrorAt,
        lastError: health.lastError,
        docs: 'https://doc.basalam.com',
        developers: 'https://developers.basalam.com',
        hint: 'در پنل باسلام کلاینت بسازید، توکن بگیرید و vendorId + accessToken را در تنظیمات ذخیره کنید.',
        retry: health.retry,
      };
    }
    try {
      const me = await this.me();
      this.tracker.recordSuccess({ op: 'users/me', userId: me?.id });
      const snap = this.tracker.snapshot();
      return {
        configured: true,
        ok: true,
        vendorId: m.basalamVendorId,
        userId: me?.id,
        vendorTitle: me?.vendor?.title,
        lastSuccessAt: snap.lastSuccessAt,
        lastErrorAt: snap.lastErrorAt,
        lastError: snap.lastError,
        docs: 'https://doc.basalam.com',
        retry: health.retry,
      };
    } catch (e: any) {
      const msg = e?.message || String(e);
      this.tracker.recordError(msg, { op: 'users/me' });
      const snap = this.tracker.snapshot();
      return {
        configured: true,
        ok: false,
        error: msg,
        lastSuccessAt: snap.lastSuccessAt,
        lastErrorAt: snap.lastErrorAt,
        lastError: snap.lastError,
        retry: health.retry,
      };
    }
  }

  /**
   * Push / update product stock & price to Basalam using bulk update when basalamProductId map exists.
   * Mapping lives in marketing.basalamProductMap: { [localProductId]: basalamProductId }
   *
   * Idempotent retry: re-running with the same map/prices is safe (PATCH upsert).
   */
  async syncInventory(limit = 50) {
    if (this.syncInFlight) {
      throw new BadRequestException(
        'همگام‌سازی باسلام در حال اجراست — پس از اتمام دوباره تلاش کنید (idempotent retry).',
      );
    }
    this.syncInFlight = true;
    try {
      return await this.syncInventoryInner(limit);
    } finally {
      this.syncInFlight = false;
    }
  }

  private async syncInventoryInner(limit: number) {
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
      this.tracker.recordSuccess({ op: 'syncInventory', updated: 0, unmapped: unmapped.length });
      return {
        ok: true,
        updated: 0,
        unmappedCount: unmapped.length,
        unmappedSample: unmapped.slice(0, 20),
        hint: 'برای هر محصول در ادمین، شناسه محصول باسلام را در basalamProductMap ثبت کنید یا ابتدا محصول را در غرفه بسازید.',
        retry: { idempotent: true },
      };
    }

    // Official bulk update endpoint (Core service) — already used; do not invent alternatives.
    const url = `${this.coreBase}/vendors/${vendorId}/products/bulk`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ data: updates }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.logger.warn(`Basalam bulk update failed: ${res.status} ${JSON.stringify(json)}`);
      // Fallback: try per-product PATCH (existing path only)
      let ok = 0;
      const errors: string[] = [];
      for (const u of updates.slice(0, 20)) {
        try {
          const r = await fetch(`${this.coreBase}/products/${u.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ price: u.price, stock: u.stock }),
            signal: AbortSignal.timeout(15_000),
          });
          if (r.ok) ok += 1;
          else errors.push(`${u.id}:${r.status}`);
        } catch (e: any) {
          errors.push(`${u.id}:${e?.message}`);
        }
      }
      const result = {
        ok: false,
        bulkStatus: res.status,
        bulkBody: json,
        fallbackUpdated: ok,
        errors,
        retry: { idempotent: true, notes: 'Safe to retry; in-flight sync is serialized' },
      };
      if (ok > 0 && errors.length === 0) {
        this.tracker.recordSuccess({ op: 'syncInventory.fallback', updated: ok });
      } else {
        this.tracker.recordError(`bulk ${res.status}; fallback ok=${ok} errors=${errors.length}`, {
          op: 'syncInventory',
        });
      }
      return result;
    }

    this.tracker.recordSuccess({ op: 'syncInventory', updated: updates.length });
    return {
      ok: true,
      updated: updates.length,
      unmappedCount: unmapped.length,
      unmappedSample: unmapped.slice(0, 20),
      response: json,
      retry: { idempotent: true },
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
