/**
 * npx ts-node --transpile-only src/modules/omnichannel/provider-message-ids.spec.ts
 */
import {
  assertFullAlbumDelete,
  baleDeleteWindowExpired,
  joinProviderMessageIds,
  parseProviderMessageIds,
} from './provider-message-ids';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(JSON.stringify(parseProviderMessageIds('1, 2,,2,3')) === JSON.stringify(['1', '2', '3']), 'parse unique trim');
assert(JSON.stringify(parseProviderMessageIds(null)) === '[]', 'null → []');
assert(joinProviderMessageIds(['3', '1', '1']) === '3,1', 'join preserves first-seen order');

{
  const ok = assertFullAlbumDelete(['a', 'b', 'c'], ['c', 'a', 'b']);
  assert(ok.ok === true, 'full album any order ok');
}
{
  const partial = assertFullAlbumDelete(['a', 'b', 'c'], ['a', 'b']);
  assert(partial.ok === false, 'partial album rejected');
  assert(String((partial as { error: string }).error).includes('جزئی'), 'Persian partial message');
}
{
  const bad = assertFullAlbumDelete(['a'], ['z']);
  assert(bad.ok === false, 'unknown id rejected');
}

{
  const sent = new Date(Date.now() - 49 * 60 * 60 * 1000);
  assert(baleDeleteWindowExpired(sent) === true, '49h → expired');
  assert(baleDeleteWindowExpired(new Date()) === false, 'now → ok');
}

console.log('provider-message-ids.spec.ts: ok');
