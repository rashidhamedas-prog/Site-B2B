import assert from 'node:assert/strict';
import { looksLikeHtml, selectRetailPdpBody, lightSanitizeHtml } from './retail-pdp-copy';

assert.equal(selectRetailPdpBody({}), '');
assert.equal(selectRetailPdpBody({ description: '  کوتاه  ' }), 'کوتاه');
assert.equal(
  selectRetailPdpBody({ fullContent: 'متن کامل', description: 'کوتاه' }),
  'متن کامل',
);
assert.equal(selectRetailPdpBody({ fullContent: '   ', description: 'کوتاه' }), 'کوتاه');
assert.equal(looksLikeHtml('پارچه لینن'), false);
assert.equal(looksLikeHtml('<p>پارچه لینن</p>'), true);
assert.equal(lightSanitizeHtml('<p onclick="alert(1)">ok</p>'), '<p>ok</p>');
assert.equal(lightSanitizeHtml('<script>x</script>hi'), 'hi');

console.log('retail-pdp-copy.spec.ts ok');
