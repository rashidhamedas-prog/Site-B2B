import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { ProductVideo1762156800001 } from './20261103-001-product-video';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function main() {
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
    assert(up.rows[0]?.relation, 'product_video table was not created');

    const columns = await client.query(
      `SELECT column_name, is_nullable
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'product_video'
       ORDER BY ordinal_position`,
      [schema],
    );
    const expected = [
      'id', 'product_id', 'status', 'src_key', 'mp4_720_key', 'mp4_480_key',
      'webm_720_key', 'poster_key', 'poster_candidates', 'duration_sec', 'width',
      'height', 'bytes_out', 'error_code', 'sort_order', 'deleted_at', 'created_at',
      'updated_at',
    ];
    assert(
      JSON.stringify(columns.rows.map((row) => row.column_name)) === JSON.stringify(expected),
      'product_video column names differ from the entity contract',
    );
    assert(
      columns.rows.every((row) => row.column_name === 'id' ? row.is_nullable === 'NO' : row.is_nullable === 'YES'),
      'all non-primary product_video columns must be nullable',
    );

    const unique = await client.query(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = $1 AND indexname = 'UQ_product_video_one_live_per_product'`,
      [schema],
    );
    const indexDef = String(unique.rows[0]?.indexdef || '');
    assert(indexDef.includes('UNIQUE'), 'live product-video index must be unique');
    assert(
      /WHERE \(deleted_at IS NULL\)/i.test(indexDef),
      'live product-video index must be partial on deleted_at IS NULL',
    );

    const foreignKey = await client.query(
      `SELECT rc.delete_rule, kcu.column_name, ccu.table_name AS foreign_table,
              ccu.column_name AS foreign_column
       FROM information_schema.referential_constraints rc
       JOIN information_schema.table_constraints tc
         ON tc.constraint_schema = rc.constraint_schema
        AND tc.constraint_name = rc.constraint_name
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_schema = tc.constraint_schema
        AND kcu.constraint_name = tc.constraint_name
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_schema = rc.unique_constraint_schema
        AND ccu.constraint_name = rc.unique_constraint_name
       WHERE tc.table_schema = $1
         AND tc.table_name = 'product_video'
         AND tc.constraint_type = 'FOREIGN KEY'`,
      [schema],
    );
    assert(foreignKey.rows.length === 1, 'product_video must have one product foreign key');
    assert(foreignKey.rows[0].delete_rule === 'CASCADE', 'product foreign key must cascade on delete');
    assert(
      foreignKey.rows[0].column_name === 'product_id' &&
      foreignKey.rows[0].foreign_table === 'products' &&
      foreignKey.rows[0].foreign_column === 'id',
      'product_video foreign key target differs from contract',
    );

    await migration.down(runner);
    const down = await client.query(
      `SELECT to_regclass('"${schema}"."product_video"') AS relation`,
    );
    assert(!down.rows[0]?.relation, 'product_video table was not dropped');
    const enumType = await client.query(
      `SELECT 1
       FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = $1 AND t.typname = 'product_video_status_enum'`,
      [schema],
    );
    assert(enumType.rowCount === 0, 'product_video enum was not dropped');
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
  console.log('20261103 product-video migration integration: ok');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
