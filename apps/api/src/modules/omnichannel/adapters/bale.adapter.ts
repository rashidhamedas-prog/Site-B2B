import { ChannelAdapter, ConnectorDisabledError } from './channel-adapter';

/** Gated: no Bale API invented. Stays disabled until official docs and credentials. */
export class BaleAdapter implements ChannelAdapter {
  readonly provider = 'BALE';

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
