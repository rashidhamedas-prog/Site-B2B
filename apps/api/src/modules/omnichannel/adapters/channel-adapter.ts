export interface ChannelAdapter {
  readonly provider: string;
  validateConnection(secretRef: string): Promise<{ ok: boolean; error?: string }>;
  preview(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  create(input: Record<string, unknown>): Promise<{ providerMessageId: string }>;
  update(input: Record<string, unknown>): Promise<{ providerMessageId: string }>;
  delete(input: Record<string, unknown>): Promise<void>;
}

export class ConnectorDisabledError extends Error {
  constructor(provider: string) {
    super(`${provider} connector is disabled until an official contract and staging credentials exist`);
    this.name = 'ConnectorDisabledError';
  }
}
