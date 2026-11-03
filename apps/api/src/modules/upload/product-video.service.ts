import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ProductEntity } from '../product/entities/product.entity';
import { ProductVideoEntity } from '../product/entities/product-video.entity';
import { OUTBOX_EVENT_TYPES } from '../omnichannel/omnichannel.constants';
import { OutboxService } from '../omnichannel/services/outbox.service';
import { isPublicProductRow } from '../product/public-product-status';
import { StorageService } from './storage.service';
import {
  VIDEO_MAX_SORT_ORDER,
  VIDEO_MIN_SORT_ORDER,
  type ProductVideoTranscodePayload,
} from './video-policy';
import { sanitizeObjectKey } from './storage-delete';

export interface ProductVideoPublicResponse {
  mp4_720: string | null;
  mp4_480: string | null;
  webm_720: string | null;
  poster: string | null;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  /** 1-based gallery slot; always >= 2 because slot 1 is the first image. */
  sort_order: number;
  /** ISO timestamp of the upload (VideoObject.uploadDate). */
  upload_date: string | null;
}

function gallerySortOrder(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= VIDEO_MIN_SORT_ORDER ? n : VIDEO_MIN_SORT_ORDER;
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

@Injectable()
export class ProductVideoService {
  private readonly logger = new Logger(ProductVideoService.name);

  constructor(
    @InjectRepository(ProductVideoEntity)
    private readonly videos: Repository<ProductVideoEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly outbox: OutboxService,
  ) {}

  async assertProductExists(productId: string): Promise<void> {
    if (!productId || !(await this.products.exist({ where: { id: productId } }))) {
      throw new NotFoundException('محصول پیدا نشد.');
    }
  }

  async queueUploaded(
    productId: string,
    videoId: string,
    srcKey: string,
  ): Promise<ProductVideoEntity> {
    let result: { saved: ProductVideoEntity; obsolete: ProductVideoEntity[] };
    try {
      result = await this.dataSource.transaction(async (manager) => {
        const product = await manager.getRepository(ProductEntity).findOne({
          where: { id: productId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!product) throw new NotFoundException('محصول پیدا نشد.');

        const repo = manager.getRepository(ProductVideoEntity);
        const obsolete = await repo.find({ where: { productId } });
        if (obsolete.length) await repo.softDelete(obsolete.map((row) => row.id));
        const row = repo.create({
          id: videoId,
          productId,
          status: 'queued',
          srcKey,
          sortOrder: 2,
        });
        const saved = await repo.save(row);
        await this.enqueue(saved, manager);
        return { saved, obsolete };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('برای این محصول هم‌زمان ویدیوی دیگری ثبت شده است.');
      }
      throw error;
    }
    await this.cleanupObsolete(result.obsolete);
    return result.saved;
  }

  async getAdmin(productId: string): Promise<Record<string, unknown> | null> {
    const row = await this.current(productId);
    if (!row) return null;
    return {
      id: row.id,
      product_id: row.productId,
      status: row.status,
      error_code: row.errorCode,
      duration_sec: row.durationSec,
      width: row.width,
      height: row.height,
      bytes_out: row.bytesOut,
      mp4_720: row.mp4720Key ? this.storage.buildPublicUrl(row.mp4720Key) : null,
      mp4_480: row.mp4480Key ? this.storage.buildPublicUrl(row.mp4480Key) : null,
      webm_720: row.webm720Key ? this.storage.buildPublicUrl(row.webm720Key) : null,
      poster_candidates: (row.posterCandidates ?? []).map((key) => this.storage.buildPublicUrl(key)),
      poster: row.posterKey ? this.storage.buildPublicUrl(row.posterKey) : null,
      sort_order: gallerySortOrder(row.sortOrder),
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  async getPublic(
    productId: string,
    channel?: 'RETAIL' | 'WHOLESALE',
  ): Promise<ProductVideoPublicResponse | null> {
    const product = await this.products.findOne({
      where: { id: productId },
      select: ['id', 'status', 'showOnRetail', 'showOnWholesale'],
    });
    if (!product || !isPublicProductRow(product.status)) return null;
    if (channel === 'RETAIL' && product.showOnRetail === false) return null;
    if (channel === 'WHOLESALE' && product.showOnWholesale === false) return null;
    if (!channel && product.showOnRetail === false && product.showOnWholesale === false) return null;
    const row = await this.current(productId);
    // UI-SPEC: poster is mandatory; a video without one is not published.
    if (!row || row.status !== 'ready' || !row.posterKey) return null;
    return {
      mp4_720: row.mp4720Key ? this.storage.buildPublicUrl(row.mp4720Key) : null,
      mp4_480: row.mp4480Key ? this.storage.buildPublicUrl(row.mp4480Key) : null,
      webm_720: row.webm720Key ? this.storage.buildPublicUrl(row.webm720Key) : null,
      poster: this.storage.buildPublicUrl(row.posterKey),
      duration_sec: row.durationSec,
      width: row.width,
      height: row.height,
      sort_order: gallerySortOrder(row.sortOrder),
      upload_date: isoOrNull(row.createdAt),
    };
  }

  async setOrder(productId: string, body: { sort_order?: unknown }): Promise<{ sort_order: number }> {
    const value = body?.sort_order;
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < VIDEO_MIN_SORT_ORDER ||
      value > VIDEO_MAX_SORT_ORDER
    ) {
      throw new BadRequestException('جایگاه ویدیو باید عدد صحیح ۲ یا بیشتر باشد؛ جایگاه اول همیشه تصویر است.');
    }
    const row = await this.current(productId);
    if (!row) throw new NotFoundException('ویدیوی محصول پیدا نشد.');
    await this.videos.update(row.id, { sortOrder: value });
    return { sort_order: value };
  }

  async remove(productId: string): Promise<{ deleted: boolean }> {
    const row = await this.current(productId);
    if (!row) return { deleted: false };
    await Promise.all([
      this.storage.removePrivateVideoKeys([row.srcKey]),
      this.storage.removePublicKeys([
        row.mp4720Key,
        row.mp4480Key,
        row.webm720Key,
        row.posterKey,
        ...(row.posterCandidates ?? []),
      ]),
    ]);
    await this.videos.softDelete(row.id);
    return { deleted: true };
  }

  async retry(productId: string): Promise<Record<string, unknown>> {
    const row = await this.current(productId);
    if (!row) throw new NotFoundException('ویدیوی محصول پیدا نشد.');
    if (row.status !== 'failed') {
      throw new ConflictException('فقط ویدیوی ناموفق قابل تلاش دوباره است.');
    }
    if (!row.srcKey || !(await this.storage.privateVideoExists(row.srcKey))) {
      throw new ConflictException('فایل اصلی ویدیو موجود نیست. دوباره آپلود کنید.');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ProductVideoEntity).update(row.id, {
        status: 'queued',
        errorCode: null,
      });
      row.status = 'queued';
      row.errorCode = null;
      await this.enqueue(row, manager);
    });
    return { id: row.id, product_id: row.productId, status: row.status, error_code: null };
  }

  async selectPoster(
    productId: string,
    body: { key?: unknown; url?: unknown },
  ): Promise<{ poster: string }> {
    const row = await this.current(productId);
    if (!row) throw new NotFoundException('ویدیوی محصول پیدا نشد.');
    const hasKey = typeof body?.key === 'string' && body.key.length > 0;
    const hasUrl = typeof body?.url === 'string' && body.url.length > 0;
    if (hasKey === hasUrl) {
      throw new BadRequestException('فقط یکی از key یا url را ارسال کنید.');
    }
    let key: string;
    if (hasKey) {
      const requested = body.key as string;
      key = this.sanitizeCandidateKey(
        this.storage.extractOwnedPublicKey(requested) ?? requested,
        productId,
        row.id,
      );
      if (!(row.posterCandidates ?? []).includes(key)) {
        throw new BadRequestException('پوستر انتخاب‌شده در پیشنهادهای این ویدیو نیست.');
      }
    } else {
      const owned = this.storage.extractOwnedPublicKey(body.url as string);
      if (!owned) throw new BadRequestException('آدرس پوستر متعلق به رسانه‌های سایت نیست.');
      if (owned.startsWith('videos/')) {
        key = this.sanitizeCandidateKey(owned, productId, row.id);
        if (!(row.posterCandidates ?? []).includes(key)) {
          throw new BadRequestException('پوستر انتخاب‌شده در پیشنهادهای این ویدیو نیست.');
        }
      } else {
        const imageKey = sanitizeObjectKey(owned);
        if (!imageKey) throw new BadRequestException('آدرس پوستر متعلق به رسانه‌های سایت نیست.');
        key = imageKey;
      }
    }
    await this.videos.update(row.id, { posterKey: key });
    return { poster: this.storage.buildPublicUrl(key) };
  }

  private current(productId: string): Promise<ProductVideoEntity | null> {
    return this.videos.findOne({
      where: { productId },
      order: { createdAt: 'DESC' },
    });
  }

  private async enqueue(row: ProductVideoEntity, manager: EntityManager): Promise<void> {
    const payload: ProductVideoTranscodePayload = {
      videoId: row.id,
      productId: row.productId as string,
    };
    await this.outbox.enqueue(
      {
        operationId: `product-video:${row.id}:transcode:${randomUUID()}`,
        eventType: OUTBOX_EVENT_TYPES.PRODUCT_VIDEO_TRANSCODE,
        aggregateType: 'PRODUCT_VIDEO',
        aggregateId: row.id,
        payload: { ...payload },
      },
      manager,
    );
  }

  private sanitizeCandidateKey(raw: string, productId: string, videoId: string): string {
    const prefix = `videos/${productId}/${videoId}/`;
    if (
      raw !== raw.trim() ||
      !raw.startsWith(prefix) ||
      raw.includes('..') ||
      raw.includes('\\') ||
      raw.includes('\0') ||
      !/^videos\/[A-Za-z0-9._/-]+$/.test(raw)
    ) {
      throw new BadRequestException('کلید پوستر معتبر نیست.');
    }
    return raw;
  }

  private async cleanupObsolete(rows: ProductVideoEntity[]): Promise<void> {
    for (const row of rows) {
      try {
        await Promise.all([
          this.storage.removePrivateVideoKeys([row.srcKey]),
          this.storage.removePublicKeys([
            row.mp4720Key,
            row.mp4480Key,
            row.webm720Key,
            row.posterKey,
            ...(row.posterCandidates ?? []),
          ]),
        ]);
      } catch (error) {
        this.logger.warn(
          `Old product video cleanup failed (${row.id}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const value = error as { code?: unknown; driverError?: { code?: unknown } };
    return String(value.code ?? value.driverError?.code ?? '') === '23505';
  }
}
