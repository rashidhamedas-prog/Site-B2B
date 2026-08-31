import { ChannelAdapter, ConnectorDisabledError } from './channel-adapter';

/** Gated: no Rubika API invented. Stays disabled until official docs and credentials. */
export class RubikaAdapter implements ChannelAdapter {
  readonly provider = 'RUBIKA';

  async validateConnection(_secretRef?: string): Promise<{ ok: boolean; error?: string }> {
    throw new ConnectorDisabledError(this.provider);
  }
  async preview(): Promise<Record<string, unknown>> {
    throw new ConnectorDisabledError(this.provider);
  }
  async create(): Promise<{ providerMessageId: string }> {
    throw new ConnectorDisabledError(this.provider);
  }
  async update(): Promise<{ providerMessageId: string }> {
    throw new ConnectorDisabledError(this.provider);
  }
  async delete(): Promise<void> {
    throw new ConnectorDisabledError(this.provider);
  }
}
