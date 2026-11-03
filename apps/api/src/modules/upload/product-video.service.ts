import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ProductEntity } from '../product/entities/product.entity';
import { ProductVideoEntity } from '../product/entities/product-video.entity';
import { OUTBOX_EVENT_TYPES } from '../omnichannel/omnichannel.constants';
import { OutboxService } from '../omnichannel/services/outbox.service';
import { StorageService } from './storage.service';
import type { ProductVideoTranscodePayload } from './video-policy';

export interface ProductVideoPublicResponse {
  mp4_720: string | null;
  mp4_480: string | null;
  webm_720: string | null;
  poster: string | null;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
}

@Injectable()
export class ProductVideoService {
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
    await this.assertProductExists(productId);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ProductVideoEntity);
      const row = repo.create({
        id: videoId,
        productId,
        status: 'queued',
        srcKey,
        sortOrder: 2,
      });
      const saved = await repo.save(row);
      await this.enqueue(saved, manager);
      return saved;
    });
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
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  async getPublic(productId: string): Promise<ProductVideoPublicResponse | null> {
    const row = await this.current(productId);
    if (!row || row.status !== 'ready') return null;
    return {
      mp4_720: row.mp4720Key ? this.storage.buildPublicUrl(row.mp4720Key) : null,
      mp4_480: row.mp4480Key ? this.storage.buildPublicUrl(row.mp4480Key) : null,
      webm_720: row.webm720Key ? this.storage.buildPublicUrl(row.webm720Key) : null,
      poster: row.posterKey ? this.storage.buildPublicUrl(row.posterKey) : null,
      duration_sec: row.durationSec,
      width: row.width,
      height: row.height,
    };
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
      key = this.storage.extractOwnedPublicKey(requested) ?? requested;
      if (!(row.posterCandidates ?? []).includes(key)) {
        throw new BadRequestException('پوستر انتخاب‌شده در پیشنهادهای این ویدیو نیست.');
      }
    } else {
      const owned = this.storage.extractOwnedPublicKey(body.url as string);
      if (!owned) throw new BadRequestException('آدرس پوستر متعلق به رسانه‌های سایت نیست.');
      key = owned;
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
}
