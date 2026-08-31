/**
 * npx ts-node --transpile-only src/database/migrations/20260826-001-omnichannel-schema.spec.ts
 */
import { QueryRunner } from 'typeorm';
import { OmnichannelSchema1756224000001 } from './20260826-001-omnichannel-schema';

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

function joined(calls: string[]) {
  return calls.join('\n');
}

async function main() {
  const migration = new OmnichannelSchema1756224000001();
  const { runner, calls } = createRunner();
  await migration.up(runner);
  const sql = joined(calls);

  for (const table of [
    'omnichannel_channel_connections',
    'omnichannel_channel_destinations',
    'omnichannel_channel_templates',
    'omnichannel_outbox_events',
    'omnichannel_publications',
    'omnichannel_publication_deliveries',
  ]) {
    assert(sql.includes(`CREATE TABLE IF NOT EXISTS "${table}"`), `creates ${table}`);
  }

  assert(sql.includes('UQ_omnichannel_connections_provider_channel_name'), 'unique connection');
  assert(sql.includes('UQ_omnichannel_destinations_connection_key'), 'unique destination');
  assert(sql.includes('UQ_omnichannel_templates_provider_channel_event_version'), 'unique template');
  assert(sql.includes('UQ_omnichannel_outbox_dedupeKey'), 'unique dedupe');
  assert(sql.includes('IDX_omnichannel_outbox_status_availableAt'), 'outbox status index');
  assert(sql.includes('IDX_omnichannel_outbox_aggregate'), 'outbox aggregate index');
  assert(sql.includes('UQ_omnichannel_publications_source_channel_updated'), 'unique publication');
  assert(sql.includes('UQ_omnichannel_deliveries_event_destination_action'), 'unique delivery');

  assert(sql.includes('FK_omnichannel_destinations_connectionId'), 'destination FK');
  assert(sql.includes('FK_omnichannel_deliveries_publicationId'), 'delivery publication FK');
  assert(sql.includes('FK_omnichannel_deliveries_destinationId'), 'delivery destination FK');
  assert(sql.includes('FK_omnichannel_deliveries_eventId'), 'delivery event FK');

  assert(/"secretRef" varchar NOT NULL/.test(sql), 'stores secretRef only');
  assert(!/"secret"\s/.test(sql), 'no secret column');
  assert(!/"token"\s/.test(sql), 'no token column');
  assert(!/"password"\s/.test(sql), 'no password column');
  assert(!/"botToken"\s/.test(sql), 'no botToken column');

  const down = createRunner();
  await migration.down(down.runner);
  const downSql = joined(down.calls);
  const dropOrder = [
    'omnichannel_publication_deliveries',
    'omnichannel_publications',
    'omnichannel_outbox_events',
    'omnichannel_channel_templates',
    'omnichannel_channel_destinations',
    'omnichannel_channel_connections',
  ];
  let last = -1;
  for (const table of dropOrder) {
    const idx = downSql.indexOf(`DROP TABLE IF EXISTS "${table}"`);
    assert(idx >= 0, `down drops ${table}`);
    assert(idx > last, `down order ${table}`);
    last = idx;
  }

  console.log('20260826-001-omnichannel-schema.spec.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
