import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const INDEX = 'products';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: any;
  ready = false;

  constructor(private config: ConfigService) {
    const host = config.get('MEILI_HOST', '');
    if (!host) return;
    try {
      const { MeiliSearch } = require('meilisearch');
      this.client = new MeiliSearch({
        host,
        apiKey: config.get('MEILI_MASTER_KEY', ''),
      });
      this.ready = true;
    } catch {
      this.ready = false;
    }
  }

  async onModuleInit() {
    if (!this.ready) return;
    try {
      await this.client.createIndex(INDEX, { primaryKey: 'id' });
      await this.client.index(INDEX).updateSearchableAttributes(['name', 'sku', 'fabric', 'description']);
      await this.client.index(INDEX).updateFilterableAttributes(['status', 'fabric', 'isFeatured', 'isNew']);
    } catch (err) {
      this.logger.warn(`Meilisearch init: ${err}`);
    }
  }

  async indexProduct(product: {
    id: string; sku: string; name: string; fabric: string;
    description?: string; status: string; isFeatured: boolean; isNew: boolean;
  }) {
    if (!this.ready) return;
    try {
      await this.client.index(INDEX).addDocuments([product]);
    } catch (err) {
      this.logger.warn(`Meilisearch index failed: ${err}`);
    }
  }

  async removeProduct(id: string) {
    if (!this.ready) return;
    try {
      await this.client.index(INDEX).deleteDocument(id);
    } catch (err) {
      this.logger.warn(`Meilisearch delete failed: ${err}`);
    }
  }

  async searchIds(query: string, filters?: { status?: string; fabric?: string }): Promise<string[] | null> {
    if (!this.ready || !query.trim()) return null;
    try {
      const filter: string[] = [];
      if (filters?.status && filters.status !== 'ALL') filter.push(`status = "${filters.status}"`);
      if (filters?.fabric) filter.push(`fabric = "${filters.fabric}"`);

      const result = await this.client.index(INDEX).search(query, {
        filter: filter.length ? filter.join(' AND ') : undefined,
        limit: 100,
      });
      return (result.hits ?? []).map((h: { id: string }) => h.id);
    } catch (err) {
      this.logger.warn(`Meilisearch search failed: ${err}`);
      return null;
    }
  }
}
