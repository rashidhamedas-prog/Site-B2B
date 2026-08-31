/**
 * npx ts-node --transpile-only src/modules/omnichannel/media-references.spec.ts
 */
import { assertUrlsUnreferenced, canDeleteMediaAsset, countMediaReferences } from './media-references';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const url = 'https://cdn.example/a.jpg';
assert(countMediaReferences(url, [{ images: [url] }, { html: `<img src="${url}">` }]) === 2, 'two refs');
assert(canDeleteMediaAsset(2) === false, 'referenced blocked');
assert(canDeleteMediaAsset(0) === true, 'unreferenced ok');
assert(countMediaReferences(url, [{ images: ['https://cdn.example/b.jpg'] }]) === 0, 'other url ignored');
{
  let blocked = false;
  try {
    assertUrlsUnreferenced([url], [{ images: [url] }]);
  } catch {
    blocked = true;
  }
  assert(blocked, 'assert blocks referenced url');
  assertUrlsUnreferenced([url], [{ images: [] }]);
}

console.log('media-references.spec.ts: ok');
