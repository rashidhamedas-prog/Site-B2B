/**
 * PR-11 Media health: validate / scan / mark-needs-replace.
 * Prefer this over growing god omnichannel.service. Zero messenger adapter I/O.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppSettingEntity } from '../../settings/entities/app-setting.entity';
import { ProductEntity } from '../../product/entities/product.entity';
import { StorageService } from '../../upload/storage.service';
import { OmnichannelMediaAssetEntity } from '../entities/omnichannel-media-asset.entity';
import { isMissingRelationError } from '../media-registry';
import {
  assertChannelPhotoReady,
  MEDIA_MESSAGE_FA,
  mediaIssueLabelFa,
  validateImageBuffer,
  type MediaHealthIssue,
  type MediaValidateResult,
} from '../media-validation';
import type { ScanMediaDto, ValidateMediaDto } from '../dto/omnichannel-media.dto';
import { paginateItems } from './omnichannel-list-page';

export const MEDIA_SCAN_SUMMARY_KEY = 'omnichannel.media_scan_summary';
const SCAN_LIMIT_DEFAULT = 20;
const SCAN_LIMIT_MAX = 50;
/** Cap in-memory pool before page/limit slice (panel-urgent pagination). */
const LIST_MEDIA_TAKE = 300;

type Actor = { id: string; role?: string };

export type MediaScanFinding = {
  mediaId: string | null;
  productId: string | null;
  sku: string | null;
  publicUrl: string;
  storageKey: string | null;
  issue: MediaHealthIssue;
  bytes: number;
  messageFa: string;
};

export type MediaScanSummary = {
  startedAt: string | null;
  finishedAt: string | null;
  scanned: number;
  failed: number;
  actorId: string | null;
  topIssues: MediaScanFinding[];
};

@Injectable()
export class OmnichannelMediaService {
  constructor(
    @InjectRepository(OmnichannelMediaAssetEntity)
    private readonly mediaAssets: Repository<OmnichannelMediaAssetEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(AppSettingEntity)
    private readonly appSettings: Repository<AppSettingEntity>,
    private readonly storage: StorageService,
  ) {}

  async listMedia(opts?: { page?: number | string; limit?: number | string }) {
    try {
      const rows = await this.mediaAssets.find({
        order: { createdAt: 'DESC' },
        take: LIST_MEDIA_TAKE,
        select: [
          'id',
          'publicUrl',
          'storageKey',
          'altText',
          'ownerType',
          'ownerId',
          'createdAt',
          'healthStatus',
          'healthCheckedAt',
          'healthDetail',
        ],
      });
      return paginateItems(rows, opts?.page, opts?.limit);
    } catch (err) {
      if (isMissingRelationError(err)) return paginateItems([], opts?.page, opts?.limit);
      throw err;
    }
  }

  async patchMediaAlt(id: string, altText: string) {
    const row = await this.mediaAssets.findOne({ where: { id } });
    if (!row) throw new NotFoundException('فایل یافت نشد');
    row.altText = String(altText || '').trim().slice(0, 200);
    return this.mediaAssets.save(row);
  }

  /** Resolve bytes from url or storageKey — MinIO only; never adapters. */
  async validate(dto: ValidateMediaDto): Promise<MediaValidateResult & { publicUrl?: string; storageKey?: string }> {
    const { buffer, publicUrl, storageKey } = await this.loadBytes(dto);
    const result = await validateImageBuffer(buffer);
    return { ...result, publicUrl, storageKey };
  }

