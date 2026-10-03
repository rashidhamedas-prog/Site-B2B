'use strict';
/**
 * Align site products.sku with ERP product codes without changing slugs.
 * Stores the previous SKU in product_sku_aliases and upserts erp_product_map.
 * Also clears erp_inventory_idempotency so cached "sku not found" results do not stick for 24h.
 *
 * Usage (API container): node /app/scripts/align-erp-product-skus.js
 * Or copy this file + erp-sku-align.pairs.json onto the VPS and run against postgres.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadPairs() {
  const candidates = [
    path.join(__dirname, '../apps/api/src/modules/erp-inventory/erp-sku-align.pairs.json'),
    path.join(__dirname, 'erp-sku-align.pairs.json'),
    process.env.ERP_SKU_PAIRS_JSON,
  ].filter(Boolean);
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  }
  throw new Error('erp-sku-align.pairs.json not found');
}

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const data = loadPairs();
  const client = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || process.env.POSTGRES_USER,
    password: process.env.DB_PASS || process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME || process.env.POSTGRES_DB,
  });
  await client.connect();
  const out = [];

  const run = async (fn) => {
    if (dryRun) return;
    await fn();
  };

  for (const pair of data.pairs || []) {
    const erp = String(pair.erp || '').trim();
    const siteSku = String(pair.siteSku || '').trim();
    if (!erp || !siteSku) {
      out.push({ erp, siteSku, status: 'skip_empty' });
      continue;
    }

    const found = await client.query(
      `SELECT id, sku, slug, name FROM products WHERE "deletedAt" IS NULL AND sku = $1 LIMIT 2`,
      [siteSku],
    );
    const already = await client.query(
      `SELECT id, sku, slug, name FROM products WHERE "deletedAt" IS NULL AND sku = $1 LIMIT 2`,
      [erp],
    );

    if (already.rows.length === 1 && already.rows[0].sku === erp) {
      const id = already.rows[0].id;
      await run(async () => {
        await client.query(
          `INSERT INTO erp_product_map ("erpProductSku", "productId", "matchedBy", "createdAt", "updatedAt")
           VALUES ($1, $2, 'sku_align', NOW(), NOW())
           ON CONFLICT ("erpProductSku") DO UPDATE
             SET "productId"=EXCLUDED."productId", "matchedBy"=EXCLUDED."matchedBy", "updatedAt"=NOW()`,
          [erp, id],
        );
      });
      out.push({
        erp,
        siteSku,
        status: 'already_aligned',
        productId: id,
        slug: already.rows[0].slug,
      });
      continue;
    }

    if (found.rows.length !== 1) {
      out.push({
        erp,
        siteSku,
        status: 'skip_site_sku',
        hits: found.rows.map((r) => r.sku),
      });
      continue;
    }
    if (already.rows.length) {
      out.push({
        erp,
        siteSku,
        status: 'skip_erp_sku_taken',
        takenBy: already.rows.map((r) => ({ id: r.id, sku: r.sku, name: r.name })),
      });
      continue;
    }

    const row = found.rows[0];
    const aliasTaken = await client.query(
      `SELECT sku, "productId" FROM product_sku_aliases WHERE sku = $1`,
      [erp],
    );
    if (aliasTaken.rows.length && aliasTaken.rows[0].productId !== row.id) {
      out.push({ erp, siteSku, status: 'skip_erp_alias_taken', alias: aliasTaken.rows[0] });
      continue;
    }

    await run(async () => {
      await client.query('BEGIN');
      try {
        await client.query(
          `INSERT INTO product_sku_aliases (sku, "productId", "createdAt")
           VALUES ($1, $2, NOW())
           ON CONFLICT (sku) DO UPDATE SET "productId"=EXCLUDED."productId"`,
          [siteSku, row.id],
        );
        await client.query(`DELETE FROM product_sku_aliases WHERE sku = $1 AND "productId" = $2`, [
          erp,
          row.id,
        ]);
        await client.query(`UPDATE products SET sku = $1, "updatedAt" = NOW() WHERE id = $2`, [
          erp,
          row.id,
        ]);
        await client.query(
          `INSERT INTO erp_product_map ("erpProductSku", "productId", "matchedBy", "createdAt", "updatedAt")
           VALUES ($1, $2, 'sku_align', NOW(), NOW())
           ON CONFLICT ("erpProductSku") DO UPDATE
             SET "productId"=EXCLUDED."productId", "matchedBy"=EXCLUDED."matchedBy", "updatedAt"=NOW()`,
          [erp, row.id],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    out.push({
      erp,
      siteSku,
      status: dryRun ? 'would_align' : 'aligned',
      productId: row.id,
      slug: row.slug,
      name: row.name,
    });
  }

  if (!dryRun) {
    await client.query(`DELETE FROM erp_inventory_idempotency`);
  }

  console.log(JSON.stringify({ dryRun, results: out }, null, 2));
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
