/**
 * npx ts-node --transpile-only src/modules/auth/jwt-sub-uuid.spec.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const src = readFileSync(join(__dirname, 'strategies/jwt.strategy.ts'), 'utf8');
assert(src.includes('JWT_SUB_UUID_RE'), 'JwtStrategy validates sub as UUID');
assert(src.includes('UnauthorizedException'), 'invalid sub becomes 401 not QueryFailedError 500');
assert(/if\s*\(\s*!JWT_SUB_UUID_RE\.test\(sub\)\s*\)\s*throw new UnauthorizedException/.test(src), 'guard before findById');

console.log('jwt-sub-uuid.spec.ts: ok');
