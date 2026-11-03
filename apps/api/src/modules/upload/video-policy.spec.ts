import {
  VIDEO_ERROR_MESSAGES,
  VIDEO_MAX_BYTES,
  sniffVideoMagic,
  videoUploadRejection,
} from './video-policy';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const iso = Buffer.alloc(12);
iso.write('ftyp', 4, 'ascii');
const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]);
const exe = Buffer.from('MZ executable');

assert(sniffVideoMagic(iso) === 'iso-bmff', 'sniffs MP4/MOV ftyp');
assert(sniffVideoMagic(webm) === 'webm', 'sniffs WebM EBML');
assert(videoUploadRejection('clip.mp4', 'video/mp4', 100, iso) === null, 'accepts MP4');
assert(videoUploadRejection('clip.mov', 'video/quicktime', 100, iso) === null, 'accepts MOV');
assert(videoUploadRejection('clip.webm', 'video/webm', 100, webm) === null, 'accepts WebM');
assert(
  videoUploadRejection('renamed.mp4', 'video/mp4', 100, exe) === VIDEO_ERROR_MESSAGES.BAD_TYPE,
  'rejects renamed executable',
);
assert(
  videoUploadRejection('clip.mp4', 'video/webm', 100, iso) === VIDEO_ERROR_MESSAGES.BAD_TYPE,
  'rejects MIME spoof',
);
assert(
  videoUploadRejection('clip.mp4', 'video/mp4', 201 * 1024 * 1024, iso) === VIDEO_ERROR_MESSAGES.TOO_BIG,
  'rejects 201MB',
);
assert(VIDEO_MAX_BYTES === 200 * 1024 * 1024, 'keeps approved 200MB cap');
assert(VIDEO_ERROR_MESSAGES.BAD_TYPE === 'فرمت پشتیبانی نمی‌شود. فقط MP4، MOV یا WebM.', 'UI-SPEC bad-type copy');
assert(VIDEO_ERROR_MESSAGES.TOO_BIG === 'حجم فایل بیش از ۲۰۰ مگابایت است.', 'UI-SPEC too-big copy');
assert(VIDEO_ERROR_MESSAGES.TOO_LONG === 'ویدیو بیش از ۶۰ ثانیه است. کوتاه‌ترش کنید.', 'UI-SPEC too-long copy');
assert(
  VIDEO_ERROR_MESSAGES.PROCESSING_FAILED === 'پردازش ناموفق بود. دوباره تلاش کنید یا فایل دیگری بفرستید.',
  'UI-SPEC processing-failed copy',
);

console.log('video-policy.spec.ts: ok');
