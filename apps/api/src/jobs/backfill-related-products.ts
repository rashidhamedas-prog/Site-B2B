import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { ProductEntity } from '../modules/product/entities/product.entity';
import { ProductRelatedEntity } from '../modules/product/entities/product-related.entity';
import {
  fillRelatedIds,
  MAX_RELATED_PRODUCTS,
  sortRelatedCandidates,
  type RelatedCandidate,
} from '../modules/product/product-related-fill';

interface CliOptions {
  dryRun: boolean;
  replace: boolean;
  batch: number;
  resume?: string;
}

function parseCliArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: true, replace: false, batch: 50 };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--apply') opts.dryRun = false;
    else if (arg === '--replace') opts.replace = true;
    else if (arg.startsWith('--batch=')) {
      const n = Math.floor(Number(arg.slice('--batch='.length)));
      if (Number.isFinite(n) && n > 0) opts.batch = n;
    } else if (arg.startsWith('--resume=')) {
      const id = arg.slice('--resume='.length).trim();
      if (id) opts.resume = id;
    }
  }
  return opts;
}

function safeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'unknown error';
  return msg
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')
    .replace(/password=\S+/gi, 'password=[redacted]');
}

function fabricFromSpecs(specs?: ProductEntity['specs'] | null, fallback?: string | null): string {
  return String(specs?.fabricType || fallback || '').trim();
}

function toCandidate(product: Pick<
  ProductEntity,
  'id' | 'sku' | 'status' | 'categoryId' | 'collectionId' | 'sizeType' | 'showOnRetail' | 'showOnWholesale' | 'fabric' | 'specs'
>): RelatedCandidate {
  return {
    id: product.id,
    sku: product.sku,
    status: product.status,
    deleted: false,
    categoryId: product.categoryId,
    collectionId: product.collectionId,
    fabricType: fabricFromSpecs(product.specs, product.fabric),
    sizeType: product.sizeType,
    showOnRetail: product.showOnRetail,
    showOnWholesale: product.showOnWholesale,
  };
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

async function loadBatch(
  repo: Repository<ProductEntity>,
  batch: number,
  resume?: string,
): Promise<ProductEntity[]> {
  const qb = repo
    .createQueryBuilder('p')
    .orderBy('p.id', 'ASC')
    .take(batch);
  if (resume) qb.andWhere('p.id > :resume', { resume });
  return qb.getMany();
}

async function run() {
  const opts = parseCliArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const dataSource = app.get<DataSource>(getDataSourceToken());
  const productRepo = dataSource.getRepository(ProductEntity);
  const relatedRepo = dataSource.getRepository(ProductRelatedEntity);

  const counts = { processed: 0, wouldWrite: 0, written: 0, errors: 0 };
  let resume = opts.resume;

  const poolRows = await productRepo.find({
    where: { status: 'ACTIVE' },
    select: [
      'id',
      'sku',
      'status',
      'categoryId',
      'collectionId',
      'sizeType',
      'showOnRetail',
      'showOnWholesale',
      'fabric',
      'specs',
    ],
  });
  const pool = poolRows.map(toCandidate);
  const activeIds = new Set(pool.map((row) => row.id));

  try {
    while (true) {
      const products = await loadBatch(productRepo, opts.batch, resume);
      if (!products.length) break;
      resume = products[products.length - 1].id;

      const productIds = products.map((p) => p.id);
      const links = productIds.length
        ? await relatedRepo.find({
            where: { productId: In(productIds) },
            order: { sortOrder: 'ASC', relatedProductId: 'ASC' },
          })
        : [];
      const linksByProduct = new Map<string, string[]>();
      for (const id of productIds) linksByProduct.set(id, []);
      for (const link of links) {
        const list = linksByProduct.get(link.productId);
        if (list && !list.includes(link.relatedProductId)) list.push(link.relatedProductId);
      }

      const pending: Array<{ id: string; before: string[]; after: string[] }> = [];

      for (const product of products) {
        counts.processed += 1;
        try {
          const stored = (linksByProduct.get(product.id) ?? []).filter((id) => id && id !== product.id);
          const keptSeed = stored.filter((id) => activeIds.has(id));
          const ranked = sortRelatedCandidates(toCandidate(product), pool);
          const filled = fillRelatedIds(
            product.id,
            opts.replace ? [] : keptSeed,
            ranked,
            MAX_RELATED_PRODUCTS,
          );
          if (sameIds(stored, filled.next)) continue;

          counts.wouldWrite += 1;
          pending.push({ id: product.id, before: stored, after: filled.next });
          console.log(
            JSON.stringify({
              type: 'preview',
              id: product.id,
              sku: product.sku,
              before: stored,
              after: filled.next,
              added: filled.added,
              kept: opts.replace ? [] : filled.kept,
              shortfall: filled.shortfall,
            }),
          );
        } catch (err) {
          counts.errors += 1;
          console.log(JSON.stringify({ type: 'error', id: product.id, message: safeErrorMessage(err) }));
        }
      }

      if (!opts.dryRun && pending.length) {
        await dataSource.transaction(async (em) => {
          const rel = em.getRepository(ProductRelatedEntity);
          for (const row of pending) {
            await rel.delete({ productId: row.id });
            if (!row.after.length) continue;
            await rel.save(
              row.after.map((relatedProductId, sortOrder) =>
                rel.create({ productId: row.id, relatedProductId, sortOrder }),
              ),
            );
          }
        });
        counts.written += pending.length;
      }

      console.log(
        JSON.stringify({
          type: 'batch',
          lastId: resume,
          processed: counts.processed,
          pending: pending.length,
        }),
      );
    }
  } finally {
    await app.close();
  }

  console.log(JSON.stringify({ dryRun: opts.dryRun, ...counts }));
}

run().catch((err) => {
  console.error(JSON.stringify({ type: 'fatal', message: safeErrorMessage(err) }));
  process.exit(1);
});
