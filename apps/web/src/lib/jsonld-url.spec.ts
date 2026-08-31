import assert from 'node:assert/strict';
import { absoluteJsonLdUrl } from './jsonld-url';

assert.equal(absoluteJsonLdUrl('RETAIL', undefined), undefined);
assert.equal(absoluteJsonLdUrl('RETAIL', '  '), undefined);
assert.equal(
  absoluteJsonLdUrl('RETAIL', '/uploads/sara.jpg'),
  'https://www.poshaktaranom.ir/uploads/sara.jpg',
);
assert.equal(
  absoluteJsonLdUrl('WHOLESALE', '/uploads/sara.jpg'),
  'https://poshaktaranom.com/uploads/sara.jpg',
);
assert.equal(
  absoluteJsonLdUrl('RETAIL', 'http://cdn.example.com/a.jpg'),
  'https://cdn.example.com/a.jpg',
);
assert.equal(
  absoluteJsonLdUrl('RETAIL', 'https://cdn.example.com/a.jpg'),
  'https://cdn.example.com/a.jpg',
);
assert.equal(
  absoluteJsonLdUrl('RETAIL', '//cdn.example.com/a.jpg'),
  'https://cdn.example.com/a.jpg',
);

console.log('jsonld-url.spec.ts ok');
