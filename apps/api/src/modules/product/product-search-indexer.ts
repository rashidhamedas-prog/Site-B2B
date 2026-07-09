import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { SearchService } from '../search/search.service';

@Injectable()
export class ProductSearchIndexer implements OnModuleInit {
  private readonly logger = new Logger(ProductSearchIndexer.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly search: SearchService,
  ) {}

  async onModuleInit() {
    if (!this.search.ready) return;
    try {
      const products = await this.productRepo.find();
      for (const p of products) {
        await this.search.indexProduct({
          id: p.id,
          sku: p.sku,
          name: p.name,
          fabric: p.fabric,
          description: p.description,
          status: p.status,
          isFeatured: p.isFeatured,
          isNew: p.isNew,
        });
      }
      this.logger.log(`Indexed ${products.length} products in Meilisearch`);
    } catch (err) {
      this.logger.warn(`Product reindex skipped: ${err}`);
    }
  }
}
