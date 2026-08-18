import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { ProductEntity } from '../modules/product/entities/product.entity';

interface CliOptions {
  dryRun: boolean;
  batch: number;
  resume?: string;
}

function parseCliArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: true, batch: 50 };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--apply') opts.dryRun = true;
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

async function run() {
  const opts = parseCliArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const dataSource = app.get<DataSource>(getDataSourceToken());
  const productRepo = dataSource.getRepository(ProductEntity);

  try {
    const groups = await productRepo
      .createQueryBuilder('p')
      .select('p.minOrderQty', 'minOrderQty')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.minOrderQty')
      .orderBy('p.minOrderQty', 'ASC')
      .getRawMany<{ minOrderQty: string | number; count: string | number }>();

    const distribution = groups.map((row) => ({
      minOrderQty: Number(row.minOrderQty),
      count: Number(row.count),
    }));

    const highRows = await productRepo
      .createQueryBuilder('p')
      .select('p.sku', 'sku')
      .addSelect('p.name', 'name')
      .addSelect('p.minOrderQty', 'minOrderQty')
      .where('p.minOrderQty >= :min', { min: 6 })
      .orderBy('p.minOrderQty', 'DESC')
      .addOrderBy('p.sku', 'ASC')
      .take(50)
      .getRawMany<{ sku: string; name: string; minOrderQty: string | number }>();

    const processed = distribution.reduce((sum, row) => sum + (Number.isFinite(row.count) ? row.count : 0), 0);

    console.log(
      JSON.stringify({
        dryRun: true,
        readOnly: true,
        processed,
        wouldWrite: 0,
        written: 0,
        errors: 0,
        batch: opts.batch,
        resume: opts.resume ?? null,
        distribution,
        highMinOrderQty: highRows.map((p) => ({
          sku: p.sku,
          name: p.name,
          minOrderQty: Number(p.minOrderQty),
        })),
      }),
    );
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(JSON.stringify({ type: 'fatal', message: safeErrorMessage(err) }));
  process.exit(1);
});
