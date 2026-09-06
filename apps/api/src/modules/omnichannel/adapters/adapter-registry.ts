import { Injectable } from '@nestjs/common';
import type { ChannelAdapter } from './channel-adapter';
import { TelegramAdapter } from './telegram.adapter';
import { BaleAdapter } from './bale.adapter';
import { RubikaAdapter } from './rubika.adapter';
import { isOmnichannelProvider, type OmnichannelProvider } from '../omnichannel.constants';

/**
 * One place that maps a connection's `provider` to its official-API adapter. Services and the
 * outbox worker ask here instead of importing a vendor class, so adding a platform never
 * touches business code.
 */
@Injectable()
export class ChannelAdapterRegistry {
  private readonly adapters: Record<OmnichannelProvider, ChannelAdapter>;

  constructor(telegram: TelegramAdapter, bale: BaleAdapter, rubika: RubikaAdapter) {
    this.adapters = { TELEGRAM: telegram, BALE: bale, RUBIKA: rubika };
  }

  /** Throws for unknown providers so a typo in stored data fails loudly instead of posting nowhere. */
  for(provider: string): ChannelAdapter {
    const key = String(provider || '').toUpperCase();
    if (!isOmnichannelProvider(key)) throw new Error(`unknown_provider:${key || 'empty'}`);
    return this.adapters[key];
  }

  has(provider: string): boolean {
    return isOmnichannelProvider(String(provider || '').toUpperCase());
  }
}
