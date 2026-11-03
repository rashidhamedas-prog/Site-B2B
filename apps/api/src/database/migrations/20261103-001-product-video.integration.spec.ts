import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { ProductVideo1762156800001 } from './20261103-001-product-video';

async function main() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    console.log('20261103 product-video migration: skipped (DATABASE_URL_TEST unset)');
    return;
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  const schema = `video_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query(`CREATE TABLE "products" ("id" uuid PRIMARY KEY)`);
    const runner = { query: (sql: string) => client.query(sql) } as any;
    const migration = new ProductVideo1762156800001();
    await migration.up(runner);
    const up = await client.query(
      `SELECT to_regclass('"${schema}"."product_video"') AS relation`,
    );
    if (!up.rows[0]?.relation) throw new Error('product_video table was not created');
    await migration.down(runner);
    const down = await client.query(
      `SELECT to_regclass('"${schema}"."product_video"') AS relation`,
    );
    if (down.rows[0]?.relation) throw new Error('product_video table was not dropped');
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
  console.log('20261103 product-video migration integration: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
