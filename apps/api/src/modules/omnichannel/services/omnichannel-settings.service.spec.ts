/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/omnichannel-settings.service.spec.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveDestinationPublishSettings } from '../destination-publish-settings';
import { emptyChannelContentSettings, writeChannelSettingsIntoPublish } from '../channel-settings';
import {
  isOmnichannelChannelSettingsUiEnabled,
  isOmnichannelTemplatesUiEnabled,
} from '../omnichannel.constants';
import { actionRequiresGoRef } from '../omnichannel-rbac';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const prev = process.env.OMNICHANNEL_CHANNEL_SETTINGS_UI;
delete process.env.OMNICHANNEL_CHANNEL_SETTINGS_UI;
assert(isOmnichannelChannelSettingsUiEnabled() === false, 'channel settings UI default off');
process.env.OMNICHANNEL_CHANNEL_SETTINGS_UI = 'true';
assert(isOmnichannelChannelSettingsUiEnabled() === true, 'flag on');
if (prev === undefined) delete process.env.OMNICHANNEL_CHANNEL_SETTINGS_UI;
else process.env.OMNICHANNEL_CHANNEL_SETTINGS_UI = prev;

const prevTpl = process.env.OMNICHANNEL_TEMPLATES_UI;
delete process.env.OMNICHANNEL_TEMPLATES_UI;
assert(isOmnichannelTemplatesUiEnabled() === false, 'templates UI default off');
if (prevTpl !== undefined) process.env.OMNICHANNEL_TEMPLATES_UI = prevTpl;

assert(actionRequiresGoRef('channel_settings_policy_patch') === true, 'policy channel-settings needs goRef');
assert(actionRequiresGoRef('channel_settings_patch') === false, 'content-only channel-settings no goRef list entry');
assert(actionRequiresGoRef('channel_settings_copy_from') === true, 'copy-from needs goRef');
assert(actionRequiresGoRef('template_activate') === true, 'template activate needs goRef');
assert(actionRequiresGoRef('destination_emergency_hold') === true, 'emergency hold needs goRef');

const svcSrc = readFileSync(join(__dirname, './omnichannel-settings.service.ts'), 'utf8');
assert(svcSrc.includes('patchTouchesOwnerPolicy'), 'policy gate wired');
assert(svcSrc.includes('roleMeetsMinimum'), 'Owner role gate for policy');
assert(svcSrc.includes('emergency-hold'), 'rejects emergencyHold on general PATCH');
assert(svcSrc.includes('assertTemplateActivationClean'), 'activate contamination gate helper');

const global = {
  autoPublishMode: 'LIVE' as const,
  autoDailyCap: 12,
  autoMinGapSeconds: 60,
  withdrawAction: 'KEEP' as const,
};
const connWithContact = { seeded: true, autoPublishMode: 'OFF', contactId: 'from-conn', utmSource: 'conn-utm' };
const destEmpty = { seeded: true, autoPublishMode: 'CANARY' };
const resolved = resolveDestinationPublishSettings(destEmpty, connWithContact, global, 'RETAIL');
assert(resolved.content.contactId === '', 'content ignores connection contactId');
assert(resolved.content.utmSource === '', 'content ignores connection utm');
assert(resolved.content.ownerChatId === '', 'no invented ownerChatId');
assert(resolved.automation.mode === 'CANARY', 'automation still from destination');

const destA = writeChannelSettingsIntoPublish(
  { seeded: true, autoPublishMode: 'LIVE', autoDailyCap: 3, quietStartHour: 1, quietEndHour: 6 },
  { ...emptyChannelContentSettings(), contactId: 'tg-retail', footerText: 'A' },
);
const destB = writeChannelSettingsIntoPublish(
  { seeded: true, autoPublishMode: 'LIVE', autoDailyCap: 9, quietStartHour: 22, quietEndHour: 7 },
  { ...emptyChannelContentSettings(), contactId: 'bale-wholesale', footerText: 'B' },
);
const ra = resolveDestinationPublishSettings(destA, connWithContact, global, 'RETAIL');
const rb = resolveDestinationPublishSettings(destB, connWithContact, global, 'WHOLESALE');
assert(ra.content.contactId === 'tg-retail' && rb.content.contactId === 'bale-wholesale', 'matrix content isolation');
assert(ra.automation.dailyCap === 3 && rb.automation.dailyCap === 9, 'cap independent per dest');
assert(ra.automation.quietStartHour === 1 && rb.automation.quietStartHour === 22, 'quiet independent');

const ctl = readFileSync(join(__dirname, '../controllers/omnichannel-admin.controller.ts'), 'utf8');
assert(ctl.includes('channelSettingsUi'), 'status exposes channelSettingsUi');
assert(ctl.includes('channel-settings'), 'channel-settings routes');
assert(ctl.includes('templates/:id/activate'), 'activate route');
assert(ctl.includes('OmnichannelSettingsService') || ctl.includes('channelSettings.'), 'settings service mounted');
assert(!ctl.match(/Patch\('destinations\/:id\/channel-settings'\)[\s\S]{0,200}@RequiresGoRef/), 'content PATCH not hard-RequiresGoRef');

assert(!svcSrc.includes('4858359991'), 'no invented canary chat as settings default');
assert(!/TaranomRetailBot/.test(svcSrc), 'no invented order bot seed');

const activateSrc = readFileSync(join(__dirname, './omnichannel.service.ts'), 'utf8');
assert(activateSrc.includes('assertTemplateActivationClean'), 'activateTemplate calls contamination hard-fail');

const constants = readFileSync(join(__dirname, '../omnichannel.constants.ts'), 'utf8');
assert(constants.includes("OMNICHANNEL_CHANNEL_SETTINGS_UI === 'true'"), 'UI default off');

console.log('omnichannel-settings.service.spec.ts: ok');
