/**
 * npx ts-node --transpile-only src/modules/omnichannel/coverage-matrix.spec.ts
 */
import {
  buildCoverageCell,
  buildProductCoverageRow,
  collectDuplicateFlatRows,
  formatTehranTimestamp,
  isActiveLiveCreate,
  matchesCoverageFilter,
  outOfPanelIngestHash,
  sanitizeCoverageLink,
  summarizeCoverageRows,
  type CoverageDestinationMeta,
  type CoverageTrailRow,
} from './coverage-matrix';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const dests: CoverageDestinationMeta[] = [
  { destinationId: 'd-tg', provider: 'TELEGRAM', channel: 'RETAIL', channelLink: 'https://t.me/taranom' },
  { destinationId: 'd-ru', provider: 'RUBIKA', channel: 'RETAIL', channelLink: 'https://rubika.ir/taranom' },
  { destinationId: 'd-ba', provider: 'BALE', channel: 'RETAIL', channelLink: 'https://ble.ir/x' },
];

/* --- Tehran format --- */
{
  const s = formatTehranTimestamp('2026-10-28T10:30:00.000Z');
  assert(s === '2026-10-28 14:00', `Tehran +3:30 got ${s}`);
  assert(formatTehranTimestamp(null) === null, 'null stays null');
}

/* --- link sanitizer D-3 --- */
{
  assert(sanitizeCoverageLink('TELEGRAM', 'https://t.me/foo') === 'https://t.me/foo', 't.me ok');
  assert(sanitizeCoverageLink('TELEGRAM', 't.me/foo') === 'https://t.me/foo', 't.me bare');
  assert(sanitizeCoverageLink('TELEGRAM', 'https://evil.example/x') === null, 'unknown drop');
  assert(sanitizeCoverageLink('RUBIKA', 'https://rubika.ir/c') === 'https://rubika.ir/c', 'rubika ok');
  assert(sanitizeCoverageLink('BALE', 'https://ble.ir/x') === null, 'Bale no link');
  assert(sanitizeCoverageLink('TELEGRAM', 'https://t.me/bot123:AAHsecrettoken') === null, 'token-shaped drop');
}

/* --- duplicate: 2 SUCCEEDED same dest (REQ-E4; fold collapses to 1 — matrix counts both) --- */
{
  const rows: CoverageTrailRow[] = [
    {
      productId: 'prod1',
      destinationId: 'd-ba',
      deliveryId: 'del1',
      publicationId: 'pub1',
      publicationStatus: 'PUBLISHED',
      action: 'CREATE',
      status: 'SUCCEEDED',
      providerMessageId: '111',
      sentAt: '2026-10-20T10:00:00.000Z',
    },
    {
      productId: 'prod1',
      destinationId: 'd-ba',
      deliveryId: 'del2',
      publicationId: 'pub2',
      publicationStatus: 'PUBLISHED',
      action: 'CREATE',
      status: 'SUCCEEDED',
      providerMessageId: '222',
      sentAt: '2026-10-21T10:00:00.000Z',
    },
  ];
  assert(rows.every(isActiveLiveCreate), 'both active live');
  const cell = buildCoverageCell({ rows, provider: 'BALE' });
  assert(cell.state === 'live' && cell.liveCount === 2, 'liveCount 2');
  assert(cell.messageIds.includes('111') && cell.messageIds.includes('222'), 'both message ids');
  assert(cell.duplicateOf.length >= 1, 'duplicateOf set');
  assert(cell.link === null, 'Bale link null');
}

/* --- pending not counted as duplicate (D-9) --- */
{
  const cell = buildCoverageCell({
    rows: [
      {
        productId: 'p',
        destinationId: 'd-ba',
        deliveryId: 'a',
        publicationId: 'x',
        publicationStatus: 'PUBLISHED',
        action: 'CREATE',
        status: 'SUCCEEDED',
        providerMessageId: '1',
      },
      {
        productId: 'p',
        destinationId: 'd-ba',
        deliveryId: 'b',
        publicationId: 'y',
        publicationStatus: 'READY',
        action: 'CREATE',
        status: 'PENDING',
        providerMessageId: null,
      },
    ],
    provider: 'BALE',
  });
  assert(cell.liveCount === 1 && cell.state === 'live', 'pending ignored for duplicate');
}

