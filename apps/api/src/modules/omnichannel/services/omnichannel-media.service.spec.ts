/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/omnichannel-media.service.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const svc = readFileSync(resolve(__dirname, 'omnichannel-media.service.ts'), 'utf8');
const ctl = readFileSync(resolve(__dirname, '../controllers/omnichannel-admin.controller.ts'), 'utf8');
const validation = readFileSync(resolve(__dirname, '../media-validation.ts'), 'utf8');
const constants = readFileSync(resolve(__dirname, '../omnichannel.constants.ts'), 'utf8');
const moduleSrc = readFileSync(resolve(__dirname, '../omnichannel.module.ts'), 'utf8');

assert(svc.includes('async validate('), 'validate');
assert(svc.includes('async scan('), 'scan');
assert(svc.includes('async health('), 'health');
assert(svc.includes('markNeedsReplace'), 'mark needs replace');
assert(svc.includes('assertPublicationPhotosReady'), 'publish gate');
assert(svc.includes('SCAN_LIMIT_MAX = 50'), 'chunked scan max 50');
assert(svc.includes('skip: offset') && svc.includes('take: limit'), 'cursor pagination');
assert(svc.includes('validateImageBuffer'), 'uses pure validation');
assert(svc.includes('MEDIA_SCAN_SUMMARY_KEY'), 'persists summary');
assert(!svc.includes('TelegramAdapter'), 'no telegram adapter');
assert(!svc.includes('BaleAdapter'), 'no bale adapter');
assert(!svc.includes('RubikaAdapter'), 'no rubika adapter');
assert(!svc.includes('TELEGRAM_API_URL'), 'no egress');
assert(!svc.includes('OMNICHANNEL_CONNECTORS_ENABLED'), 'no connector flip');
assert(!svc.includes('OMNICHANNEL_AUTO_PUBLISH'), 'no auto-publish flip');
assert(!/fetch\s*\(/.test(svc), 'no fetch');

assert(ctl.includes("Post('media/validate')"), 'POST media/validate');
assert(ctl.includes("Post('media/scan')"), 'POST media/scan');
assert(ctl.includes("Get('media/health')"), 'GET media/health');
assert(ctl.includes("Post('media/:id/mark-needs-replace')"), 'POST mark-needs-replace');
assert(
  ctl.indexOf("Get('media/health')") < ctl.indexOf("Get('media')") ||
    ctl.indexOf("Get('media/health')") < ctl.indexOf("@Get('media')"),
  'static media/health before list media if both present',
);
{
  const validateBlock = ctl.slice(
    ctl.indexOf("Post('media/validate')"),
    ctl.indexOf("Post('media/scan')"),
  );
  assert(validateBlock.includes("@OmnichannelMinRole('PUBLISHER')"), 'PUBLISHER on validate');
}
{
  const scanBlock = ctl.slice(
    ctl.indexOf("Post('media/scan')"),
    ctl.indexOf("Get('media/health')"),
  );
  assert(scanBlock.includes("@OmnichannelMinRole('PUBLISHER')"), 'PUBLISHER on scan');
}
{
  const healthBlock = ctl.slice(
    ctl.indexOf("Get('media/health')"),
    ctl.indexOf("Post('media/:id/mark-needs-replace')"),
  );
  assert(healthBlock.includes("@OmnichannelMinRole('VIEWER')"), 'VIEWER on health GET');
}
assert(ctl.includes('mediaHealthUi'), 'status exposes mediaHealthUi');

assert(validation.includes('CHANNEL_PHOTO_MAX_BYTES'), 'reuses channel max');
assert(validation.includes('assertChannelPhotoReady'), 'assert helper');
assert(validation.includes('اول تصویر را اصلاح کنید'), 'Persian rejection');
assert(constants.includes('isOmnichannelMediaHealthUiEnabled'), 'media health UI flag');
assert(constants.includes("OMNICHANNEL_MEDIA_HEALTH_UI === 'true'"), 'flag default off');
assert(moduleSrc.includes('OmnichannelMediaService'), 'module registers media service');

console.log('omnichannel-media.service.spec.ts: ok');
