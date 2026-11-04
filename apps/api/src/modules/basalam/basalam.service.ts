import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { irrToTomanOnce } from '@taranom/shared-types';
import { IntegrationHealthTracker } from '../../common/integration-health';
import { ProductEntity } from '../product/entities/product.entity';
import { SettingsService } from '../settings/settings.service';
import {
  channelAvailability,
  channelUnitStock,
  isChannelVisible,
} from '../product/channel-product-projection';
import { RETAIL_CANONICAL_ORIGIN } from '../torob/torob-product-projection';
import {
  BASALAM_OPENAPI_BASE,
  absMediaUrl,
  basalamRetailPriceRial,
  buildCreatePayload,
  createSkipReason,
  createdProductId,
  flattenCategories,
  matchStallProduct,
  parseStallList,
  pickCategoryId,
  pickClothingCategoryId,
  pickPhotoUrls,
  type StallProduct,
} from './basalam-catalog';
import { BASALAM_HTTP, type BasalamHttp } from './basalam-http';

export type BasalamRunOptions = { dryRun?: boolean };

/**
 * Lightweight Basalam Core/OpenAPI client (https://developers.basalam.com / https://doc.basalam.com).
 * Admin stores Personal Access Token + vendorId; sync pushes ACTIVE retail products.
 *
 * Only uses documented endpoints — do not invent private Basalam APIs.
 * Retry: create persists basalamProductMap per product; PATCH by id is idempotent.
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
    @Inject(BASALAM_HTTP) private readonly http: BasalamHttp,
  ) {}

  private async bearerHeaders() {
    const m = await this.settings.marketing();
    if (!m.basalamAccessToken?.trim()) {
      throw new BadRequestException('توکن باسلام در تنظیمات مارکتینگ تنظیم نشده است');
    }
    return {
      Authorization: `Bearer ${m.basalamAccessToken.trim()}`,
      Accept: 'application/json',
    };
  }

  private async jsonHeaders() {
    return {
      ...(await this.bearerHeaders()),
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
          'POST vendors/{vendorId}/products is mapped after each create; PATCH products/{id} upserts price/stock. Concurrent runs are serialized in-process.',
      },
      docs: 'https://doc.basalam.com',
      developers: 'https://developers.basalam.com',
    };
  }

  async me() {
    const headers = await this.jsonHeaders();
    const res = await this.http.request({
      method: 'GET',
      url: `${this.coreBase}/users/me`,
      headers,
      timeoutMs: 15_000,
    });
    const json = res.json as any;
    if (!res.ok) {
      throw new BadRequestException(json?.message || `Basalam users/me failed (${res.status})`);
    }
    return json;
  }

  async status() {
    const m = await this.settings.marketing();
    const configured = !!(m.basalamAccessToken && m.basalamVendorId);
    const health = this.health();
    const map = (m.basalamProductMap || {}) as Record<string, number>;
    const mappedCount = Object.keys(map).length;
    if (!configured) {
      return {
        configured: false,
        ok: false,
        mappedCount,
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
        mappedCount,
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
        mappedCount,
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
   * `dryRun`: returns the exact bulk body without any Basalam call (no token/enabled needed).
   */
  async syncInventory(limit = 50, opts: BasalamRunOptions = {}) {
    if (opts.dryRun) return this.syncInventoryDryRun(limit);
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

    const headers = await this.jsonHeaders();
    const { updates, unmapped, invalidPrice } = await this.collectInventoryUpdates(
      (m.basalamProductMap || {}) as Record<string, number>,
      limit,
    );

    if (!updates.length) {
      this.tracker.recordSuccess({ op: 'syncInventory', updated: 0, unmapped: unmapped.length });
      return {
        ok: true,
        updated: 0,
        unmappedCount: unmapped.length,
        unmappedSample: unmapped.slice(0, 20),
        invalidPriceSample: invalidPrice.slice(0, 20),
        hint: 'ابتدا دکمه «ارسال محصولات تکی به غرفه» را بزنید تا نگاشت ساخته شود.',
        retry: { idempotent: true },
      };
    }

    // Official bulk update endpoint (Core service) — already used; do not invent alternatives.
    const res = await this.http.request({
      method: 'PATCH',
      url: this.bulkUpdateUrl(vendorId),
      headers,
      body: { data: updates },
      timeoutMs: 30_000,
    });
    const json = res.json;
    if (!res.ok) {
      this.logger.warn(`Basalam bulk update failed: ${res.status} ${JSON.stringify(json)}`);
      let ok = 0;
      const errors: string[] = [];
      for (const u of updates.slice(0, 20)) {
        try {
          const r = await this.http.request({
            method: 'PATCH',
            url: `${this.coreBase}/products/${u.id}`,
            headers,
            body: { primary_price: u.primary_price, stock: u.stock },
            timeoutMs: 15_000,
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
      invalidPriceSample: invalidPrice.slice(0, 20),
      response: json,
      retry: { idempotent: true },
    };
  }

  private bulkUpdateUrl(vendorId: number | string) {
    // Official bulk update endpoint (Core service) — already used; do not invent alternatives.
    return `${this.coreBase}/vendors/${vendorId}/products/bulk`;
  }

  private async collectInventoryUpdates(map: Record<string, number>, limit: number) {
    const rows = await this.products.find({
      where: { status: 'ACTIVE' },
      relations: ['variants'],
      take: limit,
    });
    const updates: Array<{ id: number; primary_price: number; stock: number }> = [];
    const unmapped: string[] = [];
    const invalidPrice: string[] = [];
    for (const p of rows) {
      if (!isChannelVisible(p, 'RETAIL')) continue;
      const basalamId = map[p.id];
      if (!basalamId) {
        unmapped.push(p.sku || p.id);
        continue;
      }
      let primaryPrice: number;
      try {
        primaryPrice = basalamRetailPriceRial(p);
      } catch {
        invalidPrice.push(p.sku || p.id);
        continue;
      }
      const { stock } = channelAvailability(p, 'RETAIL');
      updates.push({ id: Number(basalamId), primary_price: primaryPrice, stock });
    }
    return { updates, unmapped, invalidPrice };
  }

  private async syncInventoryDryRun(limit: number) {
    const m = await this.settings.marketing();
    const vendorId = Number(m.basalamVendorId) || null;
    const { updates, unmapped, invalidPrice } = await this.collectInventoryUpdates(
      (m.basalamProductMap || {}) as Record<string, number>,
      limit,
    );
    return {
      ok: true,
      dryRun: true,
      config: this.dryRunConfig(m),
      request: {
        method: 'PATCH',
        url: this.bulkUpdateUrl(vendorId ?? '{vendorId}'),
        body: { data: updates },
      },
      updated: 0,
      wouldUpdate: updates.length,
      unmappedCount: unmapped.length,
      unmappedSample: unmapped.slice(0, 20),
      invalidPriceSample: invalidPrice.slice(0, 20),
      notes: ['dry-run: no request sent to Basalam; prices are Rial (primary_price).'],
    };
  }

  private dryRunConfig(m: { basalamEnabled?: boolean; basalamAccessToken?: string; basalamVendorId?: string }) {
    return {
      enabled: m.basalamEnabled === true,
      hasToken: !!String(m.basalamAccessToken || '').trim(),
      vendorId: Number(m.basalamVendorId) || null,
    };
  }

  /**
   * Create missing retail products on the stall (unpublished) and map existing ones.
   * Official OpenAPI: POST /v1/files then POST /v1/vendors/{id}/products.
   * `dryRun`: returns create bodies (photos as URLs) — no upload, no create, no map write.
   */
  async pushCatalog(limit = 8, opts: BasalamRunOptions = {}) {
    if (opts.dryRun) return this.pushCatalogDryRun(Math.min(20, Math.max(1, limit)));
    if (this.syncInFlight) {
      throw new BadRequestException(
        'همگام‌سازی باسلام در حال اجراست — پس از اتمام دوباره تلاش کنید (idempotent retry).',
      );
    }
    this.syncInFlight = true;
    try {
      return await this.pushCatalogInner(Math.min(20, Math.max(1, limit)));
    } finally {
      this.syncInFlight = false;
    }
  }

  private async pushCatalogInner(limit: number) {
    const m = await this.settings.marketing();
    if (!m.basalamEnabled) {
      throw new BadRequestException('همگام‌سازی باسلام غیرفعال است — ابتدا گزینه فعال‌سازی را روشن و ذخیره کنید.');
    }
    const vendorId = Number(m.basalamVendorId);
    if (!vendorId) throw new BadRequestException('basalamVendorId نامعتبر است');

    const map = { ...((m.basalamProductMap || {}) as Record<string, number>) };
    const origin = (process.env.NEXT_PUBLIC_RETAIL_URL || RETAIL_CANONICAL_ORIGIN).replace(/\/$/, '');
    const rows = await this.products.find({
      where: { status: 'ACTIVE' },
      relations: ['variants', 'category'],
    });
    const retail = rows.filter((p) => isChannelVisible(p, 'RETAIL'));
    const pending = retail.filter((p) => !Number(map[p.id]));

    const auth = await this.bearerHeaders();
    const jsonHeaders = await this.jsonHeaders();
    const stall = await this.listStallProducts(vendorId, auth);
    let categoryId = pickCategoryId(stall);
    if (!categoryId) categoryId = await this.lookupClothingCategory(auth);
    if (!categoryId) {
      throw new BadRequestException(
        'دسته باسلام پیدا نشد. یک محصول در غرفه بسازید یا از دسته‌بندی پوشاک در پنل باسلام استفاده کنید.',
      );
    }

    const created: string[] = [];
    const mapped: string[] = [];
    const failed: Array<{ sku: string; error: string }> = [];
    // Unmatched zero-retail-stock rows are skipped before batching so they never block real creates.
    const skipped: Array<{ sku: string; reason: string }> = [];
    const candidates = pending.filter((product) => {
      const onStall = matchStallProduct({ id: product.id, sku: product.sku, name: product.name }, stall, map);
      if (onStall) return true;
      const reason = createSkipReason(channelAvailability(product, 'RETAIL').stock);
      if (reason) skipped.push({ sku: product.sku || product.id, reason });
      return !reason;
    });
    const batch = candidates.slice(0, limit);

    for (const product of batch) {
      try {
        const stallId = matchStallProduct(
          { id: product.id, sku: product.sku, name: product.name },
          stall,
          map,
        );
        if (stallId) {
          map[product.id] = stallId;
          await this.persistProductMap({ [product.id]: stallId });
          mapped.push(product.sku || product.id);
          continue;
        }

        const skipReason = createSkipReason(channelAvailability(product, 'RETAIL').stock);
        if (skipReason) {
          skipped.push({ sku: product.sku || product.id, reason: skipReason });
          continue;
        }

        const photoIds = await this.uploadProductPhotos(auth, pickPhotoUrls(product.images, origin));
        if (!photoIds.length) {
          failed.push({ sku: product.sku || product.id, error: 'تصویر محصول برای آپلود به باسلام موجود نیست' });
          continue;
        }

        const body = this.buildProductCreateBody(product, photoIds, categoryId);
        const res = await this.http.request({
          method: 'POST',
          url: `${BASALAM_OPENAPI_BASE}/vendors/${vendorId}/products`,
          headers: jsonHeaders,
          body,
          timeoutMs: 30_000,
        });
        const json = res.json;
        const newId = createdProductId(json);
        if (!res.ok || !newId) {
          const message = String((json as any)?.message || (json as any)?.error || `create ${res.status}`);
          failed.push({ sku: product.sku || product.id, error: message.slice(0, 240) });
          continue;
        }
        map[product.id] = newId;
        stall.push({ id: newId, title: product.name, sku: product.sku || null, categoryId });
        await this.persistProductMap({ [product.id]: newId });
        created.push(product.sku || product.id);
        await new Promise((r) => setTimeout(r, 250));
      } catch (e: any) {
        failed.push({ sku: product.sku || product.id, error: String(e?.message || e).slice(0, 240) });
      }
    }

    const remaining = candidates.length - batch.length;
    this.tracker.recordSuccess({
      op: 'pushCatalog',
      created: created.length,
      mapped: mapped.length,
      failed: failed.length,
      skipped: skipped.length,
    });
    return {
      ok: failed.length === 0,
      created: created.length,
      mappedExisting: mapped.length,
      failed: failed.length,
      failedSample: failed.slice(0, 10),
      skipped: skipped.length,
      skippedSample: skipped.slice(0, 20),
      remaining,
      hasMore: remaining > 0,
      hint:
        created.length || mapped.length
          ? 'محصول‌های جدید به‌صورت پیش‌نویس در غرفه هستند؛ بعد از بررسی عکس، از پنل باسلام منتشر کنید.'
          : 'محصول جدیدی ساخته نشد.',
      retry: { idempotent: true },
    };
  }

  private buildProductCreateBody(product: ProductEntity, photoIds: number[], categoryId: number) {
    const { stock } = channelAvailability(product, 'RETAIL');
    return buildCreatePayload({
      name: product.name,
      sku: product.sku,
      description: product.retailFullContent || product.description,
      priceIrr: basalamRetailPriceRial(product),
      stock,
      photoIds,
      categoryId,
    });
  }

  /**
   * Offline preview of pushCatalog. Makes zero Basalam calls, so stall matching and
   * category lookup (both remote reads) are not evaluated; see `notes` in the response.
   */
  private async pushCatalogDryRun(limit: number) {
    const m = await this.settings.marketing();
    const map = (m.basalamProductMap || {}) as Record<string, number>;
    const vendorId = Number(m.basalamVendorId) || null;
    const origin = (process.env.NEXT_PUBLIC_RETAIL_URL || RETAIL_CANONICAL_ORIGIN).replace(/\/$/, '');
    const rows = await this.products.find({
      where: { status: 'ACTIVE' },
      relations: ['variants', 'category'],
    });
    const pending = rows.filter((p) => isChannelVisible(p, 'RETAIL') && !Number(map[p.id]));
    const skipped: Array<{ sku: string; reason: string }> = [];
    const candidates = pending.filter((product) => {
      const reason = createSkipReason(channelAvailability(product, 'RETAIL').stock);
      if (reason) skipped.push({ sku: product.sku || product.id, reason });
      return !reason;
    });
    const batch = candidates.slice(0, limit);
    const url = `${BASALAM_OPENAPI_BASE}/vendors/${vendorId ?? '{vendorId}'}/products`;

    const items = batch.map((product) => {
      const base = {
        localId: product.id,
        sku: product.sku || null,
        variants: (product.variants || []).map((v) => ({
          size: v.size,
          color: v.color,
          retailStock: channelUnitStock(v, 'RETAIL'),
        })),
      };
      const photoUrls = pickPhotoUrls(product.images, origin);
      if (!photoUrls.length) {
        return { ...base, action: 'fail' as const, error: 'تصویر محصول برای آپلود به باسلام موجود نیست' };
      }
      try {
        // Index placeholders keep the photo/photos split identical to the real payload.
        const body = this.buildProductCreateBody(
          product,
          photoUrls.map((_, i) => i + 1),
          0,
        );
        const toUrl = (id: unknown) => photoUrls[Number(id) - 1];
        if (body.photo !== undefined) body.photo = toUrl(body.photo);
        if (Array.isArray(body.photos)) body.photos = body.photos.map(toUrl);
        body.category_id = null;
        return { ...base, action: 'create' as const, request: { method: 'POST', url, body } };
      } catch (e: any) {
        return { ...base, action: 'fail' as const, error: String(e?.message || e).slice(0, 240) };
      }
    });

    return {
      ok: items.every((item) => item.action !== 'fail'),
      dryRun: true,
      config: this.dryRunConfig(m),
      wouldCreate: items.filter((item) => item.action === 'create').length,
      wouldFail: items.filter((item) => item.action === 'fail').length,
      skipped: skipped.length,
      skippedSample: skipped.slice(0, 20),
      remaining: candidates.length - batch.length,
      items,
      notes: [
        'dry-run: no request sent to Basalam; photos are source URLs (not uploaded); product map unchanged.',
        'category_id is resolved from the stall at push time; stall matching (map existing) is not evaluated offline.',
        'zero retail stock rows are skipped; at push time they are still mapped if already on the stall.',
        'primary_price is Rial.',
      ],
    };
  }

  private async persistProductMap(extra: Record<string, number>) {
    const prev = await this.settings.get('marketing');
    const nextMap = { ...((prev.basalamProductMap || {}) as Record<string, number>), ...extra };
    await this.settings.set('marketing', { ...prev, basalamProductMap: nextMap });
  }

  private async listStallProducts(
    vendorId: number,
    auth: { Authorization: string; Accept: string },
  ): Promise<StallProduct[]> {
    const out: StallProduct[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const res = await this.http.request({
        method: 'GET',
        url: `${BASALAM_OPENAPI_BASE}/vendors/${vendorId}/products?page=${page}&per_page=50`,
        headers: auth,
        timeoutMs: 20_000,
      });
      const json = res.json;
      if (!res.ok) {
        throw new BadRequestException(
          String((json as any)?.message || `لیست غرفه باسلام ناموفق شد (${res.status})`),
        );
      }
      const rows = parseStallList(json);
      out.push(...rows);
      const totalPage = Number((json as any)?.total_page || (json as any)?.totalPage || 1);
      if (page >= totalPage || rows.length === 0) break;
    }
    return out;
  }

  private async lookupClothingCategory(auth: { Authorization: string; Accept: string }): Promise<number | null> {
    const res = await this.http.request({
      method: 'GET',
      url: `${BASALAM_OPENAPI_BASE}/categories`,
      headers: auth,
      timeoutMs: 15_000,
    });
    if (!res.ok) return null;
    return pickClothingCategoryId(flattenCategories(res.json));
  }

  private async uploadProductPhotos(
    auth: { Authorization: string; Accept: string },
    urls: string[],
  ): Promise<number[]> {
    const ids: number[] = [];
    for (const url of urls.slice(0, 5)) {
      const id = await this.uploadOnePhoto(auth, absMediaUrl(url, RETAIL_CANONICAL_ORIGIN) || url);
      if (id) ids.push(id);
    }
    return ids;
  }

  private async uploadOnePhoto(
    auth: { Authorization: string; Accept: string },
    url: string,
  ): Promise<number | null> {
    const img = await this.http.download(url, 20_000);
    if (!img.ok) {
      this.logger.warn(`Basalam photo download failed ${img.status} ${url.slice(0, 80)}`);
      return null;
    }
    const mime = img.contentType || 'image/jpeg';
    if (!mime.startsWith('image/')) return null;
    if (img.bytes.length < 32) return null;
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(img.bytes)], { type: mime }), `product.${ext}`);
    form.append('file_type', 'product.photo');
    const res = await this.http.request({
      method: 'POST',
      url: `${BASALAM_OPENAPI_BASE}/files`,
      headers: { Authorization: auth.Authorization },
      body: form,
      timeoutMs: 30_000,
    });
    const id = Number((res.json as any)?.id);
    if (!res.ok || !(id > 0)) {
      this.logger.warn(`Basalam file upload failed ${res.status}`);
      return null;
    }
    return id;
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
      .filter((p) => isChannelVisible(p, 'RETAIL'))
      .map((p) => {
        const { stock } = channelAvailability(p, 'RETAIL');
        return {
          localId: p.id,
          sku: p.sku,
          title: p.name,
          priceIrr: Number(p.retailPrice),
          priceToman: irrToTomanOnce(Number(p.retailPrice)),
          stock,
          category: p.category?.name || p.fabric,
          link: `${base}/products/${p.slug || p.id}`,
          image: p.images?.[0] || null,
        };
      });
  }
}
