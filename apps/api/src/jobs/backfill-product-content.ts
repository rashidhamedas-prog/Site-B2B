import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { ProductEntity } from '../modules/product/entities/product.entity';
import {
  generateChannelContent,
  isLegacyCopiedContent,
  shouldFillChannelContent,
  type ContentChannel,
  type ProductContentInput,
} from '../modules/product/product-content';
import { computePackQty, sizesForSizeType } from '../modules/product/product-pack';

interface CliOptions {
  dryRun: boolean;
  force: boolean;
  replaceLegacyOnly: boolean;
  batch: number;
  resume?: string;
}

interface ContentSample {
  id: string;
  sku: string;
  retail?: { old: string; new: string };
  wholesale?: { old: string; new: string };
}

function parseCliArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: true, force: false, replaceLegacyOnly: false, batch: 50 };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--apply') opts.dryRun = false;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--replace-legacy-only') opts.replaceLegacyOnly = true;
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

function preview(text: string | null | undefined, max = 240): string {
  const t = String(text ?? '');
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function fabricFromSpecs(specs?: ProductEntity['specs'] | null, fallback?: string | null): string {
  return String(specs?.fabricType || fallback || '').trim();
}

function contentMode(opts: CliOptions): 'empty' | 'legacy-equal' | 'force' {
  if (opts.force) return 'force';
  if (opts.replaceLegacyOnly) return 'legacy-equal';
  return 'empty';
}

function buildContentInput(product: ProductEntity): ProductContentInput {
  const colors = [
    ...new Set((product.variants ?? []).map((v) => String(v.color || '').trim()).filter(Boolean)),
  ];
  return {
    name: product.name,
    description: product.description,
    retailFullContent: product.retailFullContent,
    wholesaleFullContent: product.wholesaleFullContent,
    legacyContent: product.legacyContent,
    fabric: fabricFromSpecs(product.specs, product.fabric),
    specs: product.specs,
    sizeType: product.sizeType,
    colors,
    sizes: sizesForSizeType(product.sizeType),
    packQty: computePackQty(colors, product.sizeType),
    minPackQty: Math.max(1, Number(product.minOrderQty) || 1),
    careInstructions: product.careInstructions,
    categoryName: product.category?.name ?? null,
  };
}

function channelReason(
  input: ProductContentInput,
  channel: ContentChannel,
): 'empty' | 'legacy' | 'force' | null {
  const field = channel === 'RETAIL' ? input.retailFullContent : input.wholesaleFullContent;
  if (!String(field ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) return 'empty';
  if (isLegacyCopiedContent(field, input.description) || isLegacyCopiedContent(field, input.legacyContent)) {
    return 'legacy';
  }
  return null;
}

async function loadBatch(
  repo: Repository<ProductEntity>,
  batch: number,
  resume?: string,
): Promise<ProductEntity[]> {
  const qb = repo
    .createQueryBuilder('p')
    .leftJoinAndSelect('p.variants', 'v')
    .leftJoinAndSelect('p.category', 'c')
    .orderBy('p.id', 'ASC')
    .take(batch);
  if (resume) qb.andWhere('p.id > :resume', { resume });
  return qb.getMany();
}

async function run() {
  const opts = parseCliArgs(process.argv.slice(2));
  const mode = contentMode(opts);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const dataSource = app.get<DataSource>(getDataSourceToken());
  const productRepo = dataSource.getRepository(ProductEntity);

  const counts = {
    processed: 0,
    wouldWrite: 0,
    written: 0,
    errors: 0,
    retailFilled: 0,
    wholesaleFilled: 0,
  };
  const samples: ContentSample[] = [];
  let resume = opts.resume;

  try {
    while (true) {
      const products = await loadBatch(productRepo, opts.batch, resume);
      if (!products.length) break;
      resume = products[products.length - 1].id;

      const pending: Array<{ id: string; patch: Partial<ProductEntity> }> = [];

      for (const product of products) {
        counts.processed += 1;
        try {
          const input = buildContentInput(product);
          const patch: Partial<ProductEntity> = {};
          const sample: ContentSample = { id: product.id, sku: product.sku };

          if (shouldFillChannelContent(input, 'RETAIL', mode)) {
            const next = generateChannelContent(input, 'RETAIL');
            if (next !== String(product.retailFullContent ?? '')) {
              patch.retailFullContent = next;
              sample.retail = { old: preview(product.retailFullContent), new: preview(next) };
              counts.retailFilled += 1;
            }
          }
          if (shouldFillChannelContent(input, 'WHOLESALE', mode)) {
            const next = generateChannelContent(input, 'WHOLESALE');
            if (next !== String(product.wholesaleFullContent ?? '')) {
              patch.wholesaleFullContent = next;
              sample.wholesale = { old: preview(product.wholesaleFullContent), new: preview(next) };
              counts.wholesaleFilled += 1;
            }
          }

          if (!patch.retailFullContent && !patch.wholesaleFullContent) continue;

          counts.wouldWrite += 1;
          if (samples.length < 5) samples.push(sample);
          console.log(
            JSON.stringify({
              type: 'preview',
              id: product.id,
              sku: product.sku,
              retail: sample.retail
                ? { reason: opts.force ? 'force' : channelReason(input, 'RETAIL') }
                : undefined,
              wholesale: sample.wholesale
                ? { reason: opts.force ? 'force' : channelReason(input, 'WHOLESALE') }
                : undefined,
            }),
          );
          pending.push({ id: product.id, patch });
        } catch (err) {
          counts.errors += 1;
          console.log(JSON.stringify({ type: 'error', id: product.id, message: safeErrorMessage(err) }));
        }
      }

      if (!opts.dryRun && pending.length) {
        await dataSource.transaction(async (em) => {
          const repo = em.getRepository(ProductEntity);
          for (const row of pending) {
            await repo.update({ id: row.id }, row.patch);
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

  console.log(
    JSON.stringify({
      dryRun: opts.dryRun,
      counts,
      samples,
    }),
  );
}

run().catch((err) => {
  console.error(JSON.stringify({ type: 'fatal', message: safeErrorMessage(err) }));
  process.exit(1);
});
