/**
 * npx ts-node --transpile-only src/modules/omnichannel/free-post.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OUTBOX_EVENT_TYPES } from './omnichannel.constants';
import { CreatePublicationDto, PreviewDto } from './dto/omnichannel.dto';
import { reconcilePublicationIntents } from './services/reconcile';
import {
  FREE_POST_DELIVERY_EVENT,
  FREE_POST_DISABLED_MESSAGE,
  assertFreePostEnabled,
  assertFreePostReason,
  buildFreePostProjection,
  catalogPublicationsForReconcile,
  freePostQuietBlock,
  isFreePostSourceId,
  newFreePostSourceId,
  parseFreePostInput,
  renderFreePost,
} from './free-post';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function errorsOf<T extends object>(cls: new () => T, body: object) {
  return validate(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true });
}

const prev = process.env.OMNICHANNEL_FREE_POST_ENABLED;
delete process.env.OMNICHANNEL_FREE_POST_ENABLED;

try {
  assertFreePostEnabled();
  throw new Error('disabled flag must reject');
} catch (err) {
  assert(err instanceof ForbiddenException, 'disabled flag is ForbiddenException');
  assert(err.getStatus() === 403, 'disabled flag is 403');
  assert(String(err.message).includes(FREE_POST_DISABLED_MESSAGE), 'disabled message names the flag');
}

process.env.OMNICHANNEL_FREE_POST_ENABLED = 'false';
try {
  assertFreePostEnabled();
  throw new Error('false flag must reject');
} catch (err) {
  assert(err instanceof ForbiddenException, 'string false stays disabled');
}

process.env.OMNICHANNEL_FREE_POST_ENABLED = 'TRUE';
try {
  assertFreePostEnabled();
  throw new Error('TRUE must not enable');
} catch (err) {
  assert(err instanceof ForbiddenException, 'only exact true enables');
}

process.env.OMNICHANNEL_FREE_POST_ENABLED = 'true';
assertFreePostEnabled();

function rejection(run: () => void): string {
  try {
    run();
  } catch (err) {
    assert(err instanceof BadRequestException, 'validation is BadRequest');
    return String(err.message);
  }
  throw new Error('expected rejection');
}

{
  assert(rejection(() => parseFreePostInput({ channel: 'RETAIL', caption: '   ' })).includes('الزامی'), 'caption required');
  assert(rejection(() => parseFreePostInput({
    channel: 'RETAIL',
    caption: 'hello 123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  })).length > 0, 'telegram token shape rejected');
  assert(rejection(() => parseFreePostInput({
    channel: 'WHOLESALE',
    caption: 'آرشیو هفته',
    mediaUrl: 'https://evil.example/a.jpg',
  })).includes('تصویر'), 'foreign media rejected');
  assert(rejection(() => parseFreePostInput({
    channel: 'RETAIL',
    caption: 'ن'.repeat(1025),
    mediaUrl: 'https://www.poshaktaranom.ir/uploads/a.jpg',
  })).includes('۱۰۲۴'), 'photo caption cap');
  assert(rejection(() => parseFreePostInput({ channel: 'RETAIL', caption: 'سلام', sourceId: 'product-1' })).includes('free:'), 'sourceId must be free:<uuid>');
  const generated = parseFreePostInput({ channel: 'WHOLESALE', caption: 'سلام\nهفته اول' });
  assert(isFreePostSourceId(generated.sourceId), 'server mints stable free id');
  const kept = parseFreePostInput({
    channel: 'RETAIL',
    caption: 'همان پست',
    sourceId: generated.sourceId,
  });
  assert(kept.sourceId === generated.sourceId, 'resend keeps sourceId');
  assert(newFreePostSourceId() !== generated.sourceId, 'ids differ per post');
}

{
  const draft = parseFreePostInput({
    channel: 'RETAIL',
    caption: 'کپشن آزاد',
    mediaUrl: '/uploads/look.jpg',
    sourceId: newFreePostSourceId(),
  });
  const projection = buildFreePostProjection(draft);
  const rendered = renderFreePost(projection);
  assert(projection.sourceType === 'FREE_POST' && projection.publishable, 'projection publishable');
  assert(rendered.parseMode === 'PLAIN' && rendered.mediaMode === 'single', 'plain single photo');
  assert(rendered.photoUrls.length === 1 && rendered.photoUrls[0].startsWith('https://www.poshaktaranom.ir/'), 'photo pinned to retail origin');
  assert(rendered.buttons.length === 0, 'no buttons on free post');
  const textOnly = renderFreePost(buildFreePostProjection({ ...draft, mediaUrl: null }));
  assert(textOnly.photoUrls.length === 0 && textOnly.mediaMode === 'text', 'text mode drops photo');
}

{
  let threw = false;
  try { assertFreePostReason('  '); } catch { threw = true; }
  assert(threw, 'reason required');
  assert(assertFreePostReason('  آرشیو هفته ۱  ') === 'آرشیو هفته ۱', 'reason trimmed');
}

{
  const night = freePostQuietBlock({
    mode: 'LIVE', quietStartHour: 23, quietEndHour: 8, tehranHourNow: 23, creating: true,
  });
  assert(!!night, 'LIVE quiet hours block a new free post');
  assert(freePostQuietBlock({
    mode: 'CANARY', quietStartHour: 23, quietEndHour: 8, tehranHourNow: 23, creating: true,
  }) === null, 'canary mode is not the live quiet gate');
  assert(freePostQuietBlock({
    mode: 'LIVE', quietStartHour: 23, quietEndHour: 8, tehranHourNow: 23, creating: false,
  }) === null, 'updates are not quiet-blocked');
  assert(freePostQuietBlock({
    mode: 'LIVE', quietStartHour: 23, quietEndHour: 8, tehranHourNow: 12, creating: true,
  }) === null, 'daytime LIVE is open');
}

{
  const rows = [
    { sourceType: 'PRODUCT', sourceId: 'p1', channel: 'RETAIL', status: 'PUBLISHED', sourceUpdatedAt: '2026-08-29T10:00:00.000Z' },
    { sourceType: 'FREE_POST', sourceId: 'free:11111111-1111-4111-8111-111111111111', channel: 'RETAIL', status: 'PUBLISHED', sourceUpdatedAt: '2026-08-29T10:00:00.000Z' },
    { sourceType: 'BLOG_POST', sourceId: 'b1', channel: 'RETAIL', status: 'PUBLISHED', sourceUpdatedAt: '2026-08-29T09:00:00.000Z' },
  ];
  const catalog = catalogPublicationsForReconcile(rows);
  assert(catalog.length === 2 && catalog.every((row) => row.sourceType !== 'FREE_POST'), 'reconcile input drops FREE_POST');
  const intents = reconcilePublicationIntents(
    [{ id: 'p1', channel: 'RETAIL', updatedAt: '2026-08-29T10:00:00.000Z' }],
    catalog,
  );
  assert(!intents.some((row) => String(row.sourceId).startsWith('free:')), 'free sourceId is not withdrawn by catalog reconcile');
  assert(intents.some((row) => row.action === 'withdraw' && row.sourceId === 'b1'), 'existing non-free withdraw intent unchanged');
}

assert(FREE_POST_DELIVERY_EVENT === OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED, 'free post uses the catalog delivery event');

{
  const freeSrc = readFileSync(resolve(__dirname, 'free-post.ts'), 'utf8');
  const svc = readFileSync(resolve(__dirname, 'services/omnichannel.service.ts'), 'utf8');
  const worker = readFileSync(resolve(__dirname, 'services/outbox-worker.service.ts'), 'utf8');
  assert(!/api\.telegram\.org/.test(freeSrc), 'free-post module has no Bot API host');
  assert(!/TelegramAdapter|telegramCall|\bfetch\(/.test(freeSrc), 'free-post module does not call Telegram');
  assert(svc.includes('enqueueDeliveries') && svc.includes('FREE_POST_SOURCE_TYPE'), 'service enqueues free posts on the publication gateway');
  const previewBody = svc.slice(svc.indexOf('private previewFreePost'), svc.indexOf('async createPublication'));
  assert(previewBody.includes('parseFreePostInput') && !previewBody.includes('adapter') && !/api\.telegram\.org/.test(previewBody), 'preview does not call Telegram');
  assert((svc.match(/adapter\.create\(/g) || []).length === 2, 'direct adapter.create stays canary-ping and test-post only');
  assert(!/api\.telegram\.org/.test(svc), 'service has no Bot API host');
  assert(worker.includes('PUBLICATION_DELIVER_REQUESTED') && worker.includes('handlePublicationDeliver'), 'worker gateway still delivers publications');
  assert(worker.includes("String(payload.sourceType || '') === 'FREE_POST'"), 'worker audits free posts only after the shared deliver');
}

async function dtoCases() {
  const product = await errorsOf(PreviewDto, { channel: 'RETAIL', sourceType: 'PRODUCT', sourceId: 'sku-1' });
  assert(product.length === 0, 'PRODUCT preview DTO unchanged without caption');
  const productMissingId = await errorsOf(PreviewDto, { channel: 'RETAIL', sourceType: 'PRODUCT' });
  assert(productMissingId.length > 0, 'PRODUCT still requires sourceId');
  const unknown = await errorsOf(PreviewDto, { channel: 'RETAIL', sourceType: 'PRODUCT', sourceId: 'sku-1', botToken: 'x' });
  assert(unknown.length > 0, 'unknown secret field still rejected');
  const free = await errorsOf(PreviewDto, {
    channel: 'WHOLESALE',
    sourceType: 'FREE_POST',
    caption: 'سلام',
    mediaUrl: 'https://poshaktaranom.com/uploads/a.jpg',
  });
  assert(free.length === 0, 'FREE_POST preview DTO accepts caption without sourceId');
  const huge = await errorsOf(PreviewDto, { channel: 'RETAIL', sourceType: 'FREE_POST', caption: 'ن'.repeat(4097) });
  assert(huge.length > 0, 'caption over 4096 fails DTO');
  const publish = await errorsOf(CreatePublicationDto, {
    preview: { channel: 'RETAIL', sourceType: 'PRODUCT', sourceId: 'sku-1' },
    dryRun: true,
    reason: 'بازبینی',
  });
  assert(publish.length === 0, 'existing publication DTO still valid');
  const publishFree = await errorsOf(CreatePublicationDto, {
    preview: { channel: 'RETAIL', sourceType: 'FREE_POST', caption: 'متن' },
    dryRun: true,
  });
  assert(publishFree.length === 0, 'reason stays optional at DTO; service requires it for FREE_POST');
}

dtoCases().then(() => {
  if (prev === undefined) delete process.env.OMNICHANNEL_FREE_POST_ENABLED;
  else process.env.OMNICHANNEL_FREE_POST_ENABLED = prev;
  console.log('free-post.spec.ts: ok');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
