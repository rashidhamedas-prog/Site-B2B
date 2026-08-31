/**
 * npx ts-node --transpile-only src/database/migrations/20260829-002-omnichannel-media.spec.ts
 */
import { QueryRunner } from 'typeorm';
import { OmnichannelMedia1756471000001 } from './20260829-002-omnichannel-media';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function createRunner() {
  const calls: string[] = [];
  const runner = {
    async query(sql: string): Promise<unknown> {
      calls.push(sql);
      return undefined;
    },
  } as QueryRunner;
  return { runner, calls };
}

async function main() {
  const migration = new OmnichannelMedia1756471000001();
  const up = createRunner();
  await migration.up(up.runner);
  const sql = up.calls.join('\n');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS "omnichannel_media_assets"'), 'creates registry');
  assert(sql.includes('"altText"'), 'alt text');
  assert(sql.includes('UQ_omnichannel_media_publicUrl'), 'unique url');
  assert(!/"secret"\s/.test(sql), 'no secret column');
  const down = createRunner();
  await migration.down(down.runner);
  assert(down.calls.join('\n').includes('DROP TABLE IF EXISTS "omnichannel_media_assets"'), 'down drops');
  console.log('20260829-002-omnichannel-media.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
