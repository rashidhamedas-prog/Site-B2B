/**
 * npx ts-node --transpile-only src/modules/upload/storage-delete.spec.ts
 */
import { isMissingObjectError, sanitizeObjectKey } from './storage-delete';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isMissingObjectError(new Error('NoSuchKey: object missing')) === true, 'missing key');
assert(isMissingObjectError({ code: 'NotFound', message: '404' }) === true, 'not found code');
assert(isMissingObjectError(new Error('AccessDenied')) === false, 'real failure');
assert(isMissingObjectError(new Error('ECONNRESET')) === false, 'network failure');

assert(sanitizeObjectKey('products/a.jpg') === 'products/a.jpg', 'products prefix ok');
assert(sanitizeObjectKey('blog/cover.webp') === 'blog/cover.webp', 'blog prefix ok');
assert(sanitizeObjectKey('products/../other/x') === null, 'dotdot rejected');
assert(sanitizeObjectKey('products/%2e%2e/x') === null, 'encoded dotdot rejected');
assert(sanitizeObjectKey('../../other-prefix/object') === null, 'traversal rejected');
assert(sanitizeObjectKey('tmp/secret.bin') === null, 'prefix denylist');
assert(sanitizeObjectKey('products/foo\\bar') === null, 'backslash rejected');

console.log('storage-delete.spec.ts: ok');
