import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { ProductService } from '../product/product.service';
import { InventoryService } from '../inventory/inventory.service';
import { ErpVariantMapEntity } from './entities/erp-variant-map.entity';
import { ErpProductMapEntity } from './entities/erp-product-map.entity';
import { ErpInventoryIdempotencyEntity } from './entities/erp-inventory-idempotency.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import { ErpMatrixUpsertDto, ErpMatrixVariantDto } from './dto/erp-matrix.dto';
import { normalizeErpLabel, variantMatchKey } from './erp-text-normalize';
import { channelUnitStock } from '../product/channel-product-projection';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type MatchedVariantResult = {
  erpVariantSku: string;
  variantId: string;
  matchedBy: string;
  qty: number;
  stock?: number;
};

export type UnmatchedVariantResult = {
  erpVariantSku: string;
  color: string;
  size: string;
  barcode?: string;
  reason: string;
};

export type MatrixUpsertResult = {
  ok: boolean;
  productId: string | null;
  productSku: string;
  /** sku | product_map | barcode — how the site product was resolved */
  resolvedBy?: 'sku' | 'product_map' | 'barcode';
  channel: 'WHOLESALE' | 'RETAIL';
  dryRun: boolean;
  matched: MatchedVariantResult[];
  unmatched: UnmatchedVariantResult[];
  idempotent?: boolean;
};

@Injectable()
export class ErpInventoryService {
  constructor(
    private readonly productService: ProductService,
    private readonly inventoryService: InventoryService,
    @InjectRepository(ErpVariantMapEntity)
    private readonly mapRepo: Repository<ErpVariantMapEntity>,
    @InjectRepository(ErpProductMapEntity)
    private readonly productMapRepo: Repository<ErpProductMapEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variantRepo: Repository<ProductVariantEntity>,
    @InjectRepository(ErpInventoryIdempotencyEntity)
    private readonly idemRepo: Repository<ErpInventoryIdempotencyEntity>,
  ) {}

  async ping() {
    return { ok: true, service: 'erp-inventory', ts: new Date().toISOString() };
  }

  async upsertMatrix(body: ErpMatrixUpsertDto): Promise<MatrixUpsertResult> {
    const channel = body.channel === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    const dryRun = Boolean(body.dryRun);
    const productSku = String(body.productSku || '').trim();
    const idemKey = String(body.idempotencyKey || '').trim();

    if (idemKey && !dryRun) {
      const cached = await this.readIdempotency(idemKey);
      if (cached) return { ...cached, idempotent: true } as MatrixUpsertResult;
    }

    const resolved = await this.resolveProduct(productSku, body.variants || [], dryRun);
    if (!resolved) {
      const result: MatrixUpsertResult = {
        ok: false,
        productId: null,
        productSku,
        channel,
        dryRun,
        matched: [],
        unmatched: (body.variants || []).map((v) => ({
          erpVariantSku: v.erpVariantSku,
          color: v.color,
          size: v.size,
          barcode: v.barcode,
          reason: 'product_sku_not_found',
        })),
      };
      if (idemKey && !dryRun) await this.writeIdempotency(idemKey, result);
      return result;
    }

    const { product, resolvedBy } = resolved;

    const variants = product.variants || [];
    const byKey = new Map<string, (typeof variants)[0]>();
    for (const v of variants) {
      byKey.set(variantMatchKey(v.color, v.size), v);
    }

    const matched: MatchedVariantResult[] = [];
    const unmatched: UnmatchedVariantResult[] = [];

    for (const row of body.variants || []) {
      const resolved = await this.resolveVariant(product.id, variants, byKey, row);
      if (!resolved) {
        unmatched.push({
          erpVariantSku: String(row.erpVariantSku || '').trim(),
          color: row.color,
          size: row.size,
          barcode: row.barcode,
          reason: 'variant_not_matched',
        });
        continue;
      }

      const qty = Math.max(0, Math.round(Number(row.qty) || 0));
      if (!dryRun) {
        await this.inventoryService.setStock(
          resolved.variant.id,
          qty,
          'ERP matrix sync',
          'erp',
          channel,
        );
        if (resolved.matchedBy !== 'map') {
          await this.persistMap(
            String(row.erpVariantSku || '').trim(),
            product.id,
            resolved.variant.id,
            resolved.matchedBy,
          );
        }
      }

      const stockAfter = dryRun
        ? channelUnitStock(resolved.variant, channel)
        : qty;

      matched.push({
        erpVariantSku: String(row.erpVariantSku || '').trim(),
        variantId: resolved.variant.id,
        matchedBy: resolved.matchedBy,
        qty,
        stock: stockAfter,
      });
    }

    const result: MatrixUpsertResult = {
      ok: unmatched.length === 0,
      productId: product.id,
      productSku,
      resolvedBy,
      channel,
      dryRun,
      matched,
      unmatched,
    };

    if (idemKey && !dryRun) await this.writeIdempotency(idemKey, result);
    return result;
  }

