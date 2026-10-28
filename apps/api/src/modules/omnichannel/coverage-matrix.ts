/**
 * PR-8 coverage matrix pure helpers.
 * No DB / Nest / provider calls — service supplies trails and destinations.
 */
import { parseProviderMessageIds } from './provider-message-ids';
import { TEHRAN_UTC_OFFSET_MINUTES } from '../../lib/tehran-time';

export const COVERAGE_FILTERS = [
  'all',
  'duplicate',
  'gap_rubika_not_bale',
  'gap_bale_not_rubika',
  'out_of_panel',
  'missing_reason',
] as const;
export type CoverageFilter = (typeof COVERAGE_FILTERS)[number];

export const COVERAGE_CELL_STATES = ['live', 'none', 'withdrawn', 'out_of_panel', 'pending'] as const;
export type CoverageCellState = (typeof COVERAGE_CELL_STATES)[number];

export type CoverageCell = {
  state: CoverageCellState;
  liveCount: number;
  messageIds: string[];
  /** CREATE delivery ids contributing to live/duplicate counts (for delete-plan deep-link). */
  deliveryIds: string[];
  sentAtTehran: string | null;
  updatedAtTehran: string | null;
  link: string | null;
  /** Extra live message ids when liveCount > 1 (REQ-E4). */
  duplicateOf: string[];
  absenceReason: string | null;
  /** Why empty: never published vs remote delete succeeded. */
  missingKind: 'never' | 'deleted_remotely' | null;
};

export type CoverageDestinationMeta = {
  destinationId: string;
  provider: string;
  channel?: string | null;
  displayName?: string | null;
  /** Optional channel/public link template stored without secrets. */
  channelLink?: string | null;
};

