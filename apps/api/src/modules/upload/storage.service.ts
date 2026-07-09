import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

import { processProductImage } from './image-processor';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: any;
  private bucket: string;
  private endpoint: string;
  private port: number;
  private useSSL: boolean;
  ready = false;

  constructor(private config: ConfigService) {
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
    if (mediaMatch) return mediaMatch[1];
    const bucketPrefix = `/${this.bucket}/`;
    const bucketIdx = url.indexOf(bucketPrefix);
    if (bucketIdx !== -1) return url.slice(bucketIdx + bucketPrefix.length);
    const productsIdx = url.indexOf('/products/');
    if (productsIdx !== -1) return url.slice(productsIdx + 1);
    return null;
  }

  async uploadBuffer(buffer: Buffer, mimetype: string, extension: string, keyPrefix = 'products'): Promise<{ url: string; key: string }> {
    const processed = await processProductImage(buffer, mimetype);
    const key = `${keyPrefix}/${Date.now()}-${Math.random().toString(16).slice(2)}.${processed.extension}`;
    const stream = Readable.from(processed.buffer);
    await this.minioClient.putObject(this.bucket, key, stream, processed.buffer.length, {
      'Content-Type': processed.mimetype,
    });
    return { url: this.buildPublicUrl(key), key };
  }

  async deleteByUrls(urls: string[]): Promise<void> {
    if (!this.ready || !urls?.length) return;
    const keys = urls.map((u) => this.extractKeyFromUrl(u)).filter(Boolean) as string[];
    await Promise.allSettled(
      keys.map((key) => this.minioClient.removeObject(this.bucket, key)),
    );
  }
}
