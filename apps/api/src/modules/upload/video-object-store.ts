import { createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import { Transform, type Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isMissingObjectError } from './storage-delete';

/** Minimal object-store surface the video worker needs (file in, file out, delete). */
export interface VideoObjectStorePort {
  /** Public product media bucket (same as StorageService, default `taranom-products`). */
  readonly publicBucket: string;
  downloadToFile(bucket: string, key: string, filePath: string, maxBytes: number): Promise<number>;
  putFile(bucket: string, key: string, filePath: string, contentType: string): Promise<number>;
  /** Missing objects are not an error. */
  remove(bucket: string, key: string): Promise<void>;
}

/**
 * StorageService keeps its MinIO client private, so the worker builds its own
 * client from the same env vars. Streams to/from disk; never buffers a video in RAM.
 */
@Injectable()
export class VideoObjectStore implements VideoObjectStorePort {
  readonly publicBucket: string;
  private readonly client: any;

  constructor(config: ConfigService) {
    this.publicBucket = config.get('MINIO_BUCKET', 'taranom-products');
    const Minio = require('minio');
    this.client = new Minio.Client({
      endPoint: config.get('MINIO_ENDPOINT', 'localhost'),
      port: Number(config.get('MINIO_PORT', 9000)),
      useSSL: config.get('MINIO_USE_SSL', 'false') === 'true',
      accessKey: config.get('MINIO_USER', 'taranom_minio'),
      secretKey: config.get('MINIO_PASS', ''),
    });
  }

  async downloadToFile(bucket: string, key: string, filePath: string, maxBytes: number): Promise<number> {
    const source: Readable = await this.client.getObject(bucket, key);
    let total = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        total += chunk.length;
        if (total > maxBytes) cb(new Error('source video exceeds size limit'));
        else cb(null, chunk);
      },
    });
    await pipeline(source, limiter, createWriteStream(filePath, { flags: 'wx', mode: 0o600 }));
    return total;
  }

  async putFile(bucket: string, key: string, filePath: string, contentType: string): Promise<number> {
    const { size } = await stat(filePath);
    await this.client.fPutObject(bucket, key, filePath, { 'Content-Type': contentType });
    return size;
  }

  async remove(bucket: string, key: string): Promise<void> {
    try {
      await this.client.removeObject(bucket, key);
    } catch (err) {
      if (isMissingObjectError(err)) return;
      throw err;
    }
  }
}
