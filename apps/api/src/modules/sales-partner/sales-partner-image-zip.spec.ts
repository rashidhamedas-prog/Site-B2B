import { crc32, partnerImageEntryName, partnerImageObjectKey, partnerImageZipName, storeZip } from './sales-partner-image-zip';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(crc32(Buffer.from('hello')) === 0x3610a686, 'crc32 hello');

const zip = storeZip([{ name: '01.webp', data: Buffer.from('hello') }]);
assert(zip.readUInt32LE(0) === 0x04034b50, 'local header');
assert(zip.includes(Buffer.from('01.webp')), 'entry name stored');
assert(zip.includes(Buffer.from('hello')), 'entry bytes stored');
assert(zip.readUInt32LE(zip.length - 22) === 0x06054b50, 'end of central directory');

assert(partnerImageObjectKey('https://www.poshaktaranom.ir/media/products/sara.webp') === 'products/sara.webp', 'owned media');
assert(partnerImageObjectKey('https://storage.poshaktaranom.com/products/a.jpg') === 'products/a.jpg', 'owned storage host');
assert(partnerImageObjectKey('https://evil.example/products/a.jpg') === null, 'foreign host rejected');
assert(partnerImageObjectKey('http://www.poshaktaranom.ir/products/a.jpg') === null, 'http public host rejected');
assert(partnerImageObjectKey('https://user:pass@www.poshaktaranom.ir/products/a.jpg') === null, 'credentials rejected');
assert(partnerImageObjectKey('/media/products/../../secret.jpg') === null, 'traversal rejected');
assert(partnerImageObjectKey('products/a.jpg') === 'products/a.jpg', 'bare key');
assert(partnerImageObjectKey('https://www.poshaktaranom.ir/uploads/a.jpg') === null, 'non-media prefix rejected');
assert(partnerImageEntryName('products/a.WEBP', 0) === '01.webp', 'entry name');
assert(partnerImageZipName('Sara Linen') === 'sara-linen-images.zip', 'zip filename');
assert(partnerImageZipName('../etc') === 'etc-images.zip', 'zip filename strips traversal');

console.log('sales-partner-image-zip.spec.ts: OK');
