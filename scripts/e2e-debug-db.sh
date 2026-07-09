#!/bin/bash
docker exec taranom_api node -e "
const { DataSource } = require('typeorm');
(async () => {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'postgres',
    port: 5432,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [],
    synchronize: false,
  });
  await ds.initialize();
  const rows = await ds.query(\"SELECT id, phone, role, \\\"customerId\\\" FROM users WHERE id = '\$1'\", ['9c4c901e-0aa5-42b5-8b88-7597e7a11508']);
  console.log('raw query:', rows);
  await ds.destroy();
})().catch(e => { console.error(e); process.exit(1); });
"
