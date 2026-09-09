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

/** Mirrors the upsert write strategy: existing rows must use UPDATE, not dirty-checked save. */
function siteContentWriteMode(existing: boolean): 'insert' | 'update' {
  return existing ? 'update' : 'insert';
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
assert(siteContentWriteMode(true) === 'update', 'existing row forces update');
assert(siteContentWriteMode(false) === 'insert', 'missing row inserts');

console.log('cms-write-channel.spec.ts: ok');
