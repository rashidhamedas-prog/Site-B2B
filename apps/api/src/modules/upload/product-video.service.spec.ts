import { ConflictException } from '@nestjs/common';
import { ProductVideoService } from './product-video.service';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  let current: any = {
    id: 'video-1',
    productId: 'product-1',
    status: 'failed',
    srcKey: 'videos/product-1/video-1/source.mp4',
    mp4720Key: 'videos/product-1/video-1/720.mp4',
    mp4480Key: 'videos/product-1/video-1/480.mp4',
    webm720Key: 'videos/product-1/video-1/720.webm',
    posterKey: 'videos/product-1/video-1/poster.jpg',
    posterCandidates: [
      'videos/product-1/video-1/poster-1.jpg',
      'videos/product-1/video-1/poster-2.jpg',
    ],
    errorCode: 'TRANSCODE_FAILED',
    sortOrder: 2,
  };
  const removedPrivate: string[][] = [];
  const removedPublic: string[][] = [];
  const enqueued: any[] = [];
  const saved: any[] = [];
  const updates: any[] = [];
  let privateExists = true;
  let visibleProduct: any = {
    id: 'product-1',
    status: 'ACTIVE',
    showOnRetail: true,
    showOnWholesale: true,
  };
  const repo: any = {
    findOne: async () => current,
    softDelete: async () => undefined,
    update: async (_id: string, patch: any) => updates.push(patch),
  };
  const managerRepo: any = {
    find: async () => [],
    create: (value: any) => value,
    save: async (value: any) => {
      saved.push(value);
      return value;
    },
    update: async (_id: string, patch: any) => updates.push(patch),
    softDelete: async () => undefined,
  };
  const service = new ProductVideoService(
    repo,
    { exist: async () => true, findOne: async () => visibleProduct } as any,
    {
      transaction: async (fn: any) => fn({
        getRepository: (entity: any) =>
          entity.name === 'ProductEntity'
            ? { findOne: async () => ({ id: 'product-1' }) }
            : managerRepo,
      }),
    } as any,
    {
      buildPublicUrl: (key: string) => `https://media.test/${key}`,
      removePrivateVideoKeys: async (keys: string[]) => removedPrivate.push(keys),
      removePublicKeys: async (keys: string[]) => removedPublic.push(keys),
      privateVideoExists: async () => privateExists,
      extractOwnedPublicKey: (url: string) =>
        url.startsWith('https://media.test/') ? url.slice('https://media.test/'.length) : null,
    } as any,
    { enqueue: async (event: any) => enqueued.push(event) } as any,
  );

  const queued = await service.queueUploaded('product-1', 'video-2', 'videos/source.mp4');
  assert(queued.status === 'queued' && queued.sortOrder === 2, 'creates queued row in slot 2');
  assert(enqueued.length === 1, 'enqueues transcode event');
  assert(
    JSON.stringify(enqueued[0].payload) === JSON.stringify({ videoId: 'video-2', productId: 'product-1' }),
    'outbox payload contains IDs only',
  );

  await service.remove('product-1');
  assert(removedPrivate[0]?.includes(current.srcKey), 'delete removes raw source');
  assert(removedPublic[0]?.length === 6, 'delete removes outputs, poster, and candidates');

  current.status = 'failed';
  const retried = await service.retry('product-1');
  assert(retried.status === 'queued', 'failed video retries to queued');
  assert(Number(enqueued.length) === 2, 'retry re-enqueues event');

  current.status = 'ready';
  let conflict = false;
  try {
    await service.retry('product-1');
  } catch (error) {
    conflict = error instanceof ConflictException;
  }
  assert(conflict, 'ready video cannot retry');

  current.status = 'failed';
  privateExists = false;
  let missingSourceConflict = false;
  try {
    await service.retry('product-1');
  } catch (error) {
    missingSourceConflict = error instanceof ConflictException;
  }
  assert(missingSourceConflict, 'retry requires the raw source object');
  privateExists = true;

  const candidate = await service.selectPoster('product-1', {
    key: 'videos/product-1/video-1/poster-2.jpg',
  });
  assert(candidate.poster.endsWith('poster-2.jpg'), 'accepts own candidate');
  const uploaded = await service.selectPoster('product-1', {
    url: 'https://media.test/products/uploaded.webp',
  });
  assert(uploaded.poster.endsWith('products/uploaded.webp'), 'accepts own uploaded image URL');

  let foreignRejected = false;
  try {
    await service.selectPoster('product-1', { url: 'https://evil.test/media/poster.jpg' });
  } catch {
    foreignRejected = true;
  }
  assert(foreignRejected, 'rejects foreign poster URL');

  let traversalRejected = false;
  try {
    await service.selectPoster('product-1', {
      key: 'videos/product-1/video-1/../poster-2.jpg',
    });
  } catch {
    traversalRejected = true;
  }
  assert(traversalRejected, 'rejects unsanitized candidate key');

  current.status = 'ready';
  visibleProduct = { ...visibleProduct, status: 'DRAFT' };
  assert((await service.getPublic('product-1')) === null, 'public video hides non-public product');
  visibleProduct = { ...visibleProduct, status: 'ACTIVE', showOnRetail: false };
  assert((await service.getPublic('product-1', 'RETAIL')) === null, 'public video follows retail visibility');
  assert(saved.length === 1 && updates.length >= 3, 'persists queue, retry, and poster updates');

  {
    const live: any[] = [];
    let lockTail = Promise.resolve();
    const transaction = async (fn: any) => {
      let release!: () => void;
      const mine = new Promise<void>((resolve) => { release = resolve; });
      const previous = lockTail;
      lockTail = lockTail.then(() => mine);
      await previous;
      try {
        const videoRepo = {
          find: async () => live.filter((row) => !row.deletedAt),
          softDelete: async () => {
            live.filter((row) => !row.deletedAt).forEach((row) => { row.deletedAt = new Date(); });
          },
          create: (value: any) => ({ ...value }),
          save: async (value: any) => {
            live.push(value);
            return value;
          },
        };
        return await fn({
          getRepository: (entity: any) =>
            entity.name === 'ProductEntity'
              ? { findOne: async () => ({ id: 'product-1' }) }
              : videoRepo,
        });
      } finally {
        release();
      }
    };
    const concurrent = new ProductVideoService(
      repo,
      { exist: async () => true } as any,
      { transaction } as any,
      {
        removePrivateVideoKeys: async () => undefined,
        removePublicKeys: async () => undefined,
      } as any,
      { enqueue: async () => undefined } as any,
    );
    await Promise.all([
      concurrent.queueUploaded('product-1', 'video-a', 'videos/a.mp4'),
      concurrent.queueUploaded('product-1', 'video-b', 'videos/b.mp4'),
    ]);
    assert(live.filter((row) => !row.deletedAt).length === 1, 'overlapping uploads leave one live row');
    assert(live.find((row) => row.id === 'video-b' && !row.deletedAt), 'latest locked upload remains live');
  }

  {
    const conflictService = new ProductVideoService(
      repo,
      { exist: async () => true } as any,
      { transaction: async () => { throw Object.assign(new Error('duplicate'), { code: '23505' }); } } as any,
      {} as any,
      {} as any,
    );
    let duplicateConflict = false;
    try {
      await conflictService.queueUploaded('product-1', 'video-x', 'videos/x.mp4');
    } catch (error) {
      duplicateConflict =
        error instanceof ConflictException &&
        (error.getResponse() as any)?.message === 'برای این محصول هم‌زمان ویدیوی دیگری ثبت شده است.';
    }
    assert(duplicateConflict, '23505 maps to Persian 409');
  }
  console.log('product-video.service.spec.ts: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
