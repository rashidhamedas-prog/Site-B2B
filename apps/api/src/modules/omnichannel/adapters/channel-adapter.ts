/** What the admin console needs to know about a chat before automation may post there. */
export type DestinationInspection = {
  ok: boolean;
  error?: string;
  /** Normalised: private | group | supergroup | channel | bot. */
  chatType?: string;
  title?: string;
  username?: string | null;
  memberCount?: number | null;
  botUsername?: string;
  botIsAdmin?: boolean;
  /** Undefined when the vendor has no getChatMember-style call (Rubika): a test post proves it. */
  canPost?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  /** How the rights above were established. */
  permissionCheck?: 'api' | 'test_post' | 'unavailable';
};

/** A chat seen in the bot's recent updates; helps admins find opaque ids (Rubika `c0…`, Telegram `-100…`). */
export type DiscoveredChat = {
  chatId: string;
  chatType: string;
  title?: string;
  username?: string | null;
  /** Where the id came from: a channel post the bot saw, a forwarded message, or a membership event. */
  via: 'channel_post' | 'forward' | 'member' | 'message';
};

export interface ChannelAdapter {
  readonly provider: string;
  validateConnection(secretRef: string): Promise<{ ok: boolean; error?: string }>;
  inspectDestination(secretRef: string, chatId: string): Promise<DestinationInspection>;
  discoverChats(secretRef: string): Promise<{ ok: boolean; error?: string; chats: DiscoveredChat[] }>;
  preview(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  create(input: Record<string, unknown>): Promise<{ providerMessageId: string }>;
  update(input: Record<string, unknown>): Promise<{ providerMessageId: string }>;
  delete(input: Record<string, unknown>): Promise<void>;
}

export class ConnectorDisabledError extends Error {
  constructor(provider: string) {
    super(`${provider} connector is disabled (OMNICHANNEL_CONNECTORS_ENABLED / OMNICHANNEL_DISABLED_PROVIDERS)`);
    this.name = 'ConnectorDisabledError';
  }
}
