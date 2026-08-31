/**
 * npx ts-node --transpile-only src/modules/omnichannel/media-registry.spec.ts
 */
import { isMissingRelationError, mediaAssetDeleteMatch, mediaAssetRow } from './media-registry';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const row = mediaAssetRow({
  publicUrl: ' https://cdn.example/products/a.jpg ',
  storageKey: 'products/a.jpg',
  altText: 'مانتو کرم',
});
assert(row.publicUrl === 'https://cdn.example/products/a.jpg', 'url trimmed');
assert(row.altText === 'مانتو کرم', 'alt kept');
assert(row.ownerType === 'UPLOAD', 'default owner');
assert(isMissingRelationError({ code: '42P01' }) === true, 'missing table');
assert(isMissingRelationError(new Error('AccessDenied')) === false, 'other errors');

{
  const match = mediaAssetDeleteMatch(
    [' https://cdn.example/products/a.jpg ', '', 'https://cdn.example/products/a.jpg'],
    ['products/a.jpg', 'products/a.jpg', ''],
  );
  assert(match.urls.length === 1 && match.keys.length === 1, 'delete match dedupes');
}

console.log('media-registry.spec.ts: ok');
