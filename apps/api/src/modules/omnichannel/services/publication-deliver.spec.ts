/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/publication-deliver.spec.ts
 */
import { ConnectorDisabledError } from '../adapters/channel-adapter';
import {
  isConnectorDisabledError,
  isConnectorDisabledLastError,
  isUnconfirmedSendError,
  shouldSkipPublicationDeliver,
} from './publication-deliver';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(shouldSkipPublicationDeliver(false) === true, 'skip when connectors off');
assert(shouldSkipPublicationDeliver(true) === false, 'run when connectors on');

assert(isConnectorDisabledError(new ConnectorDisabledError('BALE')) === true, 'ConnectorDisabledError instance');
assert(
  isConnectorDisabledError(new Error('BALE connector is disabled (OMNICHANNEL_CONNECTORS_ENABLED / OMNICHANNEL_DISABLED_PROVIDERS)')) === true,
  'message match',
);
assert(isConnectorDisabledError(new Error('Bad Request: failed to get HTTP URL content')) === false, 'other errors stay hard');

assert(
  isConnectorDisabledLastError('BALE connector is disabled (OMNICHANNEL_CONNECTORS_ENABLED / OMNICHANNEL_DISABLED_PROVIDERS)') === true,
  'lastError match',
);
assert(isConnectorDisabledLastError('cancelled_by_admin') === false, 'intentional is not gate');

assert(isUnconfirmedSendError(new Error('timeout')) === true, 'adapter timeout string');
assert(isUnconfirmedSendError(Object.assign(new Error('aborted'), { name: 'AbortError' })) === true, 'AbortError');
assert(isUnconfirmedSendError(new Error('outbox publication.deliver.requested x timed out after 35000ms')) === true, 'handle race timeout');
assert(isUnconfirmedSendError(new Error('outbox publication.deliver.requested x timed out after 50000ms')) === true, 'CREATE media timeout');
assert(isUnconfirmedSendError(new Error('Bad Request: chat not found')) === false, 'hard provider errors stay retryable');

console.log('publication-deliver.spec.ts: ok');
