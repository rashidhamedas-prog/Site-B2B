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