  async upsertBulk(items: ErpMatrixUpsertDto[]): Promise<{
    ok: boolean;
    results: MatrixUpsertResult[];
  }> {
    const results: MatrixUpsertResult[] = [];
    for (const item of items || []) {
      results.push(await this.upsertMatrix(item));
    }
    return {
      ok: results.every((r) => r.ok),
      results,
    };
  }

  private async resolveProduct(
    erpProductSku: string,
    variantRows: ErpMatrixVariantDto[],
    dryRun: boolean,
  ): Promise<{ product: Awaited<ReturnType<ProductService['findBySku']>>; resolvedBy: 'sku' | 'product_map' | 'barcode' } | null> {
    try {
      const product = await this.productService.findBySku(erpProductSku);
      return { product, resolvedBy: 'sku' };
    } catch (e) {
      if (!(e instanceof NotFoundException)) throw e;
    }

    if (erpProductSku) {
      const mapped = await this.productMapRepo.findOne({
        where: { erpProductSku },
      });
      if (mapped?.productId) {
        try {
          const product = await this.productService.findOne(mapped.productId, undefined, {
            allowNonActive: true,
          });
          return { product, resolvedBy: 'product_map' };
        } catch (e) {
          if (!(e instanceof NotFoundException)) throw e;
        }
      }
    }

    const barcodes = [
      ...new Set(
        (variantRows || [])
          .map((v) => String(v.barcode || '').trim())
          .filter(Boolean),
      ),
    ];
    if (barcodes.length === 0) return null;

    const hits = await this.variantRepo.find({
      where: { barcode: In(barcodes) },
    });
    if (!hits.length) return null;

    const productIds = [...new Set(hits.map((h) => h.productId))];
    if (productIds.length !== 1) return null;

    const productId = productIds[0];
    let product: Awaited<ReturnType<ProductService['findBySku']>>;
    try {
      product = await this.productService.findOne(productId, undefined, {
        allowNonActive: true,
      });
    } catch (e) {
      if (e instanceof NotFoundException) return null;
      throw e;
    }

    if (!dryRun && erpProductSku) {
      await this.persistProductMap(erpProductSku, product.id, 'barcode');
    }

    return { product, resolvedBy: 'barcode' };
  }

  private async persistProductMap(
    erpProductSku: string,
    productId: string,
    matchedBy: string,
  ) {
    if (!erpProductSku) return;
    await this.productMapRepo.save(
      this.productMapRepo.create({
        erpProductSku,
        productId,
        matchedBy,
      }),
    );
  }

  private async resolveVariant(
    productId: string,
    variants: Array<{ id: string; color: string; size: string; barcode?: string | null; wholesaleStock?: number; retailStock?: number }>,
    byKey: Map<string, { id: string; color: string; size: string; barcode?: string | null; wholesaleStock?: number; retailStock?: number }>,
    row: ErpMatrixVariantDto,
  ): Promise<{ variant: (typeof variants)[0]; matchedBy: string } | null> {
    const erpSku = String(row.erpVariantSku || '').trim();
    if (erpSku) {
      const mapped = await this.mapRepo.findOne({ where: { erpVariantSku: erpSku } });
      if (mapped && mapped.productId === productId) {
        const v = variants.find((x) => x.id === mapped.variantId);
        if (v) return { variant: v, matchedBy: 'map' };
      }
    }

    const key = variantMatchKey(row.color, row.size);
    const byColorSize = byKey.get(key);
    if (byColorSize) return { variant: byColorSize, matchedBy: 'color_size' };

    const barcode = String(row.barcode || '').trim();
    if (barcode) {
      const hits = variants.filter((v) => String(v.barcode || '').trim() === barcode);
      if (hits.length === 1) return { variant: hits[0], matchedBy: 'barcode' };
    }

    return null;
  }

  private async persistMap(
    erpVariantSku: string,
    productId: string,
    variantId: string,
    matchedBy: string,
  ) {
    if (!erpVariantSku) return;
    await this.mapRepo.save(
      this.mapRepo.create({
        erpVariantSku,
        productId,
        variantId,
        matchedBy,
      }),
    );
  }

  private async readIdempotency(key: string): Promise<MatrixUpsertResult | null> {
    const row = await this.idemRepo.findOne({ where: { idempotencyKey: key } });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await this.idemRepo.delete({ idempotencyKey: key });
      return null;
    }
    return row.response as unknown as MatrixUpsertResult;
  }

  private async writeIdempotency(key: string, response: MatrixUpsertResult) {
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);
    await this.idemRepo.save(
      this.idemRepo.create({
        idempotencyKey: key,
        response: response as unknown as Record<string, unknown>,
        expiresAt,
      }),
    );
    // Opportunistic cleanup of expired keys (bounded)
    await this.idemRepo.delete({ expiresAt: LessThan(new Date()) });
  }
}

/** Re-export for tests that only need normalize helpers. */
export { normalizeErpLabel };
