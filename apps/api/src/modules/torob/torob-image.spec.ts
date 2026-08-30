import { isPublishableImageUrl } from './torob-image';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isPublishableImageUrl('').ok === false, 'empty');
assert(isPublishableImageUrl('/media/x.jpg').ok === false, 'relative');
assert(isPublishableImageUrl('http://cdn.example/x.jpg').reason === 'image_not_https', 'http');
assert(isPublishableImageUrl('https://cdn.example/thumb/x.jpg').reason === 'image_thumbnail', 'thumb');
assert(isPublishableImageUrl('https://cdn.example/x.jpg', { width: 120, height: 120 }).reason === 'image_too_small', 'small');
assert(isPublishableImageUrl('https://cdn.example/products/coat.jpg').ok === true, 'ok');

console.log('torob-image.spec ok');
