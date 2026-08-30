import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ProductEntity } from '../product/entities/product.entity';
import { ProductVariantEntity } from '../product/entities/product-variant.entity';
import {
  enumeratePublishableOptions,
  projectTorobOption,
  RETAIL_CANONICAL_ORIGIN,
  TOROB_API_VERSION,
  TOROB_PAGE_SIZE,
  type TorobProductPayload,
  type TorobProjectionResult,
  type TorobSkipReason,
} from './torob-product-projection';
import {
  parseTorobProductRequest,
  torobMaxPages,
  type TorobProductQuery,
} from './torob-product-request';
import { torobProductMetrics } from './torob-metrics';

export interface TorobIncompleteRow {
  sku: string | null;
  productId: string;
  pageUnique?: string;
  reason: TorobSkipReason;
}

@Injectable()
export class TorobProductApiService {
  private readonly logger = new Logger(TorobProductApiService.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variants: Repository<ProductVariantEntity>,
  ) {}

  private mediaOrigin() {
    return (
      process.env.MINIO_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_RETAIL_URL ||
      RETAIL_CANONICAL_ORIGIN
    ).replace(/\/$/, '');
  }

  private storeOrigin() {
    return RETAIL_CANONICAL_ORIGIN;
  }

  private async loadRetailCatalog(): Promise<ProductEntity[]> {
    return this.products.find({
      where: { status: 'ACTIVE', showOnRetail: true, deletedAt: IsNull() },
      relations: ['variants', 'category'],
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  }

  projectCatalog(rows: ProductEntity[]): {
    published: TorobProductPayload[];
    skipped: TorobIncompleteRow[];
  } {
    const published: TorobProductPayload[] = [];
    const skipped: TorobIncompleteRow[] = [];
    for (const product of rows) {
      for (const result of enumeratePublishableOptions(product as any, this.mediaOrigin(), this.storeOrigin())) {
        if (result.publishable && result.payload) {
          published.push(result.payload);
        } else if (result.skipReason) {
          skipped.push({
            sku: result.sku ?? null,
            productId: result.productId,
            pageUnique: result.payload?.page_unique,
            reason: result.skipReason,
          });
        }
      }
    }
    return { published, skipped };
  }

  private sortKey(item: TorobProductPayload, sort: 'date_added_desc' | 'date_updated_desc'): string {
    return sort === 'date_updated_desc' ? item.date_updated : item.date_added;
  }

  private sortStable(
    items: TorobProductPayload[],
    sort: 'date_added_desc' | 'date_updated_desc',
  ): TorobProductPayload[] {
    return [...items].sort((a, b) => {
      const aTs = new Date(this.sortKey(a, sort)).getTime();
      const bTs = new Date(this.sortKey(b, sort)).getTime();
      if (aTs !== bTs) return bTs - aTs;
      return a.page_unique.localeCompare(b.page_unique);
    });
  }

  async handleRaw(body: unknown) {
    const query = parseTorobProductRequest(body);
    return this.handle(query);
  }

  async handle(query: TorobProductQuery) {
    const rows = await this.loadRetailCatalog();
    const { published, skipped } = this.projectCatalog(rows);
    torobProductMetrics.recordCatalog(published.length, skipped.length);
    if (skipped.length) {
      this.logger.warn(
        JSON.stringify({
          msg: 'torob_unpublished_products',
          count: skipped.length,
          reasons: skipped.slice(0, 20),
        }),
      );
    }

    if (query.mode === 'list') {
      const ordered = this.sortStable(published, query.sort);
      const total = ordered.length;
      const maxPages = torobMaxPages(total);
      const start = (query.page - 1) * TOROB_PAGE_SIZE;
      return {
        api_version: TOROB_API_VERSION,
        current_page: query.page,
        total,
        max_pages: maxPages,
        products: ordered.slice(start, start + TOROB_PAGE_SIZE),
      };
    }

    const wanted = new Set(query.mode === 'urls' ? query.page_urls : query.page_uniques);
    const matched = published.filter((item) =>
      query.mode === 'urls' ? wanted.has(item.page_url) : wanted.has(item.page_unique),
    );
    return {
      api_version: TOROB_API_VERSION,
      current_page: 1,
      total: matched.length,
      max_pages: torobMaxPages(matched.length),
      products: matched,
    };
  }

  async incompleteReport(): Promise<TorobIncompleteRow[]> {
    const rows = await this.loadRetailCatalog();
    return this.projectCatalog(rows).skipped;
  }

  async publishedCount(): Promise<number> {
    const rows = await this.loadRetailCatalog();
    return this.projectCatalog(rows).published.length;
  }

  projectOne(product: ProductEntity, variant?: ProductVariantEntity | null): TorobProjectionResult {
    return projectTorobOption({
      product: product as any,
      variant: variant ?? null,
      mediaOrigin: this.mediaOrigin(),
      storeOrigin: this.storeOrigin(),
    });
  }

  async lookupByUnique(pageUnique: string): Promise<TorobProductPayload | null> {
    const result = await this.handle({ mode: 'uniques', page_uniques: [pageUnique] });
    return result.products[0] ?? null;
  }

  async variantsByIds(ids: string[]) {
    if (!ids.length) return [];
    return this.variants.find({ where: { id: In(ids) } });
  }
}
