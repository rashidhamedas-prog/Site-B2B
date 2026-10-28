/**
 * PR-8 coverage matrix read + absence reason + out-of-panel audit ingest.
 * SQL-level product paging — never builds the full catalog in memory.
 * No connector / worker / vault side effects.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ProductEntity } from '../../product/entities/product.entity';
import { ChannelConnectionEntity } from '../entities/channel-connection.entity';
import { ChannelDestinationEntity } from '../entities/channel-destination.entity';
import { OmnichannelAuditEntity } from '../entities/omnichannel-audit.entity';
import { OmnichannelCoverageAbsenceEntity } from '../entities/omnichannel-coverage-absence.entity';
import { OmnichannelDeliveryMessageEntity } from '../entities/omnichannel-delivery-message.entity';
import { PublicationDeliveryEntity } from '../entities/publication-delivery.entity';
import { PublicationEntity } from '../entities/publication.entity';
import { assertNoPlaintextSecrets } from '../omnichannel-secrets';
import {
  assertGoRefPresent,
  normalizeGoRef,
  redactAuditPayloadSummary,
  type OmnichannelRole,
} from '../omnichannel-rbac';
import {
  buildProductCoverageRow,
  collectDuplicateFlatRows,
  isCoverageFilter,
  outOfPanelIngestHash,
  pickPrimaryDestinationsByProvider,
  resolveTrailMessageIds,
  type CoverageDestinationMeta,
  type CoverageFilter,
  type CoverageProductRow,
  type CoverageSummary,
  type CoverageTrailRow,
  type DuplicateFlatRow,
} from '../coverage-matrix';

type Actor = { id: string; omnichannelRole?: OmnichannelRole };

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const ABSENCE_REASON_MAX = 500;
const DUPLICATES_HARD_CAP = 1000;

@Injectable()
export class OmnichannelCoverageService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publications: Repository<PublicationEntity>,
    @InjectRepository(PublicationDeliveryEntity)
    private readonly deliveries: Repository<PublicationDeliveryEntity>,
    @InjectRepository(ChannelDestinationEntity)
    private readonly destinations: Repository<ChannelDestinationEntity>,
    @InjectRepository(ChannelConnectionEntity)
    private readonly connections: Repository<ChannelConnectionEntity>,
    @InjectRepository(OmnichannelCoverageAbsenceEntity)
    private readonly absences: Repository<OmnichannelCoverageAbsenceEntity>,
    @InjectRepository(OmnichannelAuditEntity)
    private readonly audits: Repository<OmnichannelAuditEntity>,
    @InjectRepository(OmnichannelDeliveryMessageEntity)
    private readonly deliveryMessages: Repository<OmnichannelDeliveryMessageEntity>,
  ) {}

  async listCoverage(query: {
    page?: number | string;
    limit?: number | string;
    q?: string;
    filter?: string;
    channel?: string;
  }): Promise<{
    page: number;
    limit: number;
    total: number;
    summary: CoverageSummary;
    destinations: CoverageDestinationMeta[];
    rows: CoverageProductRow[];
  }> {
    const page = Math.max(1, Number(query.page) || DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_LIMIT));
    const filter: CoverageFilter = isCoverageFilter(query.filter) ? query.filter : 'all';
    const salesChannel = String(query.channel || 'RETAIL').toUpperCase() === 'WHOLESALE'
      ? 'WHOLESALE'
      : 'RETAIL';
    const q = String(query.q || '').trim();

    const destinations = await this.loadDestinationMeta(salesChannel);
    const primary = pickPrimaryDestinationsByProvider(destinations);
    const { ids, total } = await this.selectFilteredProductPage({
      salesChannel,
      q,
      filter,
      primary,
      page,
      limit,
    });
    const summary = await this.summarizeFilteredUniverse({
      salesChannel,
      q,
      filter,
      primary,
    });
    const rows = await this.buildRowsForProducts(ids, destinations, salesChannel);
    return { page, limit, total, summary, destinations, rows };
  }

  async getCoverageDetail(productId: string, channel = 'RETAIL'): Promise<{
    product: { id: string; sku: string; name: string; thumbnailUrl: string | null };
    destinations: CoverageDestinationMeta[];
    row: CoverageProductRow;
    trail: Array<{
      deliveryId: string;
      destinationId: string;
      action: string;
      status: string;
      providerMessageId: string | null;
      messageIds: string[];
      publicationStatus: string;
      supersededAt: string | null;
      sentAt: string | null;
    }>;
  }> {
    const product = await this.products.findOne({
      where: { id: productId },
      select: ['id', 'sku', 'name', 'images'],
    });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    const salesChannel = String(channel || 'RETAIL').toUpperCase() === 'WHOLESALE'
      ? 'WHOLESALE'
      : 'RETAIL';
    const destinations = await this.loadDestinationMeta(salesChannel);
    const [row] = await this.buildRowsForProducts([product.id], destinations, salesChannel);
    const trailRows = await this.loadTrailForProducts([product.id], salesChannel);
    return {
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        thumbnailUrl: firstImage(product.images),
      },
      destinations,
      row: row || {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        thumbnailUrl: firstImage(product.images),
        cells: {},
        flags: { duplicate: false, outOfPanel: false, missingReason: true },
      },
      trail: trailRows.map((t) => ({
        deliveryId: t.deliveryId,
        destinationId: t.destinationId,
        action: t.action,
        status: t.status,
        providerMessageId: t.providerMessageId || null,
        messageIds: resolveTrailMessageIds(t),
        publicationStatus: t.publicationStatus,
        supersededAt: t.supersededAt ? String(t.supersededAt) : null,
        sentAt: t.sentAt ? String(t.sentAt) : null,
      })),
    };
  }

  async listDuplicates(channel = 'RETAIL'): Promise<{ items: DuplicateFlatRow[]; truncated: boolean }> {
    const salesChannel = String(channel || 'RETAIL').toUpperCase() === 'WHOLESALE'
      ? 'WHOLESALE'
      : 'RETAIL';
    const destinations = await this.loadDestinationMeta(salesChannel);
    const pairs = await this.selectDuplicatePairs(salesChannel, DUPLICATES_HARD_CAP + 1);
    const truncated = pairs.length > DUPLICATES_HARD_CAP;
    const capped = truncated ? pairs.slice(0, DUPLICATES_HARD_CAP) : pairs;
    if (!capped.length) return { items: [], truncated: false };

    const productIds = [...new Set(capped.map((p) => p.productId))];
    const rows = await this.buildRowsForProducts(productIds, destinations, salesChannel);
    const skuByProduct = new Map(rows.map((r) => [r.productId, r.sku]));
    const want = new Set(capped.map((p) => `${p.productId}|${p.destinationId}`));
    const items = collectDuplicateFlatRows(rows, destinations, skuByProduct).filter((item) =>
      want.has(`${item.productId}|${item.destinationId}`),
    );
    return { items, truncated };
  }

  async setAbsenceReason(
    productId: string,
    body: { destinationId?: string | null; reason: string },
    actor: Actor,
  ): Promise<{ ok: true; productId: string; destinationId: string | null; reason: string }> {
    const product = await this.products.findOne({ where: { id: productId }, select: ['id'] });
    if (!product) throw new NotFoundException('محصول یافت نشد');
    const reason = String(body?.reason || '').trim();
    if (!reason) throw new BadRequestException('دلیل الزامی است');
    if (reason.length > ABSENCE_REASON_MAX) {
      throw new BadRequestException(`دلیل حداکثر ${ABSENCE_REASON_MAX} کاراکتر`);
    }
    assertNoPlaintextSecrets({ reason });
    const destinationId = body?.destinationId ? String(body.destinationId).trim() : null;
    if (destinationId) {
      const dest = await this.destinations.findOne({ where: { id: destinationId }, select: ['id'] });
      if (!dest) throw new BadRequestException('مقصد نامعتبر است');
    }

    const existing = await this.absences.findOne({
      where: destinationId
        ? { productId, destinationId }
        : { productId, destinationId: IsNull() },
    });
    const row = existing
      ? Object.assign(existing, { reason, actorId: actor.id })
      : this.absences.create({
        productId,
        destinationId,
        reason,
        actorId: actor.id,
      });
    await this.absences.save(row);

    await this.audits.save(
      this.audits.create({
        actorId: actor.id,
        action: 'coverage_absence_reason_set',
        entityType: 'product',
        entityId: productId,
        channel: null,
        reason,
        goRef: null,
        source: 'panel',
        payload: redactAuditPayloadSummary({
          productId,
          destinationId,
          before: existing?.reason || null,
          after: reason,
        }),
      }),
    );

    return { ok: true, productId, destinationId, reason };
  }

  async ingestOutOfPanel(
    body: {
      goRef?: string;
      events?: Array<{
        channel: string;
        destinationId?: string | null;
        productId?: string | null;
        providerMessageId: string;
        action: string;
        occurredAt: string;
        note?: string | null;
      }>;
    },
    actor: Actor,
  ): Promise<{ inserted: number; skipped: number; hashes: string[] }> {
    const goRef = assertGoRefPresent(body?.goRef);
    assertNoPlaintextSecrets({ goRef });
    const events = Array.isArray(body?.events) ? body.events : [];
    if (!events.length) throw new BadRequestException('حداقل یک رویداد لازم است');
    if (events.length > 100) throw new BadRequestException('حداکثر ۱۰۰ رویداد در هر درخواست');

    let inserted = 0;
    let skipped = 0;
    const hashes: string[] = [];

    for (const ev of events) {
      const channel = String(ev.channel || '').trim();
      const providerMessageId = String(ev.providerMessageId || '').trim();
      const action = String(ev.action || '').trim().toUpperCase();
      const occurredAt = String(ev.occurredAt || '').trim();
      if (!channel || !providerMessageId || !occurredAt) {
        throw new BadRequestException('channel، providerMessageId و occurredAt الزامی‌اند');
      }
      if (action !== 'CREATE' && action !== 'DELETE') {
        throw new BadRequestException('action باید CREATE یا DELETE باشد');
      }
      if (!Number.isFinite(new Date(occurredAt).getTime())) {
        throw new BadRequestException('occurredAt نامعتبر است');
      }
      const note = ev.note != null ? String(ev.note).trim().slice(0, 500) : null;
      if (note) assertNoPlaintextSecrets({ note });

      const hash = outOfPanelIngestHash({ channel, providerMessageId, action, occurredAt });
      hashes.push(hash);

      const existing = await this.audits
        .createQueryBuilder('a')
        .select(['a.id'])
        .where('a.action = :action', { action: 'coverage_out_of_panel_ingest' })
        .andWhere('a.source = :source', { source: 'out_of_panel' })
        .andWhere("a.payload->>'ingestHash' = :hash", { hash })
        .limit(1)
        .getOne();
      if (existing) {
        skipped += 1;
        continue;
      }

      const destinationId = ev.destinationId ? String(ev.destinationId).trim() : null;
      const productId = ev.productId ? String(ev.productId).trim() : null;
      await this.audits.save(
        this.audits.create({
          actorId: actor.id,
          action: 'coverage_out_of_panel_ingest',
          entityType: productId ? 'product' : 'coverage',
          entityId: productId || destinationId || providerMessageId,
          channel: channel.toUpperCase(),
          reason: note,
          goRef: normalizeGoRef(goRef),
          source: 'out_of_panel',
          payload: redactAuditPayloadSummary({
            ingestHash: hash,
            providerMessageId,
            destinationId,
            productId,
            action,
            occurredAt,
            source: 'out_of_panel',
          }),
        }),
      );
      inserted += 1;
    }

    return { inserted, skipped, hashes };
  }

  /* ---------------- private ---------------- */

  private async loadDestinationMeta(salesChannel: string): Promise<CoverageDestinationMeta[]> {
    const dests = await this.destinations.find({ order: { displayName: 'ASC' } });
    if (!dests.length) return [];
    const conns = await this.connections.find({
      where: { id: In([...new Set(dests.map((d) => d.connectionId))]) },
      select: ['id', 'provider', 'channel'],
    });
    const byId = new Map(conns.map((c) => [c.id, c]));
    const out: CoverageDestinationMeta[] = [];
    for (const dest of dests) {
      const conn = byId.get(dest.connectionId);
      if (!conn) continue;
      if (conn.channel && conn.channel !== salesChannel) continue;
      const settings = (dest.settings || {}) as Record<string, unknown>;
      const publish = (dest.publishSettings || {}) as Record<string, unknown>;
      const channelLink = String(
        settings.channelLink || publish.channelLink || settings.link || '',
      ).trim() || null;
      out.push({
        destinationId: dest.id,
        provider: String(conn.provider || '').toUpperCase(),
        channel: conn.channel,
        displayName: dest.displayName,
        channelLink,
      });
    }
    return out;
  }

  /**
   * Page product ids with filter applied in SQL (LIMIT/OFFSET). Never loads full catalog trails.
   */
  private async selectFilteredProductPage(input: {
    salesChannel: string;
    q: string;
    filter: CoverageFilter;
    primary: Record<string, CoverageDestinationMeta>;
    page: number;
    limit: number;
  }): Promise<{ ids: string[]; total: number }> {
    const offset = (input.page - 1) * input.limit;
    const params: Record<string, unknown> = {
      ch: input.salesChannel,
      limit: input.limit,
      offset,
      telegramId: input.primary.TELEGRAM?.destinationId || null,
      rubikaId: input.primary.RUBIKA?.destinationId || null,
      baleId: input.primary.BALE?.destinationId || null,
    };
    const where = this.buildFilterSql(input.filter, input.q, params);
    const countSql = `
      WITH ${this.coverageCtesSql()}
      SELECT COUNT(*)::int AS total
      FROM flagged f
      INNER JOIN products pr ON pr.id = f.product_id
      WHERE ${where}
    `;
    const pageSql = `
      WITH ${this.coverageCtesSql()}
      SELECT f.product_id AS id
      FROM flagged f
      INNER JOIN products pr ON pr.id = f.product_id
      WHERE ${where}
      ORDER BY pr.sku ASC
      LIMIT :limit OFFSET :offset
    `;
    const countQ = bindNamedSql(countSql, params);
    const pageQ = bindNamedSql(pageSql, params);
    const [countRow] = await this.products.manager.query(countQ.sql, countQ.values);
    const rows = await this.products.manager.query(pageQ.sql, pageQ.values);
    return {
      ids: rows.map((r: { id: string }) => String(r.id)),
      total: Number(countRow?.total || 0),
    };
  }

  private async summarizeFilteredUniverse(input: {
    salesChannel: string;
    q: string;
    filter: CoverageFilter;
    primary: Record<string, CoverageDestinationMeta>;
  }): Promise<CoverageSummary> {
    const params: Record<string, unknown> = {
      ch: input.salesChannel,
      telegramId: input.primary.TELEGRAM?.destinationId || null,
      rubikaId: input.primary.RUBIKA?.destinationId || null,
      baleId: input.primary.BALE?.destinationId || null,
    };
    const where = this.buildFilterSql(input.filter, input.q, params);
    const sql = `
      WITH ${this.coverageCtesSql()}
      SELECT
        COUNT(*) FILTER (WHERE f.telegram_live)::int AS "telegramLive",
        COUNT(*) FILTER (WHERE f.rubika_live)::int AS "rubikaLive",
        COUNT(*) FILTER (WHERE f.bale_live)::int AS "baleLive",
        COUNT(*) FILTER (WHERE f.is_duplicate)::int AS "duplicateProducts",
        COUNT(*) FILTER (WHERE f.rubika_live AND NOT f.bale_live)::int AS "gapRubikaNotBale",
        COUNT(*) FILTER (WHERE f.bale_live AND NOT f.rubika_live)::int AS "gapBaleNotRubika",
        COUNT(*) FILTER (WHERE f.out_of_panel)::int AS "outOfPanel",
        COUNT(*) FILTER (WHERE f.missing_reason)::int AS "missingReason"
      FROM flagged f
      INNER JOIN products pr ON pr.id = f.product_id
      WHERE ${where}
    `;
    const bound = bindNamedSql(sql, params);
    const [row] = await this.products.manager.query(bound.sql, bound.values);
    return {
      telegramLive: Number(row?.telegramLive || 0),
      rubikaLive: Number(row?.rubikaLive || 0),
      baleLive: Number(row?.baleLive || 0),
      duplicateProducts: Number(row?.duplicateProducts || 0),
      gapRubikaNotBale: Number(row?.gapRubikaNotBale || 0),
      gapBaleNotRubika: Number(row?.gapBaleNotRubika || 0),
      outOfPanel: Number(row?.outOfPanel || 0),
      missingReason: Number(row?.missingReason || 0),
    };
  }

  private async selectDuplicatePairs(
    salesChannel: string,
    limit: number,
  ): Promise<Array<{ productId: string; destinationId: string; liveCount: number }>> {
    const sql = `
      SELECT d."sourceId" AS "productId",
             d."destinationId" AS "destinationId",
             COUNT(*)::int AS "liveCount"
      FROM omnichannel_publication_deliveries d
      INNER JOIN omnichannel_publications p ON p.id = d."publicationId"
      WHERE d."sourceType" = 'PRODUCT'
        AND d.action = 'CREATE'
        AND d.status = 'SUCCEEDED'
        AND d."supersededAt" IS NULL
        AND UPPER(p.status) <> 'WITHDRAWN'
        AND d."providerMessageId" IS NOT NULL
        AND BTRIM(d."providerMessageId") <> ''
        AND p.channel = $1
      GROUP BY d."sourceId", d."destinationId"
      HAVING COUNT(*) > 1
      ORDER BY d."sourceId", d."destinationId"
      LIMIT $2
    `;
    const rows = await this.products.manager.query(sql, [salesChannel, limit]);
    return rows.map((r: { productId: string; destinationId: string; liveCount: number }) => ({
      productId: String(r.productId),
      destinationId: String(r.destinationId),
      liveCount: Number(r.liveCount),
    }));
  }

  /** Shared CTEs: universe → live → oop → absence → flagged. */
  private coverageCtesSql(): string {
    return `
universe AS (
  SELECT p.id
  FROM products p
  WHERE p."showOnRetail" = true AND p."deletedAt" IS NULL
  UNION
  SELECT DISTINCT pub."sourceId"
  FROM omnichannel_publications pub
  WHERE pub."sourceType" = 'PRODUCT'
),
live AS (
  SELECT d."sourceId" AS product_id,
         d."destinationId" AS destination_id,
         COUNT(*)::int AS live_count
  FROM omnichannel_publication_deliveries d
  INNER JOIN omnichannel_publications p ON p.id = d."publicationId"
  WHERE d."sourceType" = 'PRODUCT'
    AND d.action = 'CREATE'
    AND d.status = 'SUCCEEDED'
    AND d."supersededAt" IS NULL
    AND UPPER(p.status) <> 'WITHDRAWN'
    AND d."providerMessageId" IS NOT NULL
    AND BTRIM(d."providerMessageId") <> ''
    AND p.channel = :ch
  GROUP BY d."sourceId", d."destinationId"
),
oop AS (
  SELECT DISTINCT
    COALESCE(NULLIF(BTRIM(a.payload->>'productId'), ''), a."entityId"::text) AS product_id
  FROM omnichannel_audits a
  WHERE a.source = 'out_of_panel'
    AND a.action = 'coverage_out_of_panel_ingest'
),
absence_any AS (
  SELECT DISTINCT "productId" AS product_id
  FROM omnichannel_coverage_absence
),
flagged AS (
  SELECT
    u.id AS product_id,
    EXISTS (
      SELECT 1 FROM live l WHERE l.product_id = u.id AND l.live_count > 1
    ) AS is_duplicate,
    (
      :telegramId::uuid IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM live l
        WHERE l.product_id = u.id AND l.destination_id = :telegramId::uuid AND l.live_count >= 1
      )
    ) AS telegram_live,
    (
      :rubikaId::uuid IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM live l
        WHERE l.product_id = u.id AND l.destination_id = :rubikaId::uuid AND l.live_count >= 1
      )
    ) AS rubika_live,
    (
      :baleId::uuid IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM live l
        WHERE l.product_id = u.id AND l.destination_id = :baleId::uuid AND l.live_count >= 1
      )
    ) AS bale_live,
    EXISTS (SELECT 1 FROM oop o WHERE o.product_id = u.id::text) AS out_of_panel,
    (
      (
        (:telegramId::uuid IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM live l
          WHERE l.product_id = u.id AND l.destination_id = :telegramId::uuid AND l.live_count >= 1
        ))
        OR (:rubikaId::uuid IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM live l
          WHERE l.product_id = u.id AND l.destination_id = :rubikaId::uuid AND l.live_count >= 1
        ))
        OR (:baleId::uuid IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM live l
          WHERE l.product_id = u.id AND l.destination_id = :baleId::uuid AND l.live_count >= 1
        ))
      )
      AND NOT EXISTS (SELECT 1 FROM absence_any ab WHERE ab.product_id = u.id)
    ) AS missing_reason
  FROM universe u
)`;
  }

  private buildFilterSql(
    filter: CoverageFilter,
    q: string,
    params: Record<string, unknown>,
  ): string {
    const parts: string[] = ['pr."deletedAt" IS NULL'];
    if (q) {
      params.q = `%${q}%`;
      parts.push('(pr.sku ILIKE :q OR pr.name ILIKE :q)');
    }
    if (filter === 'duplicate') parts.push('f.is_duplicate');
    else if (filter === 'out_of_panel') parts.push('f.out_of_panel');
    else if (filter === 'missing_reason') parts.push('f.missing_reason');
    else if (filter === 'gap_rubika_not_bale') parts.push('f.rubika_live AND NOT f.bale_live');
    else if (filter === 'gap_bale_not_rubika') parts.push('f.bale_live AND NOT f.rubika_live');
    return parts.join(' AND ');
  }

  private async buildRowsForProducts(
    productIds: string[],
    destinations: CoverageDestinationMeta[],
    salesChannel: string,
  ): Promise<CoverageProductRow[]> {
    if (!productIds.length) return [];

    const products = await this.products.find({
      where: { id: In(productIds) },
      select: ['id', 'sku', 'name', 'images'],
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const trail = await this.loadTrailForProducts(productIds, salesChannel);
    const trailByProduct = new Map<string, CoverageTrailRow[]>();
    for (const row of trail) {
      const list = trailByProduct.get(row.productId) || [];
      list.push(row);
      trailByProduct.set(row.productId, list);
    }

    const absences = await this.absences.find({ where: { productId: In(productIds) } });
    const absenceDest = new Map<string, Map<string, string>>();
    const absenceRow = new Map<string, string>();
    for (const a of absences) {
      if (a.destinationId) {
        const m = absenceDest.get(a.productId) || new Map();
        m.set(a.destinationId, a.reason);
        absenceDest.set(a.productId, m);
      } else {
        absenceRow.set(a.productId, a.reason);
      }
    }

    const oopFlags = await this.loadOutOfPanelFlags(productIds, destinations);

    const rows: CoverageProductRow[] = [];
    // Preserve SQL page order.
    for (const id of productIds) {
      const product = byId.get(id);
      if (!product) continue;
      const oop = oopFlags.get(id) || { byDest: new Set<string>(), productWide: false };
      rows.push(
        buildProductCoverageRow({
          productId: id,
          sku: product.sku,
          name: product.name,
          thumbnailUrl: firstImage(product.images),
          destinations,
          trail: trailByProduct.get(id) || [],
          absenceByDestination: absenceDest.get(id) || new Map(),
          absenceRowWide: absenceRow.get(id) || null,
          outOfPanelByDestination: oop.byDest,
          outOfPanelProduct: oop.productWide,
        }),
      );
    }
    return rows;
  }

  private async loadTrailForProducts(
    productIds: string[],
    salesChannel: string,
  ): Promise<CoverageTrailRow[]> {
    if (!productIds.length) return [];
    const rows = await this.deliveries
      .createQueryBuilder('d')
      .innerJoin(PublicationEntity, 'p', 'p.id = d."publicationId"')
      .select([
        'd.id AS "deliveryId"',
        'd."destinationId" AS "destinationId"',
        'd.action AS action',
        'd.status AS status',
        'd."providerMessageId" AS "providerMessageId"',
        'd."supersededAt" AS "supersededAt"',
        'd."sentAt" AS "sentAt"',
        'd."updatedAt" AS "updatedAt"',
        'd."createdAt" AS "createdAt"',
        'd."sourceId" AS "productId"',
        'p.status AS "publicationStatus"',
        'p.id AS "publicationId"',
      ])
      .where('d."sourceType" = :st', { st: 'PRODUCT' })
      .andWhere('d."sourceId" IN (:...ids)', { ids: productIds })
      .andWhere('p.channel = :ch', { ch: salesChannel })
      .andWhere('d.action IN (:...actions)', { actions: ['CREATE', 'DELETE'] })
      .orderBy('d."createdAt"', 'ASC')
      .getRawMany();

    const deliveryIds = rows.map((r) => String(r.deliveryId));
    const msgByDelivery = await this.loadDeliveryMessageIds(deliveryIds);

    return rows.map((r) => ({
      productId: String(r.productId),
      destinationId: String(r.destinationId),
      deliveryId: String(r.deliveryId),
      publicationId: String(r.publicationId),
      publicationStatus: String(r.publicationStatus || ''),
      action: String(r.action || ''),
      status: String(r.status || ''),
      providerMessageId: r.providerMessageId ?? null,
      deliveryMessageIds: msgByDelivery.get(String(r.deliveryId)) || [],
      supersededAt: r.supersededAt ?? null,
      sentAt: r.sentAt ?? null,
      updatedAt: r.updatedAt ?? null,
      createdAt: r.createdAt ?? null,
    }));
  }

  /** Prefer PR-7 delivery_messages (non-deleted) over CSV providerMessageId. */
  private async loadDeliveryMessageIds(
    deliveryIds: string[],
  ): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (!deliveryIds.length) return out;
    const rows = await this.deliveryMessages
      .createQueryBuilder('m')
      .select(['m.deliveryId', 'm.providerMessageId', 'm.albumIndex'])
      .where('m.deliveryId IN (:...ids)', { ids: deliveryIds })
      .andWhere('m.deletedAt IS NULL')
      .orderBy('m.albumIndex', 'ASC')
      .addOrderBy('m.createdAt', 'ASC')
      .getMany();
    for (const row of rows) {
      const list = out.get(row.deliveryId) || [];
      const id = String(row.providerMessageId || '').trim();
      if (id && !list.includes(id)) list.push(id);
      out.set(row.deliveryId, list);
    }
    return out;
  }

  /** Keyed by the requested productIds — no global last-500 scan. */
  private async loadOutOfPanelFlags(
    productIds: string[],
    destinations: CoverageDestinationMeta[],
  ): Promise<Map<string, { byDest: Set<string>; productWide: boolean }>> {
    const out = new Map<string, { byDest: Set<string>; productWide: boolean }>();
    for (const id of productIds) out.set(id, { byDest: new Set(), productWide: false });
    if (!productIds.length) return out;

    const destIds = new Set(destinations.map((d) => d.destinationId));
    const audits = await this.audits
      .createQueryBuilder('a')
      .select(['a.entityId', 'a.entityType', 'a.payload', 'a.channel'])
      .where('a.source = :source', { source: 'out_of_panel' })
      .andWhere('a.action = :action', { action: 'coverage_out_of_panel_ingest' })
      .andWhere(
        `(a."entityId" IN (:...ids) OR a.payload->>'productId' IN (:...ids))`,
        { ids: productIds },
      )
      .getMany();

    for (const a of audits) {
      const payload = (a.payload || {}) as Record<string, unknown>;
      const fromPayload = typeof payload.productId === 'string' ? payload.productId.trim() : '';
      const productId = productIds.includes(a.entityId)
        ? a.entityId
        : (fromPayload && productIds.includes(fromPayload) ? fromPayload : null);
      if (!productId || !out.has(productId)) continue;
      const entry = out.get(productId)!;
      const destinationId = typeof payload.destinationId === 'string' ? payload.destinationId : null;
      if (destinationId && destIds.has(destinationId)) {
        entry.byDest.add(destinationId);
      } else {
        entry.productWide = true;
      }
    }
    return out;
  }
}

function firstImage(images: string[] | null | undefined): string | null {
  if (!Array.isArray(images) || !images.length) return null;
  const url = String(images[0] || '').trim();
  return url || null;
}

/** Rewrite `:name` placeholders to `$n` for `manager.query` (pg). */
function bindNamedSql(
  sql: string,
  params: Record<string, unknown>,
): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const indexByName = new Map<string, number>();
  const rewritten = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_full, name: string) => {
    let idx = indexByName.get(name);
    if (!idx) {
      values.push(Object.prototype.hasOwnProperty.call(params, name) ? params[name] : null);
      idx = values.length;
      indexByName.set(name, idx);
    }
    return `$${idx}`;
  });
  return { sql: rewritten, values };
}
