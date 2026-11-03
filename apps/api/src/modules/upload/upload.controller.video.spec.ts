import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { Readable } from 'stream';
import { UploadController } from './upload.controller';
import { VIDEO_ERROR_MESSAGES, VIDEO_MAX_BYTES } from './video-policy';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const mp4Head = Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.alloc(8)]);
const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';

function request(file: any, filename = 'clip.mp4', mimetype = 'video/mp4', productId = PRODUCT_ID) {
  return {
    query: { productId },
    file: async () => ({ filename, mimetype, file }),
  };
}

async function main() {
  const removed: string[][] = [];
  let queued = 0;
  const storage: any = {
    ready: true,
    putPrivateVideo: async (_key: string, body: Readable) => {
      for await (const _chunk of body) {
        // Drain to exercise streaming errors.
      }
    },
    removePrivateVideoKeys: async (keys: string[]) => removed.push(keys),
  };
  const videos: any = {
    assertProductExists: async () => undefined,
    queueUploaded: async (productId: string, id: string) => {
      queued += 1;
      return { id, productId, status: 'queued', sortOrder: 2 };
    },
  };
  const controller = new UploadController(storage, videos);

  let badType = false;
  try {
    await controller.uploadVideo(request(Readable.from([Buffer.from('MZ executable')]), 'renamed.mp4'));
  } catch (error) {
    const body = error instanceof BadRequestException ? error.getResponse() as any : null;
    badType =
      error instanceof BadRequestException &&
      error.getStatus() === 400 &&
      body?.message === VIDEO_ERROR_MESSAGES.BAD_TYPE;
  }
  assert(badType, 'bad magic returns Persian 400');

  let invalidId = false;
  try {
    await controller.uploadVideo(request(Readable.from([mp4Head]), 'clip.mp4', 'video/mp4', 'product-1'));
  } catch (error) {
    const body = error instanceof BadRequestException ? error.getResponse() as any : null;
    invalidId = error instanceof BadRequestException && body?.message === 'شناسه محصول معتبر نیست.';
  }
  assert(invalidId, 'invalid productId returns Persian 400');

  const truncated: any = Readable.from([mp4Head]);
  truncated.truncated = true;
  let tooLarge = false;
  try {
    await controller.uploadVideo(request(truncated));
  } catch (error) {
    tooLarge = error instanceof PayloadTooLargeException && error.getStatus() === 413;
  }
  assert(tooLarge, 'truncated size-limited stream returns 413');
  assert(removed.length === 1, 'size rejection removes partial key');

  const oneMb = Buffer.alloc(1024 * 1024);
  oneMb.write('ftyp', 4, 'ascii');
  const zeroMb = Buffer.alloc(oneMb.length);
  const oversized: any = Readable.from((async function* () {
    yield oneMb;
    const remainingFullChunks = Math.floor(VIDEO_MAX_BYTES / oneMb.length) - 1;
    for (let i = 0; i < remainingFullChunks; i += 1) yield zeroMb;
    yield Buffer.from([0]);
  })());
  let countedTooLarge = false;
  try {
    await controller.uploadVideo(request(oversized));
  } catch (error) {
    countedTooLarge = error instanceof PayloadTooLargeException && error.getStatus() === 413;
  }
  assert(countedTooLarge, 'byte counter rejects VIDEO_MAX_BYTES + 1 without truncated');
  assert(Number(removed.length) === 2, 'counted oversize removes partial key');

  const partial: any = Readable.from((async function* () {
    yield mp4Head;
    throw new Error('client aborted');
  })());
  let aborted = false;
  try {
    await controller.uploadVideo(request(partial));
  } catch (error) {
    aborted = error instanceof Error && error.message === 'client aborted';
  }
  assert(aborted, 'partial stream reports abort');
  assert(Number(removed.length) === 3, 'aborted upload removes partial key');
  assert(Number(queued) === 0, 'rejected and aborted uploads leave no queued row');

  const result = await controller.uploadVideo(request(Readable.from([mp4Head, Buffer.from('body')])));
  assert(result.status === 'queued' && Number(queued) === 1, 'valid upload creates queued row');
  console.log('upload.controller.video.spec.ts: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