/* --- missing: never vs deleted --- */
{
  const never = buildCoverageCell({ rows: [], provider: 'TELEGRAM' });
  assert(never.state === 'none' && never.missingKind === 'never', 'never published');
  const deleted = buildCoverageCell({
    rows: [{
      productId: 'p',
      destinationId: 'd-tg',
      deliveryId: 'd1',
      publicationId: 'pub',
      publicationStatus: 'WITHDRAWN',
      action: 'DELETE',
      status: 'SUCCEEDED',
      providerMessageId: '9',
    }],
    provider: 'TELEGRAM',
  });
  assert(deleted.state === 'withdrawn' && deleted.missingKind === 'deleted_remotely', 'deleted remotely');
}

/* --- gap filters --- */
{
  const trail: CoverageTrailRow[] = [
    {
      productId: 'prod1', destinationId: 'd-ru', deliveryId: '1', publicationId: 'a',
      publicationStatus: 'PUBLISHED', action: 'CREATE', status: 'SUCCEEDED', providerMessageId: 'r1',
    },
  ];
  const row = buildProductCoverageRow({
    productId: 'prod1',
    sku: 'SKU-1',
    name: 'Test',
    destinations: dests,
    trail,
    absenceByDestination: new Map(),
    outOfPanelByDestination: new Set(),
  });
  assert(row.flags.missingReason === true, 'bale/tg missing without reason');
  assert(matchesCoverageFilter(row, 'gap_rubika_not_bale', dests) === true, 'gap rubika not bale');
  assert(matchesCoverageFilter(row, 'gap_bale_not_rubika', dests) === false, 'not reverse gap');
  assert(matchesCoverageFilter(row, 'duplicate', dests) === false, 'not duplicate');
}

/* --- out_of_panel cell --- */
{
  const cell = buildCoverageCell({
    rows: [],
    provider: 'BALE',
    outOfPanel: true,
  });
  assert(cell.state === 'out_of_panel', 'oop state');
}

/* --- summary + duplicate flat --- */
{
  const trailDup: CoverageTrailRow[] = [
    {
      productId: 'prod1', destinationId: 'd-ba', deliveryId: '1', publicationId: 'a',
      publicationStatus: 'PUBLISHED', action: 'CREATE', status: 'SUCCEEDED', providerMessageId: '1',
    },
    {
      productId: 'prod1', destinationId: 'd-ba', deliveryId: '2', publicationId: 'b',
      publicationStatus: 'PUBLISHED', action: 'CREATE', status: 'SUCCEEDED', providerMessageId: '2',
    },
    {
      productId: 'prod1', destinationId: 'd-ru', deliveryId: '3', publicationId: 'c',
      publicationStatus: 'PUBLISHED', action: 'CREATE', status: 'SUCCEEDED', providerMessageId: 'r',
    },
  ];
  const row = buildProductCoverageRow({
    productId: 'prod1',
    sku: 'SKU-DUP',
    name: 'Dup',
    destinations: dests,
    trail: trailDup,
    absenceByDestination: new Map(),
    outOfPanelByDestination: new Set(),
  });
  assert(row.flags.duplicate === true, 'flag duplicate');
  const summary = summarizeCoverageRows([row], dests);
  assert(summary.duplicateProducts === 1, 'summary dup');
  assert(summary.baleLive === 1 && summary.rubikaLive === 1, 'live counts');
  const flat = collectDuplicateFlatRows([row], dests, new Map([['prod1', 'SKU-DUP']]));
  assert(flat.length === 1 && flat[0].count === 2 && flat[0].sku === 'SKU-DUP', 'flat dup export');
}

/* --- ingest hash stable --- */
{
  const a = outOfPanelIngestHash({
    channel: 'bale',
    providerMessageId: '99',
    action: 'CREATE',
    occurredAt: '2026-10-26T12:00:00.000Z',
  });
  const b = outOfPanelIngestHash({
    channel: 'BALE',
    providerMessageId: '99',
    action: 'create',
    occurredAt: '2026-10-26T12:00:00.000Z',
  });
  assert(a === b && a.startsWith('oop_'), 'ingest hash stable');
}

console.log('coverage-matrix.spec.ts: ok');
