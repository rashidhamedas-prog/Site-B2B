/**
 * npx ts-node --transpile-only src/modules/omnichannel/adapters/telegram-media.spec.ts
 */
import * as assert from 'node:assert/strict';
import type { SharpFactory } from '../../upload/image-processor';
import {
  TELEGRAM_PHOTO_LONG_EDGE,
  TELEGRAM_PHOTO_MAX_BYTES,
  buildTelegramAlbumForm,
  buildTelegramPhotoForm,
  isAllowlistedPhotoUrl,
  loadOwnedPhotoBytes,
  ownedProductMediaKey,
  prepareTelegramUpload,
  telegramMediaUploadMode,
} from './telegram-media';

function assertFn(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assertFn(telegramMediaUploadMode({}) === 'url', 'unset mode stays on url');
  assertFn(telegramMediaUploadMode({ TELEGRAM_MEDIA_UPLOAD_MODE: '  ' }) === 'url', 'blank mode stays on url');
  assertFn(telegramMediaUploadMode({ TELEGRAM_MEDIA_UPLOAD_MODE: 'URL' }) === 'url', 'explicit url');
  assertFn(telegramMediaUploadMode({ TELEGRAM_MEDIA_UPLOAD_MODE: 'nope' }) === 'url', 'unknown mode stays on url');
  assertFn(telegramMediaUploadMode({ TELEGRAM_MEDIA_UPLOAD_MODE: 'upload' }) === 'upload', 'upload enables multipart');

  const mediaUrl = 'https://poshaktaranom.com/media/products/look.webp';
  assertFn(ownedProductMediaKey(mediaUrl) === 'products/look.webp', 'media URL maps to the object key');
  assertFn(ownedProductMediaKey('https://www.poshaktaranom.ir/uploads/a.jpg') === null, 'non-media path is not a storage key');
  assertFn(isAllowlistedPhotoUrl('https://evil.example/x.jpg') === false, 'foreign host rejected');
  assertFn(ownedProductMediaKey('https://evil.example/media/products/x.webp') === null, 'foreign /media key rejected');

  let fetched = 0;
  const fromStorage = await loadOwnedPhotoBytes(mediaUrl, {
    readStorage: async (key) => {
      assertFn(key === 'products/look.webp', 'storage key');
      return Buffer.from('disk');
    },
    fetchImpl: async () => {
      fetched += 1;
      throw new Error('should not fetch');
    },
  });
  assertFn(fromStorage.toString() === 'disk' && fetched === 0, 'MinIO wins over HTTPS');

  const viaHttp = await loadOwnedPhotoBytes('https://www.poshaktaranom.ir/uploads/a.jpg', {
    fetchImpl: async (_url, init) => {
      assertFn(init?.redirect === 'manual', 'same-origin fetch does not follow redirects');
      return new Response(Buffer.from('http-bytes'), { status: 200 });
    },
  });
  assertFn(viaHttp.toString() === 'http-bytes', 'allowlisted URL without a storage key is fetched');

  let redirected = false;
  try {
    await loadOwnedPhotoBytes('https://poshaktaranom.com/media/products/look.webp', {
      readStorage: async () => {
        throw new Error('missing');
      },
      fetchImpl: async () => new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/' } }),
    });
  } catch (err) {
    redirected = err instanceof Error && err.message === 'photo_fetch_failed';
  }
  assertFn(redirected, 'redirect is not followed');

  let rejected = false;
  try {
    await loadOwnedPhotoBytes('https://evil.example/x.jpg', {
      fetchImpl: async () => {
        throw new Error('fetched evil');
      },
    });
  } catch (err) {
    rejected = err instanceof Error && err.message === 'photo_host_rejected';
  }
  assertFn(rejected, 'loader does not fetch a foreign host');

  const sharp = require('sharp') as SharpFactory;
  const wide = await sharp({
    create: { width: 4000, height: 1000, channels: 3, background: { r: 180, g: 40, b: 40 } },
  })
    .webp()
    .toBuffer();
  const prepared = await prepareTelegramUpload(wide);
  assertFn(prepared.contentType === 'image/jpeg' && prepared.filename === 'photo.jpg', 'webp becomes jpeg');
  assertFn(prepared.bytes[0] === 0xff && prepared.bytes[1] === 0xd8, 'jpeg SOI');
  assertFn(prepared.bytes[prepared.bytes.length - 2] === 0xff && prepared.bytes[prepared.bytes.length - 1] === 0xd9, 'jpeg EOI');
  assertFn(prepared.bytes.length <= TELEGRAM_PHOTO_MAX_BYTES, 'under the photo cap');
  const meta = await sharp(prepared.bytes).metadata();
  assertFn((meta.width ?? 0) <= TELEGRAM_PHOTO_LONG_EDGE && (meta.height ?? 0) <= TELEGRAM_PHOTO_LONG_EDGE, 'long edge capped');
  assertFn((meta.width ?? 0) < 4000, 'wide webp was downscaled');

  await assert.rejects(() => prepareTelegramUpload(Buffer.from('not an image')), (err: unknown) => {
    return err instanceof Error && err.message === 'photo_unreadable';
  });

  const form = buildTelegramAlbumForm({
    chatId: '-1001',
    photos: [prepared, prepared],
    caption: '<b>مانتو</b>',
    parseMode: 'HTML',
    silent: true,
  });
  const media = JSON.parse(String(form.get('media'))) as Array<Record<string, unknown>>;
  assertFn(media[0].media === 'attach://photo0' && media[1].media === 'attach://photo1', 'album uses attach names');
  assertFn(!String(media[0].media).startsWith('http'), 'album does not pass a URL');
  assertFn(media[0].caption === '<b>مانتو</b>' && media[0].parse_mode === 'HTML', 'caption on first item');
  assertFn(!('show_caption_above_media' in media[0]), 'album omits captionAbove');
  assertFn(form.get('disable_notification') === 'true', 'silent is a multipart string');
  assertFn(form.get('photo0') instanceof Blob && form.get('photo1') instanceof Blob, 'file parts present');

  const single = buildTelegramPhotoForm({
    chatId: '-1001',
    photo: prepared,
    caption: 'کپشن',
    captionAbove: true,
    replyMarkup: { inline_keyboard: [[{ text: 'خرید', url: 'https://www.poshaktaranom.ir/p' }]] },
  });
  assertFn(single.get('photo') instanceof Blob, 'sendPhoto file field');
  assertFn(single.get('show_caption_above_media') === 'true', 'single photo keeps captionAbove');
  assertFn(String(single.get('reply_markup')).includes('poshaktaranom.ir'), 'reply_markup json');

  console.log('telegram-media.spec.ts: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
