/**
 * Source gate for PR-7 post_backup migration.
 * npx ts-node --transpile-only src/database/migrations/20261028-003-omnichannel-post-backup.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(resolve(__dirname, '20261028-003-omnichannel-post-backup.ts'), 'utf8');

assert(src.includes('omnichannel_post_backups'), 'creates post_backups');
assert(src.includes('omnichannel_delivery_messages'), 'creates delivery_messages');
assert(src.includes('ON DELETE RESTRICT'), 'FK RESTRICT on delivery');
assert(src.includes('gen_random_uuid()'), 'uuid default');
assert(src.includes('DROP TABLE IF EXISTS "omnichannel_post_backups"'), 'down drops backups');
assert(src.includes('DROP TABLE IF EXISTS "omnichannel_delivery_messages"'), 'down drops messages');
assert(!/DELETE FROM "omnichannel_publication_deliveries"/i.test(src), 'never deletes deliveries');
assert(!/OMNICHANNEL_CONNECTORS_ENABLED/i.test(src), 'migration does not touch connector flags');

console.log('20261028-003-omnichannel-post-backup.spec.ts: ok');
