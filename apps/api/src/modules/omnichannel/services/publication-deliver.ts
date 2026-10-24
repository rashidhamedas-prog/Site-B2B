import { ConnectorDisabledError } from '../adapters/channel-adapter';
import { areOmnichannelConnectorsEnabled } from '../omnichannel.constants';

export class DeliveryDeferredError extends Error {
  constructor() {
    super('publication delivery deferred until connectors are enabled');
    this.name = 'DeliveryDeferredError';
  }
}

export function shouldSkipPublicationDeliver(connectorsEnabled = areOmnichannelConnectorsEnabled()): boolean {
  return connectorsEnabled !== true;
}

/** Historical / live gate-off errors that must not burn DEAD attempts. */
export const CONNECTOR_DISABLED_ERROR_RE = /connector is disabled/i;

export function isConnectorDisabledError(err: unknown): boolean {
  if (err instanceof ConnectorDisabledError) return true;
  if (!err || typeof err !== 'object') return false;
  const named = err as { name?: string; message?: string };
  if (named.name === 'ConnectorDisabledError') return true;
  return CONNECTOR_DISABLED_ERROR_RE.test(String(named.message || ''));
}

export function isConnectorDisabledLastError(lastError?: string | null): boolean {
  return CONNECTOR_DISABLED_ERROR_RE.test(String(lastError || ''));
}
