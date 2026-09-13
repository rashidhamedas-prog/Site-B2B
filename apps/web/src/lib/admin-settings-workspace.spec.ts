/**
 * npx ts-node --transpile-only src/lib/admin-settings-workspace.spec.ts
 */
import assert from 'node:assert/strict';
import {
  parseSettingsWorkspaceQuery,
  resolveSmsEvents,
  serializeSettingsWorkspaceQuery,
  settingsSectionMatchesQuery,
} from './admin-settings-workspace.ts';

const empty = { get: () => null };
assert.deepEqual(parseSettingsWorkspaceQuery(empty), {
  section: 'business',
  channel: 'WHOLESALE',
  q: '',
});

const search = new URLSearchParams('section=seo&channel=RETAIL&q=عنوان');
assert.deepEqual(parseSettingsWorkspaceQuery(search), {
  section: 'seo',
  channel: 'RETAIL',
  q: 'عنوان',
});

assert.equal(serializeSettingsWorkspaceQuery({}), '');
assert.equal(
  serializeSettingsWorkspaceQuery({ section: 'seo', channel: 'RETAIL', q: 'og' }),
  'section=seo&channel=RETAIL&q=og',
);

assert.equal(settingsSectionMatchesQuery('sms', ''), true);
assert.equal(settingsSectionMatchesQuery('sms', 'پیامک'), true);
assert.equal(settingsSectionMatchesQuery('sms', 'ارسال'), false);

const events = resolveSmsEvents({ orderRegistered: false });
assert.equal(events.orderRegistered, false);
assert.equal(events.fulfillmentPendingAccept, true);
assert.equal(Object.keys(events).includes('fulfillmentAcceptExpired'), true);

console.log('admin-settings-workspace.spec ok');
