/**
 * npx ts-node --transpile-only src/lib/admin-blog-workspace.spec.ts
 */
import assert from 'node:assert/strict';
import {
  isAdminChannel,
  isBlogHubTab,
  parseBlogWorkspaceQuery,
  serializeBlogWorkspaceQuery,
  settingsWritePayload,
  channelPublicHost,
} from './admin-blog-workspace.ts';

assert.equal(isAdminChannel('WHOLESALE'), true);
assert.equal(isAdminChannel('retail'), false);
assert.equal(isBlogHubTab('taxonomy'), true);
assert.equal(isBlogHubTab('media'), false);

assert.deepEqual(
  parseBlogWorkspaceQuery({ get: () => null }),
  { channel: 'WHOLESALE', tab: 'posts' },
);

assert.deepEqual(
  parseBlogWorkspaceQuery({
    get: (name: string) => (name === 'channel' ? 'retail' : name === 'tab' ? 'SETTINGS' : null),
  }),
  { channel: 'RETAIL', tab: 'settings' },
);

assert.deepEqual(
  parseBlogWorkspaceQuery({
    get: (name: string) => (name === 'channel' ? 'RETAIL' : name === 'tab' ? 'authors' : null),
  }),
  { channel: 'RETAIL', tab: 'authors' },
);

assert.equal(serializeBlogWorkspaceQuery({ channel: 'WHOLESALE', tab: 'posts' }), '');
assert.equal(
  serializeBlogWorkspaceQuery({ channel: 'RETAIL', tab: 'taxonomy' }),
  'channel=RETAIL&tab=taxonomy',
);

const stripped = settingsWritePayload({
  id: 'keep-out',
  channel: 'WHOLESALE',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-02',
  blogTitle: 'وبلاگ عمده',
  articlesPerPage: 12,
});
assert.deepEqual(stripped, { blogTitle: 'وبلاگ عمده', articlesPerPage: 12 });
assert.equal(channelPublicHost('RETAIL'), 'poshaktaranom.ir');
assert.equal(channelPublicHost('WHOLESALE'), 'poshaktaranom.com');

console.log('admin-blog-workspace.spec.ts ok');
