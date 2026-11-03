import { BadRequestException } from '@nestjs/common';
import { ProductVideoController } from './product-video.controller';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  let publicCalls = 0;
  const controller = new ProductVideoController({
    getAdmin: async () => ({ status: 'queued' }),
    getPublic: async () => {
      publicCalls += 1;
      return { mp4_720: 'video.mp4' };
    },
    remove: async () => ({ deleted: true }),
    retry: async () => ({ status: 'queued' }),
    selectPoster: async () => ({ poster: 'poster.jpg' }),
  } as any);

  let adminInvalid = false;
  try {
    await controller.getAdmin('not-a-uuid');
  } catch (error) {
    adminInvalid =
      error instanceof BadRequestException &&
      (error.getResponse() as any)?.message === 'شناسه محصول معتبر نیست.';
  }
  assert(adminInvalid, 'admin route rejects invalid UUID with Persian 400');

  const publicResult = await controller.getPublic('not-a-uuid');
  assert(publicResult === null, 'public invalid UUID returns null');
  assert(publicCalls === 0, 'public invalid UUID performs no service query');

  console.log('product-video.controller.spec.ts: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
