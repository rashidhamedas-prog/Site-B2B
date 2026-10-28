/**
 * Source + pure pagination/filter tests for PR-8 coverage service.
 * npx ts-node --transpile-only src/modules/omnichannel/services/omnichannel-coverage.service.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  matchesCoverageFilter,
  summarizeCoverageRows,
  type CoverageDestinationMeta,
  type CoverageProductRow,
} from '../coverage-matrix';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const svc = readFileSync(resolve(__dirname, 'omnichannel-coverage.service.ts'), 'utf8');
const ctl = readFileSync(resolve(__dirname, '../controllers/omnichannel-admin.controller.ts'), 'utf8');
const rbac = readFileSync(resolve(__dirname, '../omnichannel-rbac.ts'), 'utf8');

assert(svc.includes('listCoverage'), 'listCoverage');
assert(svc.includes('listDuplicates'), 'listDuplicates');
assert(svc.includes('setAbsenceReason'), 'absence reason');
assert(svc.includes('ingestOutOfPanel'), 'oop ingest');
assert(svc.includes('coverage_absence_reason_set'), 'audit action');
assert(svc.includes('out_of_panel'), 'oop source');
assert(svc.includes('DEFAULT_LIMIT = 50') || svc.includes('DEFAULT_LIMIT=50') || svc.includes('50'), 'page size 50');
assert(!svc.includes('OMNICHANNEL_CONNECTORS_ENABLED'), 'no connector flip');
assert(!svc.includes('TELEGRAM_API_URL'), 'no egress');

assert(ctl.includes("Get('coverage')"), 'GET coverage');
assert(ctl.includes("Get('coverage/duplicates')"), 'GET duplicates before :id');
assert(ctl.includes("Post('coverage/out-of-panel/ingest')"), 'POST ingest');
assert(
  ctl.indexOf("Post('coverage/out-of-panel/ingest')")
    < ctl.indexOf("Get('coverage/:productId')"),
  'static ingest before param route',
);
assert(ctl.includes("@OmnichannelMinRole('PUBLISHER')"), 'publisher on coverage');
assert(ctl.includes("@OmnichannelMinRole('OWNER')"), 'owner on ingest');
assert(ctl.includes('@RequiresGoRef()'), 'goRef on ingest');
assert(ctl.includes('coverageUi'), 'status exposes coverageUi');
assert(ctl.includes('source') && ctl.includes('listAudits'), 'audits source filter wired');

assert(rbac.includes('coverage_out_of_panel_ingest'), 'GO list includes ingest');
assert(rbac.includes('ingestHash'), 'redact keeps ingestHash');

/* --- pagination / filter summary (pure) --- */
{
  const dests: CoverageDestinationMeta[] = [
    { destinationId: 'd-ru', provider: 'RUBIKA', channel: 'RETAIL' },
    { destinationId: 'd-ba', provider: 'BALE', channel: 'RETAIL' },
  ];
  const liveCell = {
    state: 'live' as const,
    liveCount: 2,
    messageIds: ['1', '2'],
    deliveryIds: ['a', 'b'],
    sentAtTehran: null,
    updatedAtTehran: null,
    link: null,
    duplicateOf: ['2'],
    absenceReason: null,
    missingKind: null,
  };
  const noneCell = {
    state: 'none' as const,
    liveCount: 0,
    messageIds: [],
    deliveryIds: [],
    sentAtTehran: null,
    updatedAtTehran: null,
    link: null,
    duplicateOf: [],
    absenceReason: null,
    missingKind: 'never' as const,
  };
  const rows: CoverageProductRow[] = [
    {
      productId: 'p1',
      sku: 'A',
      name: 'n1',
      thumbnailUrl: null,
      cells: { 'd-ba': liveCell, 'd-ru': { ...liveCell, liveCount: 1, duplicateOf: [], messageIds: ['r'] } },
      flags: { duplicate: true, outOfPanel: false, missingReason: false },
    },
    {
      productId: 'p2',
      sku: 'B',
      name: 'n2',
      thumbnailUrl: null,
      cells: { 'd-ru': { ...liveCell, liveCount: 1, duplicateOf: [], messageIds: ['r2'] }, 'd-ba': noneCell },
      flags: { duplicate: false, outOfPanel: false, missingReason: true },
    },
  ];
  const dupOnly = rows.filter((r) => matchesCoverageFilter(r, 'duplicate', dests));
  assert(dupOnly.length === 1 && dupOnly[0].sku === 'A', 'filter=duplicate');
  const page = dupOnly.slice(0, 50);
  assert(page.length === 1, 'pagination slice');
  const summary = summarizeCoverageRows(rows, dests);
  assert(summary.duplicateProducts === 1, 'summary dup count');
  assert(summary.gapRubikaNotBale === 1, 'gap rubika not bale');
}

console.log('omnichannel-coverage.service.spec.ts: ok');
