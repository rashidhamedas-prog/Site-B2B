import { BadRequestException, ConflictException, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Readable } from 'stream';

import { processUploadImage, ProductImageProcessingError, type ImageProcessProfile } from './image-processor';
import {
  CHANNEL_PHOTO_LONG_EDGE,
  CHANNEL_PHOTO_MAX_BYTES,
  prepareChannelJpeg,
} from './channel-image';
import { confirmStoredImage, rejectTruncatedJpeg } from './upload-bytes';
import {
  channelDerivativeKey,
  isMissingObjectError,
  keepOriginalUploads,
  originalUploadKey,
  relatedObjectKeys,
  sanitizeObjectKey,
} from './storage-delete';
import { assertUrlsUnreferenced } from '../omnichannel/media-references';
import { OmnichannelMediaAssetEntity } from '../omnichannel/entities/omnichannel-media-asset.entity';
import { isMissingRelationError, mediaAssetDeleteMatch, mediaAssetRow } from '../omnichannel/media-registry';
import { ProductEntity } from '../product/entities/product.entity';
import { CmsPageEntity } from '../cms/entities/cms-page.entity';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: any;
  private bucket: string;
  private endpoint: string;
  private port: number;
  private useSSL: boolean;
  ready = false;

  constructor(
    private config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.bucket = config.get('MINIO_BUCKET', 'taranom-products');
    this.endpoint = config.get('MINIO_ENDPOINT', 'localhost');
    this.port = config.get<number>('MINIO_PORT', 9000);
    this.useSSL = config.get('MINIO_USE_SSL', 'false') === 'true';

    try {
      const Minio = require('minio');
      this.minioClient = new Minio.Client({
        endPoint: this.endpoint,
        port: this.port,
        useSSL: this.useSSL,
        accessKey: config.get('MINIO_USER', 'taranom_minio'),
        secretKey: config.get('MINIO_PASS', ''),
      });
      this.ready = true;
    } catch {
      this.ready = false;
    }
  }

  async onModuleInit() {
    if (!this.ready) return;
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket);
        this.logger.log(`Bucket "${this.bucket}" created`);
      }
    } catch (err) {
      this.logger.warn(`MinIO bucket check failed: ${err}`);
    }
  }

  buildPublicUrl(key: string): string {
    const publicUrl = this.config.get('MINIO_PUBLIC_URL', '');
    if (publicUrl) {
      return `${publicUrl.replace(/\/$/, '')}/${key}`;
    }
    const protocol = this.useSSL ? 'https' : 'http';
    return `${protocol}://${this.endpoint}:${this.port}/${this.bucket}/${key}`;
  }

  extractKeyFromUrl(url: string): string | null {
    if (!url) return null;
    // Prefer indexOf over /\/media\/(.+)$/ — CodeQL flags that regex as ReDoS on
    // attacker-controlled URLs with many "/media/" repetitions.
    const mediaIdx = url.indexOf('/media/');
    if (mediaIdx !== -1) {
      return sanitizeObjectKey(url.slice(mediaIdx + '/media/'.length));
    }
    const bucketPrefix = `/${this.bucket}/`;
    const bucketIdx = url.indexOf(bucketPrefix);
    if (bucketIdx !== -1) return sanitizeObjectKey(url.slice(bucketIdx + bucketPrefix.length));
    const productsIdx = url.indexOf('/products/');
    if (productsIdx !== -1) return sanitizeObjectKey(url.slice(productsIdx + 1));
    return null;
  }

  async uploadBuffer(
    buffer: Buffer,
    mimetype: string,
    extension: string,
    keyPrefix = 'products',
    profile: ImageProcessProfile = 'product',
  ): Promise<{ url: string; key: string }> {
    // Sharp already fits product shots inside 1200×1600 WebP. Reject a cut JPEG
    // (the historical 5 MiB body, no EOI) before that encode.
    rejectTruncatedJpeg(buffer);
    const processed = await processUploadImage(buffer, mimetype, profile);
    const prefix = profile === 'categoryBanner' ? 'categories' : keyPrefix;
    const key = `${prefix}/${Date.now()}-${Math.random().toString(16).slice(2)}.${processed.extension}`;
    const written: string[] = [];
    const put = async (objectKey: string, body: Buffer, contentType: string) => {
      await this.minioClient.putObject(this.bucket, objectKey, Readable.from(body), body.length, {
        'Content-Type': contentType,
      });
      written.push(objectKey);
    };
    const rollback = async () => {
      for (const objectKey of written) {
        try {
          await this.minioClient.removeObject(this.bucket, objectKey);
        } catch {
          // Integrity / encode error is what the caller needs.
        }
      }
    };
    try {
      await put(key, processed.buffer, processed.mimetype);
      // Read the object we just wrote. Do not use readOwnedImage: that allowlist
      // is products|blog only, and category banners live under categories/.
      const stored = await this.readObjectBytes(key, processed.buffer.length);
      await confirmStoredImage(stored, processed.buffer.length);

      if (profile === 'product' && (prefix === 'products' || prefix === 'blog')) {
        let channel;
        try {
          channel = await prepareChannelJpeg(processed.buffer, {
            maxBytes: CHANNEL_PHOTO_MAX_BYTES,
            longEdge: CHANNEL_PHOTO_LONG_EDGE,
            minQuality: 55,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message === 'photo_too_large') {
            throw new ProductImageProcessingError(new Error('channel jpeg too large'));
          }
          throw new ProductImageProcessingError(err);
        }
        const channelKey = channelDerivativeKey(key);
        if (!channelKey) {
          throw new ProductImageProcessingError(new Error('channel jpeg key invalid'));
        }
        await put(channelKey, channel.bytes, channel.contentType);
      }

      if (keepOriginalUploads() && (prefix === 'products' || prefix === 'blog')) {
        const originalKey = originalUploadKey(key);
        if (originalKey) {
          await put(originalKey, buffer, mimetype || 'application/octet-stream');
        }
      }
    } catch (err) {
      await rollback();
      if (err instanceof ProductImageProcessingError) throw err;
      throw new ProductImageProcessingError(err);
    }
    const url = this.buildPublicUrl(key);
    try {
      await this.dataSource.getRepository(OmnichannelMediaAssetEntity).upsert(
        mediaAssetRow({ publicUrl: url, storageKey: key, ownerType: 'UPLOAD' }),
        ['publicUrl'],
      );
    } catch (err) {
      if (!isMissingRelationError(err)) {
        this.logger.warn(`media registry skip: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { url, key };
  }

  /** Bytes of an object this process just wrote. Stops once the saved image is larger than expected. */
  private async readObjectBytes(key: string, maxBytes: number): Promise<Buffer> {
    const stream: Readable = await this.minioClient.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) {
        stream.destroy?.();
        throw new ProductImageProcessingError(new Error('stored image length mismatch'));
      }
      chunks.push(buf);
    }
    return Buffer.concat(chunks);
  }

  /** Read one already-sanitized product image. Rejects keys outside products/ or blog/. */
  async readOwnedImage(key: string): Promise<Buffer> {
    const safe = sanitizeObjectKey(key);
    if (!safe || !/\.(jpe?g|png|webp|gif)$/i.test(safe)) {
      throw new BadRequestException('آدرس تصویر مجاز نیست');
    }
    if (!this.ready) throw new ServiceUnavailableException('انبار تصویر در دسترس نیست');
    const stream: Readable = await this.minioClient.getObject(this.bucket, safe);
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      for await (const chunk of stream) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buf.length;
        if (total > 8 * 1024 * 1024) {
          throw new BadRequestException('حجم تصویر بیشتر از حد دانلود است');
        }
        chunks.push(buf);
      }
    } catch (err) {
      if (isMissingObjectError(err)) throw err;
      if (err instanceof BadRequestException) throw err;
      throw err;
    }
    return Buffer.concat(chunks);
  }

  async deleteByUrls(urls: string[], opts?: { excludeProductId?: string }): Promise<void> {
    if (!urls?.length) return;
    const products = await this.dataSource.getRepository(ProductEntity).find({
      select: ['id', 'images', 'videoUrl'],
    });
    const pages = await this.dataSource.getRepository(CmsPageEntity).find({
      select: ['id', 'content', 'blocks'],
    });
    const sources = [
      ...products
        .filter((p) => !opts?.excludeProductId || p.id !== opts.excludeProductId)
        .map((p) => ({ images: p.images, videoUrl: p.videoUrl })),
      ...pages.map((page) => ({ html: `${page.content}\n${JSON.stringify(page.blocks || [])}` })),
    ];
    try {
      assertUrlsUnreferenced(urls, sources);
    } catch (err) {
      throw new ConflictException(err instanceof Error ? err.message : 'این فایل هنوز ارجاع دارد');
    }
    if (!this.ready) {
      throw new Error('object storage is not ready');
    }
    const keys = urls.map((u) => {
      const key = this.extractKeyFromUrl(u);
      if (!key) throw new BadRequestException('آدرس فایل نامعتبر است');
      return key;
    });
    const removeKeys = [...new Set(keys.flatMap((key) => relatedObjectKeys(key)))];
    const failures: string[] = [];
    await Promise.all(
      removeKeys.map(async (key) => {
        try {
          await this.minioClient.removeObject(this.bucket, key);
        } catch (err) {
          if (isMissingObjectError(err)) return;
          const msg = err instanceof Error ? err.message : String(err);
          failures.push(`${key}: ${msg}`);
        }
      }),
    );
    if (failures.length) {
      throw new Error(`object storage delete failed: ${failures.join('; ')}`);
    }
    const match = mediaAssetDeleteMatch(urls, keys);
    if (!match.urls.length && !match.keys.length) return;
    try {
      const qb = this.dataSource.getRepository(OmnichannelMediaAssetEntity).createQueryBuilder().delete();
      if (match.urls.length && match.keys.length) {
        qb.where('"publicUrl" IN (:...urls)', { urls: match.urls })
          .orWhere('"storageKey" IN (:...keys)', { keys: match.keys });
      } else if (match.urls.length) {
        qb.where('"publicUrl" IN (:...urls)', { urls: match.urls });
      } else {
        qb.where('"storageKey" IN (:...keys)', { keys: match.keys });
      }
      await qb.execute();
    } catch (err) {
      if (isMissingRelationError(err)) return;
      throw new Error(`media registry delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
