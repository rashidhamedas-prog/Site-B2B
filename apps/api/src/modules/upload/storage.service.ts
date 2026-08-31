import { BadRequestException, ConflictException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Readable } from 'stream';

import { processProductImage } from './image-processor';
import { isMissingObjectError, sanitizeObjectKey } from './storage-delete';
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
    const mediaMatch = url.match(/\/media\/(.+)$/);
    if (mediaMatch) return sanitizeObjectKey(mediaMatch[1]);
    const bucketPrefix = `/${this.bucket}/`;
    const bucketIdx = url.indexOf(bucketPrefix);
    if (bucketIdx !== -1) return sanitizeObjectKey(url.slice(bucketIdx + bucketPrefix.length));
    const productsIdx = url.indexOf('/products/');
    if (productsIdx !== -1) return sanitizeObjectKey(url.slice(productsIdx + 1));
    return null;
  }

  async uploadBuffer(buffer: Buffer, mimetype: string, extension: string, keyPrefix = 'products'): Promise<{ url: string; key: string }> {
    const processed = await processProductImage(buffer, mimetype);
    const key = `${keyPrefix}/${Date.now()}-${Math.random().toString(16).slice(2)}.${processed.extension}`;
    const stream = Readable.from(processed.buffer);
    await this.minioClient.putObject(this.bucket, key, stream, processed.buffer.length, {
      'Content-Type': processed.mimetype,
    });
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
    const failures: string[] = [];
    await Promise.all(
      keys.map(async (key) => {
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