export type CoverageTrailRow = {
  productId: string;
  destinationId: string;
  deliveryId: string;
  publicationId: string;
  publicationStatus: string;
  action: string;
  status: string;
  providerMessageId?: string | null;
  /** PR-7 `omnichannel_delivery_messages` when present (preferred over CSV). */
  deliveryMessageIds?: string[];
  supersededAt?: Date | string | null;
  sentAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

/** Prefer delivery_messages rows; fall back to CSV providerMessageId. */
export function resolveTrailMessageIds(row: CoverageTrailRow): string[] {
  if (Array.isArray(row.deliveryMessageIds) && row.deliveryMessageIds.length > 0) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of row.deliveryMessageIds) {
      const id = String(raw || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    if (out.length) return out;
  }
  return parseProviderMessageIds(row.providerMessageId);
}

export type OutOfPanelFlag = {
  productId?: string | null;
  destinationId?: string | null;
  channel?: string | null;
  providerMessageId?: string | null;
};

/** Format ISO / Date as Tehran wall-clock `YYYY-MM-DD HH:mm` (offset +03:30). */
export function formatTehranTimestamp(
  value: Date | string | null | undefined,
  offsetMinutes = TEHRAN_UTC_OFFSET_MINUTES,
): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

/**
 * D-3 link guard: Telegram t.me / Rubika rubika.ir|rubika patterns only.
 * Bale always null (show messageId). Unknown / token-shaped → null.
 */
export function sanitizeCoverageLink(
  provider: string,
  candidate: string | null | undefined,
): string | null {
  if (!candidate) return null;
  const raw = String(candidate).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (
    lower.includes('token')
    || lower.includes('bot') && lower.includes('api')
    || /:\w{20,}/.test(raw)
  ) {
    return null;
  }
  const prov = String(provider || '').toUpperCase();
  if (prov === 'BALE') return null;
  if (prov === 'TELEGRAM') {
    if (/^https?:\/\/(t\.me|telegram\.me)\//i.test(raw) || /^t\.me\//i.test(raw)) {
      return raw.startsWith('http') ? raw : `https://${raw}`;
    }
    return null;
  }
  if (prov === 'RUBIKA') {
    if (/^https?:\/\/([a-z0-9.-]*\.)?rubika\.(ir|com)\//i.test(raw) || /^rubika\.(ir|com)\//i.test(raw)) {
      return raw.startsWith('http') ? raw : `https://${raw}`;
    }
    return null;
  }
  return null;
}

export function isCoverageFilter(value: unknown): value is CoverageFilter {
  return typeof value === 'string' && (COVERAGE_FILTERS as readonly string[]).includes(value);
}

/** Active live CREATE rows per REQ-E4 (not fold — fold collapses to one). */
export function isActiveLiveCreate(row: CoverageTrailRow): boolean {
  if (row.action !== 'CREATE') return false;
  if (row.status !== 'SUCCEEDED') return false;
  if (row.supersededAt) return false;
  if (String(row.publicationStatus || '').toUpperCase() === 'WITHDRAWN') return false;
  if (!String(row.providerMessageId || '').trim()) return false;
  return true;
}

export function isPendingCreate(row: CoverageTrailRow): boolean {
  if (row.action !== 'CREATE') return false;
  if (row.supersededAt) return false;
  return ['PENDING', 'PROCESSING', 'RETRY', 'HOLD'].includes(row.status);
}

export function isWithdrawnCreate(row: CoverageTrailRow): boolean {
  if (row.action !== 'CREATE') return false;
  if (row.status === 'WITHDRAWN') return true;
  if (String(row.publicationStatus || '').toUpperCase() === 'WITHDRAWN' && row.status === 'SUCCEEDED') {
    return true;
  }
  return false;
}

export function isSuccessfulDelete(row: CoverageTrailRow): boolean {
  return row.action === 'DELETE' && row.status === 'SUCCEEDED' && !row.supersededAt;
}

/**
 * Build one CoverageCell for a product×destination from ordered trail rows
 * (oldest → newest preferred; order not required for counts).
 */
export function buildCoverageCell(input: {
  rows: CoverageTrailRow[];
  provider: string;
  channelLink?: string | null;
  absenceReason?: string | null;
  outOfPanel?: boolean;
}): CoverageCell {
  const live = input.rows.filter(isActiveLiveCreate);
  const pending = input.rows.filter(isPendingCreate);
  const messageIds: string[] = [];
  const deliveryIds: string[] = [];
  const seenMsg = new Set<string>();
  let latestSent: Date | string | null = null;
  let latestUpdated: Date | string | null = null;

  for (const row of live) {
    deliveryIds.push(row.deliveryId);
    for (const id of resolveTrailMessageIds(row)) {
      if (seenMsg.has(id)) continue;
      seenMsg.add(id);
      messageIds.push(id);
    }
    const sent = row.sentAt || row.createdAt || null;
    if (sent && (!latestSent || new Date(sent).getTime() > new Date(latestSent).getTime())) {
      latestSent = sent;
    }
    const upd = row.updatedAt || row.sentAt || row.createdAt || null;
    if (upd && (!latestUpdated || new Date(upd).getTime() > new Date(latestUpdated).getTime())) {
      latestUpdated = upd;
    }
  }

  const liveCount = live.length;
  const duplicateOf = liveCount > 1 ? messageIds.slice(1) : [];

  if (input.outOfPanel && liveCount === 0) {
    return {
      state: 'out_of_panel',
      liveCount: 0,
      messageIds: [],
      deliveryIds: [],
      sentAtTehran: null,
      updatedAtTehran: null,
      link: null,
      duplicateOf: [],
      absenceReason: input.absenceReason || null,
      missingKind: null,
    };
  }

  if (liveCount >= 1) {
    return {
      state: 'live',
      liveCount,
      messageIds,
      deliveryIds,
      sentAtTehran: formatTehranTimestamp(latestSent),
      updatedAtTehran: formatTehranTimestamp(latestUpdated),
      link: sanitizeCoverageLink(input.provider, input.channelLink),
      duplicateOf,
      absenceReason: input.absenceReason || null,
      missingKind: null,
    };
  }

  if (pending.length > 0) {
    return {
      state: 'pending',
      liveCount: 0,
      messageIds: [],
      deliveryIds: pending.map((r) => r.deliveryId),
      sentAtTehran: null,
      updatedAtTehran: formatTehranTimestamp(pending[pending.length - 1]?.updatedAt || pending[pending.length - 1]?.createdAt),
      link: null,
      duplicateOf: [],
      absenceReason: input.absenceReason || null,
      missingKind: null,
    };
  }

  const hasWithdrawn = input.rows.some(isWithdrawnCreate);
  const hasDelete = input.rows.some(isSuccessfulDelete);
  if (hasWithdrawn || hasDelete) {
    return {
      state: 'withdrawn',
      liveCount: 0,
      messageIds: [],
      deliveryIds: [],
      sentAtTehran: null,
      updatedAtTehran: null,
      link: null,
      duplicateOf: [],
      absenceReason: input.absenceReason || null,
      missingKind: 'deleted_remotely',
    };
  }

  return {
    state: 'none',
    liveCount: 0,
    messageIds: [],
    deliveryIds: [],
    sentAtTehran: null,
    updatedAtTehran: null,
    link: null,
    duplicateOf: [],
    absenceReason: input.absenceReason || null,
    missingKind: 'never',
  };
}

export type CoverageProductRow = {
  productId: string;
  sku: string;
  name: string;
  thumbnailUrl: string | null;
  cells: Record<string, CoverageCell>;
  flags: { duplicate: boolean; outOfPanel: boolean; missingReason: boolean };
};

/** Prefer one destination per provider (enabled first, then displayName). */
export function pickPrimaryDestinationsByProvider(
  destinations: CoverageDestinationMeta[],
): Record<string, CoverageDestinationMeta> {
  const byProvider = new Map<string, CoverageDestinationMeta[]>();
  for (const dest of destinations) {
    const p = String(dest.provider || '').toUpperCase();
    if (!p) continue;
    const list = byProvider.get(p) || [];
    list.push(dest);
    byProvider.set(p, list);
  }
  const out: Record<string, CoverageDestinationMeta> = {};
  for (const [provider, list] of byProvider) {
    const sorted = [...list].sort((a, b) =>
      String(a.displayName || '').localeCompare(String(b.displayName || ''), 'fa'),
    );
    out[provider] = sorted[0];
  }
  return out;
}

export function buildProductCoverageRow(input: {
  productId: string;
  sku: string;
  name: string;
  thumbnailUrl?: string | null;
  destinations: CoverageDestinationMeta[];
  trail: CoverageTrailRow[];
  absenceByDestination: Map<string, string>;
  /** Row-wide reason when destination-specific missing. */
  absenceRowWide?: string | null;
  outOfPanelByDestination: Set<string>;
  outOfPanelProduct?: boolean;
}): CoverageProductRow {
  const primary = pickPrimaryDestinationsByProvider(input.destinations);
  const cells: Record<string, CoverageCell> = {};
  let duplicate = false;
  let outOfPanel = Boolean(input.outOfPanelProduct);
  let anyLiveGap = false;
  let hasMissingWithoutReason = false;

  for (const provider of ['TELEGRAM', 'RUBIKA', 'BALE']) {
    const dest = primary[provider];
    if (!dest) continue;
    const rows = input.trail.filter((r) => r.destinationId === dest.destinationId);
    const reason =
      input.absenceByDestination.get(dest.destinationId)
      || input.absenceRowWide
      || null;
    const oop = input.outOfPanelByDestination.has(dest.destinationId) || Boolean(input.outOfPanelProduct);
    if (oop) outOfPanel = true;
    const cell = buildCoverageCell({
      rows,
      provider,
      channelLink: dest.channelLink,
      absenceReason: reason,
      outOfPanel: oop && rows.filter(isActiveLiveCreate).length === 0,
    });
    cells[dest.destinationId] = cell;
    if (cell.liveCount > 1) duplicate = true;
    if (cell.state === 'none' || cell.state === 'withdrawn') {
      anyLiveGap = true;
      if (!reason) hasMissingWithoutReason = true;
    }
  }

  // Also attach cells for non-primary destinations that have trail (detail view).
  for (const dest of input.destinations) {
    if (cells[dest.destinationId]) continue;
    const rows = input.trail.filter((r) => r.destinationId === dest.destinationId);
    if (!rows.length) continue;
    const reason =
      input.absenceByDestination.get(dest.destinationId)
      || input.absenceRowWide
      || null;
    const oop = input.outOfPanelByDestination.has(dest.destinationId);
    const cell = buildCoverageCell({
      rows,
      provider: dest.provider,
      channelLink: dest.channelLink,
      absenceReason: reason,
      outOfPanel: oop && rows.filter(isActiveLiveCreate).length === 0,
    });
    cells[dest.destinationId] = cell;
    if (cell.liveCount > 1) duplicate = true;
  }

  void anyLiveGap;

  return {
    productId: input.productId,
    sku: input.sku,
    name: input.name,
    thumbnailUrl: input.thumbnailUrl || null,
    cells,
    flags: {
      duplicate,
      outOfPanel,
      missingReason: hasMissingWithoutReason,
    },
  };
}

export function cellLiveForProvider(
  row: CoverageProductRow,
  destinations: CoverageDestinationMeta[],
  provider: string,
): boolean {
  const dest = pickPrimaryDestinationsByProvider(destinations)[provider.toUpperCase()];
  if (!dest) return false;
  const cell = row.cells[dest.destinationId];
  return Boolean(cell && cell.state === 'live' && cell.liveCount >= 1);
}

export function matchesCoverageFilter(
  row: CoverageProductRow,
  filter: CoverageFilter,
  destinations: CoverageDestinationMeta[],
): boolean {
  if (filter === 'all') return true;
  if (filter === 'duplicate') return row.flags.duplicate;
  if (filter === 'out_of_panel') return row.flags.outOfPanel;
  if (filter === 'missing_reason') return row.flags.missingReason;
  if (filter === 'gap_rubika_not_bale') {
    return cellLiveForProvider(row, destinations, 'RUBIKA')
      && !cellLiveForProvider(row, destinations, 'BALE');
  }
  if (filter === 'gap_bale_not_rubika') {
    return cellLiveForProvider(row, destinations, 'BALE')
      && !cellLiveForProvider(row, destinations, 'RUBIKA');
  }
  return true;
}

export type CoverageSummary = {
  telegramLive: number;
  rubikaLive: number;
  baleLive: number;
  duplicateProducts: number;
  gapRubikaNotBale: number;
  gapBaleNotRubika: number;
  outOfPanel: number;
  missingReason: number;
};

export function summarizeCoverageRows(
  rows: CoverageProductRow[],
  destinations: CoverageDestinationMeta[],
): CoverageSummary {
  const summary: CoverageSummary = {
    telegramLive: 0,
    rubikaLive: 0,
    baleLive: 0,
    duplicateProducts: 0,
    gapRubikaNotBale: 0,
    gapBaleNotRubika: 0,
    outOfPanel: 0,
    missingReason: 0,
  };
  for (const row of rows) {
    if (cellLiveForProvider(row, destinations, 'TELEGRAM')) summary.telegramLive += 1;
    if (cellLiveForProvider(row, destinations, 'RUBIKA')) summary.rubikaLive += 1;
    if (cellLiveForProvider(row, destinations, 'BALE')) summary.baleLive += 1;
    if (row.flags.duplicate) summary.duplicateProducts += 1;
    if (matchesCoverageFilter(row, 'gap_rubika_not_bale', destinations)) summary.gapRubikaNotBale += 1;
    if (matchesCoverageFilter(row, 'gap_bale_not_rubika', destinations)) summary.gapBaleNotRubika += 1;
    if (row.flags.outOfPanel) summary.outOfPanel += 1;
    if (row.flags.missingReason) summary.missingReason += 1;
  }
  return summary;
}

export type DuplicateFlatRow = {
  productId: string;
  sku: string;
  destinationId: string;
  channel: string;
  provider: string;
  messageIds: string[];
  deliveryIds: string[];
  count: number;
};

export function collectDuplicateFlatRows(
  rows: CoverageProductRow[],
  destinations: CoverageDestinationMeta[],
  skuByProduct: Map<string, string>,
): DuplicateFlatRow[] {
  const destById = new Map(destinations.map((d) => [d.destinationId, d]));
  const out: DuplicateFlatRow[] = [];
  for (const row of rows) {
    for (const [destinationId, cell] of Object.entries(row.cells)) {
      if (cell.liveCount <= 1) continue;
      const dest = destById.get(destinationId);
      out.push({
        productId: row.productId,
        sku: row.sku || skuByProduct.get(row.productId) || '',
        destinationId,
        channel: dest?.channel || 'RETAIL',
        provider: dest?.provider || '',
        messageIds: cell.messageIds,
        deliveryIds: cell.deliveryIds,
        count: cell.liveCount,
      });
    }
  }
  return out;
}

/** Idempotency key for out-of-panel ingest (D-5/D-6 audit-only). */
export function outOfPanelIngestHash(input: {
  channel: string;
  providerMessageId: string;
  action: string;
  occurredAt: string;
}): string {
  const raw = [
    String(input.channel || '').trim().toUpperCase(),
    String(input.providerMessageId || '').trim(),
    String(input.action || '').trim().toUpperCase(),
    String(input.occurredAt || '').trim(),
  ].join('|');
  // FNV-1a 32-bit — no crypto dep in pure module; collision risk acceptable for manual ingest.
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `oop_${(h >>> 0).toString(16).padStart(8, '0')}_${raw.length}`;
}

export function isOmnichannelCoverageUiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.OMNICHANNEL_COVERAGE_UI === 'true';
}
