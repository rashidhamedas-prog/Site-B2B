import 'reflect-metadata';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { ProductVideoController } from './product-video.controller';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  let publicCalls = 0;
  const orderCalls: Array<{ id: string; body: any }> = [];
  const controller = new ProductVideoController({
    setOrder: async (id: string, body: any) => {
      orderCalls.push({ id, body });
      return { sort_order: body.sort_order };
    },
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

  let orderInvalid = false;
  try {
    await controller.setOrder('not-a-uuid', { sort_order: 2 });
  } catch (error) {
    orderInvalid = error instanceof BadRequestException;
  }
  assert(orderInvalid, 'order route rejects invalid UUID');
  const productId = '6f1c2a5e-8f9b-4c3d-9a7e-1b2c3d4e5f60';
  const ordered = await controller.setOrder(productId, { sort_order: 3 });
  assert(
    orderCalls.length === 1 && orderCalls[0].id === productId && orderCalls[0].body.sort_order === 3,
    'order route forwards id and body',
  );
  assert((ordered as any).sort_order === 3, 'order route returns service result');

  const proto = ProductVideoController.prototype;
  const orderRoles = Reflect.getMetadata(ROLES_KEY, proto.setOrder);
  assert(Array.isArray(orderRoles) && orderRoles.includes('ADMIN'), 'order route is ADMIN-only');
  const orderGuards = Reflect.getMetadata(GUARDS_METADATA, proto.setOrder);
  assert(Array.isArray(orderGuards) && orderGuards.length === 2, 'order route has jwt + roles guards');
  assert(
    Reflect.getMetadata(PATH_METADATA, proto.setOrder) === ':id/video/order' &&
      Reflect.getMetadata(METHOD_METADATA, proto.setOrder) === RequestMethod.PATCH,
    'order route is PATCH :id/video/order',
  );

  console.log('product-video.controller.spec.ts: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
