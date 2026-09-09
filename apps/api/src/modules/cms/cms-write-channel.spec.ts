/**
 * npx ts-node --transpile-only src/modules/cms/cms-write-channel.spec.ts
 *
 * Mirrors CmsService.requireWriteChannel / normalizeChannel rules without Nest DI.
 */
function requireWriteChannel(channel?: string): 'RETAIL' | 'WHOLESALE' {
  const c = String(channel || '').trim().toUpperCase();
  if (c === 'RETAIL' || c === 'WHOLESALE') return c;
  throw new Error('channel-required');
}

function normalizeChannel(channel?: string): string {
  const c = String(channel || 'WHOLESALE').toUpperCase();
  return c === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(requireWriteChannel('RETAIL') === 'RETAIL', 'retail ok');
assert(requireWriteChannel('wholesale') === 'WHOLESALE', 'wholesale ok');
try {
  requireWriteChannel(undefined);
  throw new Error('should reject missing');
} catch (e: unknown) {
  assert(e instanceof Error && e.message === 'channel-required', 'missing rejected');
}
try {
  requireWriteChannel('BOTIQUE');
  throw new Error('should reject junk');
} catch (e: unknown) {
  assert(e instanceof Error && e.message === 'channel-required', 'junk rejected');
}

// Reads may still default; writes must not.
assert(normalizeChannel(undefined) === 'WHOLESALE', 'read default wholesale');
assert(normalizeChannel('RETAIL') === 'RETAIL', 'read retail');

console.log('cms-write-channel.spec.ts: ok');