  /**
   * Paginated registry scan. Persists health columns + summary.
   * No auto-rewrite of storage (D-4).
   */
  async scan(dto: ScanMediaDto, actor?: Actor): Promise<{
    findings: MediaScanFinding[];
    nextCursor: string | null;
    summary: MediaScanSummary;
  }> {
    const limit = Math.min(SCAN_LIMIT_MAX, Math.max(1, Number(dto.limit) || SCAN_LIMIT_DEFAULT));
    const offset = parseCursor(dto.cursor);
    const startedAt = new Date().toISOString();
    let rows: OmnichannelMediaAssetEntity[] = [];
    try {
      rows = await this.mediaAssets.find({
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: offset,
        take: limit,
      });
    } catch (err) {
      if (isMissingRelationError(err)) {
        const empty = emptySummary(actor?.id || null);
        await this.persistSummary(empty);
        return { findings: [], nextCursor: null, summary: empty };
      }
      throw err;
    }

    const productIds = rows
      .filter((r) => r.ownerType === 'PRODUCT' && r.ownerId)
      .map((r) => String(r.ownerId));
    const skuByProduct = new Map<string, string>();
    if (productIds.length) {
      const products = await this.products.find({
        where: { id: In([...new Set(productIds)]) },
        select: ['id', 'sku'],
      });
      for (const p of products) skuByProduct.set(p.id, p.sku);
    }

    const findings: MediaScanFinding[] = [];
    let failed = 0;
    const now = new Date();
    for (const row of rows) {
      const finding = await this.scanOneRow(row, skuByProduct, now);
      findings.push(finding);
      if (finding.issue !== 'ok') failed += 1;
    }

    const nextCursor = rows.length === limit ? String(offset + limit) : null;
    const prev = await this.readSummary();
    const topIssues = mergeTopIssues(prev.topIssues, findings.filter((f) => f.issue !== 'ok'));
    const summary: MediaScanSummary = {
      startedAt: prev.startedAt || startedAt,
      finishedAt: new Date().toISOString(),
      scanned: (prev.scanned || 0) + findings.length,
      failed: (prev.failed || 0) + failed,
      actorId: actor?.id || prev.actorId,
      topIssues,
    };
    // Fresh scan from cursor 0 resets counters
    if (offset === 0) {
      summary.startedAt = startedAt;
      summary.scanned = findings.length;
      summary.failed = failed;
      summary.actorId = actor?.id || null;
      summary.topIssues = prioritizeFindings(findings.filter((f) => f.issue !== 'ok'));
    }
    await this.persistSummary(summary);
    return { findings, nextCursor, summary };
  }

  async health(): Promise<{
    summary: MediaScanSummary;
    issues: MediaScanFinding[];
    labels: Record<string, string>;
  }> {
    const summary = await this.readSummary();
    let issues: MediaScanFinding[] = [];
    try {
      const bad = await this.mediaAssets.find({
        where: [
          { healthStatus: 'truncated' },
          { healthStatus: 'undecodable' },
          { healthStatus: 'oversized' },
          { healthStatus: 'needs_replace' },
        ],
        order: { healthCheckedAt: 'DESC' },
        take: 50,
      });
      const productIds = bad
        .filter((r) => r.ownerType === 'PRODUCT' && r.ownerId)
        .map((r) => String(r.ownerId));
      const skuByProduct = new Map<string, string>();
      if (productIds.length) {
        const products = await this.products.find({
          where: { id: In([...new Set(productIds)]) },
          select: ['id', 'sku'],
        });
        for (const p of products) skuByProduct.set(p.id, p.sku);
      }
      issues = prioritizeFindings(
        bad.map((row) => ({
          mediaId: row.id,
          productId: row.ownerType === 'PRODUCT' ? row.ownerId : null,
          sku: row.ownerType === 'PRODUCT' && row.ownerId ? skuByProduct.get(row.ownerId) || null : null,
          publicUrl: row.publicUrl,
          storageKey: row.storageKey,
          issue: (row.healthStatus || 'unknown') as MediaHealthIssue,
          bytes: 0,
          messageFa: mediaIssueLabelFa(row.healthStatus),
        })),
      );
    } catch (err) {
      if (!isMissingRelationError(err)) throw err;
    }
    return {
      summary,
      issues: issues.length ? issues : summary.topIssues,
      labels: {
        truncated: mediaIssueLabelFa('truncated'),
        undecodable: mediaIssueLabelFa('undecodable'),
        oversized: mediaIssueLabelFa('oversized'),
        needs_replace: mediaIssueLabelFa('needs_replace'),
        ok: mediaIssueLabelFa('ok'),
        unknown: mediaIssueLabelFa('unknown'),
      },
    };
  }

  async markNeedsReplace(id: string, actor?: Actor, reason?: string) {
    const row = await this.mediaAssets.findOne({ where: { id } });
    if (!row) throw new NotFoundException('فایل یافت نشد');
    row.healthStatus = 'needs_replace';
    row.healthCheckedAt = new Date();
    row.healthDetail = String(reason || 'needs_replace').slice(0, 120);
    const saved = await this.mediaAssets.save(row);
    return {
      id: saved.id,
      publicUrl: saved.publicUrl,
      healthStatus: saved.healthStatus,
      healthDetail: saved.healthDetail,
      actorId: actor?.id || null,
    };
  }

  /**
   * Live publish gate (D-1): load each photo URL and assert readiness.
   * Dry-run callers should skip. Throws BadRequestException with Persian copy.
   */
  async assertPublicationPhotosReady(photoUrls: string[] | null | undefined): Promise<void> {
    const urls = (photoUrls || []).map((u) => String(u || '').trim()).filter(Boolean);
    for (const url of urls) {
      try {
        const { buffer } = await this.loadBytes({ url });
        await assertChannelPhotoReady(buffer);
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        const msg =
          err instanceof Error && err.message.startsWith('unsupported_media')
            ? MEDIA_MESSAGE_FA.unsupported_media
            : MEDIA_MESSAGE_FA.unsupported_media;
        throw new BadRequestException(msg);
      }
    }
  }

