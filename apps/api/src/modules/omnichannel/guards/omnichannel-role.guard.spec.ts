/**
 * npx ts-node --transpile-only src/modules/omnichannel/guards/omnichannel-role.guard.spec.ts
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  OMNICHANNEL_MIN_ROLE_KEY,
  OMNICHANNEL_OWNER_WHEN_LIVE_KEY,
  OMNICHANNEL_REQUIRES_GO_REF_KEY,
} from '../decorators/omnichannel-role.decorator';
import { GO_REF_REQUIRED_MESSAGE } from '../omnichannel-rbac';
import { OmnichannelRoleGuard } from './omnichannel-role.guard';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const prevRbac = process.env.OMNICHANNEL_RBAC_ENABLED;

function makeContext(body: Record<string, unknown>, role: string) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        body,
        omnichannelActor: { id: 'u1', role: 'ADMIN', omnichannelRole: role },
      }),
    }),
  };
}

function makeGuard(meta: {
  min?: string;
  goRef?: boolean;
  ownerWhenLive?: boolean;
}) {
  const reflector = {
    getAllAndOverride(key: string) {
      if (key === OMNICHANNEL_MIN_ROLE_KEY) return meta.min;
      if (key === OMNICHANNEL_REQUIRES_GO_REF_KEY) return meta.goRef;
      if (key === OMNICHANNEL_OWNER_WHEN_LIVE_KEY) return meta.ownerWhenLive;
      return undefined;
    },
  } as unknown as Reflector;
  return new OmnichannelRoleGuard(reflector);
}

delete process.env.OMNICHANNEL_RBAC_ENABLED;
assert(
  makeGuard({ min: 'OWNER', goRef: true }).canActivate(
    makeContext({}, 'VIEWER') as never,
  ) === true,
  'RBAC off → allow',
);

process.env.OMNICHANNEL_RBAC_ENABLED = 'true';

try {
  makeGuard({ min: 'PUBLISHER' }).canActivate(makeContext({}, 'VIEWER') as never);
  throw new Error('viewer should 403 on publisher route');
} catch (err) {
  assert(err instanceof ForbiddenException, 'VIEWER → ForbiddenException');
}

assert(
  makeGuard({ min: 'PUBLISHER' }).canActivate(makeContext({}, 'PUBLISHER') as never) === true,
  'PUBLISHER ok on publisher route',
);

assert(
  makeGuard({ min: 'PUBLISHER', ownerWhenLive: true }).canActivate(
    makeContext({ dryRun: true }, 'PUBLISHER') as never,
  ) === true,
  'dryRun requeue → PUBLISHER',
);

try {
  makeGuard({ min: 'PUBLISHER', ownerWhenLive: true }).canActivate(
    makeContext({ dryRun: false }, 'PUBLISHER') as never,
  );
  throw new Error('live requeue publisher should 403');
} catch (err) {
  assert(err instanceof ForbiddenException, 'live requeue PUBLISHER → 403');
}

try {
  makeGuard({ min: 'PUBLISHER', ownerWhenLive: true }).canActivate(
    makeContext({ dryRun: false }, 'OWNER') as never,
  );
  throw new Error('live requeue without goRef should 400');
} catch (err) {
  assert(err instanceof BadRequestException, 'missing goRef → BadRequestException');
  const body = (err as BadRequestException).getResponse();
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  assert(text.includes(GO_REF_REQUIRED_MESSAGE) || text.includes('goRef'), 'Persian goRef message');
}

assert(
  makeGuard({ min: 'PUBLISHER', ownerWhenLive: true }).canActivate(
    makeContext({ dryRun: false, goRef: 'GO حامد 2026-10-28' }, 'OWNER') as never,
  ) === true,
  'Owner + goRef live requeue ok',
);

if (prevRbac === undefined) delete process.env.OMNICHANNEL_RBAC_ENABLED;
else process.env.OMNICHANNEL_RBAC_ENABLED = prevRbac;

console.log('omnichannel-role.guard.spec.ts: ok');
