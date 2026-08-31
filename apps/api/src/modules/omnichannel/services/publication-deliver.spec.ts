/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/publication-deliver.spec.ts
 */
import { shouldSkipPublicationDeliver } from './publication-deliver';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(shouldSkipPublicationDeliver(false) === true, 'skip when connectors off');
assert(shouldSkipPublicationDeliver(true) === false, 'run when connectors on');

console.log('publication-deliver.spec.ts: ok');
