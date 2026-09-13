/**
 * npx ts-node --transpile-only --compiler-options "{\"module\":\"commonjs\",\"moduleResolution\":\"node\"}" src/lib/admin-cms-workspace.spec.ts
 */
import {
  cmsPageKeysForChannel,
  cmsPageLabel,
  parseCmsWorkspaceQuery,
  serializeCmsWorkspaceQuery,
} from './admin-cms-workspace.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const q = new URLSearchParams('channel=RETAIL&page=privacy');
  const parsed = parseCmsWorkspaceQuery(q);
  assert(parsed.channel === 'RETAIL', 'retail channel');
  assert(parsed.page === 'privacy', 'privacy page');
}

{
  const q = new URLSearchParams('channel=RETAIL&page=wholesale');
  const parsed = parseCmsWorkspaceQuery(q);
  assert(parsed.page === 'home', 'wholesale page is not a retail key');
}

{
  const qs = serializeCmsWorkspaceQuery({ channel: 'WHOLESALE', page: 'home' });
  assert(qs === '', 'defaults omit query');
}

{
  const keys = cmsPageKeysForChannel('WHOLESALE').map((p) => p.key);
  assert(keys.includes('wholesale'), 'wholesale-only page');
  assert(cmsPageLabel('RETAIL', 'home') === 'صفحه اصلی', 'label');
  assert(!cmsPageKeysForChannel('RETAIL').some((p) => p.key === 'wholesale'), 'retail has no wholesale key');
}

console.log('admin-cms-workspace.spec.ts: ok');