  private async scanOneRow(
    row: OmnichannelMediaAssetEntity,
    skuByProduct: Map<string, string>,
    now: Date,
  ): Promise<MediaScanFinding> {
    let result: MediaValidateResult;
    try {
      const { buffer } = await this.loadBytes({
        url: row.publicUrl,
        storageKey: row.storageKey,
      });
      result = await validateImageBuffer(buffer);
    } catch {
      result = {
        ok: false,
        code: 'undecodable',
        messageFa: MEDIA_MESSAGE_FA.undecodable,
        bytes: 0,
      };
    }
    const issue: MediaHealthIssue = result.ok ? 'ok' : result.code || 'undecodable';
    row.healthStatus = issue;
    row.healthCheckedAt = now;
    row.healthDetail = result.ok ? 'ok' : result.code || 'undecodable';
    try {
      await this.mediaAssets.save(row);
    } catch {
      // Missing column before migration — still return finding
    }
    return {
      mediaId: row.id,
      productId: row.ownerType === 'PRODUCT' ? row.ownerId : null,
      sku: row.ownerType === 'PRODUCT' && row.ownerId ? skuByProduct.get(row.ownerId) || null : null,
      publicUrl: row.publicUrl,
      storageKey: row.storageKey,
      issue,
      bytes: result.bytes,
      messageFa: result.messageFa,
    };
  }

  private async loadBytes(dto: { url?: string; storageKey?: string }): Promise<{
    buffer: Buffer;
    publicUrl?: string;
    storageKey?: string;
  }> {
    const rawKey = String(dto.storageKey || '').trim();
    const rawUrl = String(dto.url || '').trim();
    if (!rawKey && !rawUrl) {
      throw new BadRequestException('url یا storageKey الزامی است');
    }
    let key = rawKey || null;
    if (!key && rawUrl) {
      key = this.storage.extractKeyFromUrl(rawUrl);
    }
    if (!key) {
      throw new BadRequestException('آدرس تصویر قابل شناسایی نیست');
    }
    try {
      const buffer = await this.storage.readOwnedImage(key);
      return { buffer, publicUrl: rawUrl || undefined, storageKey: key };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(MEDIA_MESSAGE_FA.undecodable);
    }
  }

  private async readSummary(): Promise<MediaScanSummary> {
    try {
      const row = await this.appSettings.findOne({ where: { key: MEDIA_SCAN_SUMMARY_KEY } });
      const value = (row?.value || {}) as Partial<MediaScanSummary>;
      return {
        startedAt: value.startedAt || null,
        finishedAt: value.finishedAt || null,
        scanned: Number(value.scanned) || 0,
        failed: Number(value.failed) || 0,
        actorId: value.actorId || null,
        topIssues: Array.isArray(value.topIssues) ? value.topIssues : [],
      };
    } catch {
      return emptySummary(null);
    }
  }

  private async persistSummary(summary: MediaScanSummary): Promise<void> {
    try {
      await this.appSettings.save(
        this.appSettings.create({
          key: MEDIA_SCAN_SUMMARY_KEY,
          value: summary as unknown as Record<string, unknown>,
        }),
      );
    } catch {
      // settings table may be unavailable in unit contexts
    }
  }
}

function parseCursor(cursor?: string): number {
  if (!cursor) return 0;
  const n = Number(cursor);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function emptySummary(actorId: string | null): MediaScanSummary {
  return {
    startedAt: null,
    finishedAt: null,
    scanned: 0,
    failed: 0,
    actorId,
    topIssues: [],
  };
}

/** Prefer truncated (5047-class) then undecodable / oversized. */
function prioritizeFindings(rows: MediaScanFinding[]): MediaScanFinding[] {
  const rank = (issue: string) => {
    if (issue === 'truncated') return 0;
    if (issue === 'undecodable') return 1;
    if (issue === 'oversized') return 2;
    if (issue === 'needs_replace') return 3;
    return 9;
  };
  return [...rows].sort((a, b) => rank(a.issue) - rank(b.issue)).slice(0, 50);
}

function mergeTopIssues(prev: MediaScanFinding[], next: MediaScanFinding[]): MediaScanFinding[] {
  const byUrl = new Map<string, MediaScanFinding>();
  for (const row of [...prev, ...next]) {
    if (!row.publicUrl) continue;
    byUrl.set(row.publicUrl, row);
  }
  return prioritizeFindings([...byUrl.values()]);
}
