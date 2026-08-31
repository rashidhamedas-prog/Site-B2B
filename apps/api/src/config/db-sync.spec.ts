/**
 * npx ts-node --transpile-only src/config/db-sync.spec.ts
 */
import { assertProductionDbSyncSafe, typeormSynchronizeEnabled } from './db-sync';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(typeormSynchronizeEnabled({ NODE_ENV: 'development', DB_SYNC: 'false' }) === true, 'dev sync');
assert(typeormSynchronizeEnabled({ NODE_ENV: 'production', DB_SYNC: 'false' }) === false, 'prod no sync');
assert(typeormSynchronizeEnabled({ NODE_ENV: 'development', APP_ENV: 'staging', DB_SYNC: 'false' }) === false, 'staging no sync');

let threw = false;
try {
  assertProductionDbSyncSafe({ NODE_ENV: 'production', DB_SYNC: 'true' });
} catch (err) {
  threw = err instanceof Error && /forbidden/.test(err.message);
}
assert(threw, 'prod DB_SYNC=true fails closed');

threw = false;
try {
  assertProductionDbSyncSafe({ APP_ENV: 'staging', DB_SYNC: 'true' });
} catch (err) {
  threw = err instanceof Error && /forbidden/.test(err.message);
}
assert(threw, 'staging DB_SYNC=true fails closed');

console.log('db-sync.spec.ts: ok');
