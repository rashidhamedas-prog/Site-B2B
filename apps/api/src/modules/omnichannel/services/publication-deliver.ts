import { ConnectorDisabledError } from '../adapters/channel-adapter';
import { classifyTelegramThrow } from '../adapters/telegram-errors';
import { areOmnichannelConnectorsEnabled } from '../omnichannel.constants';

export class DeliveryDeferredError extends Error {
  readonly availableAt: Date | null;
  readonly reason: string;

  constructor(
    message = 'publication delivery deferred until connectors are enabled',
    availableAt: Date | null = null,
    reason = 'connectors_disabled',
  ) {
    super(message);
    this.name = 'DeliveryDeferredError';
    this.availableAt = availableAt;
    this.reason = reason;
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

/**
 * Ambiguous create outcome: the messenger may already have the post.
 * Must HOLD + ACK, never RETRY.
 */
export function isUnconfirmedSendError(err: unknown): boolean {
  if (classifyTelegramThrow(err) === 'timeout') return true;
  const named = err && typeof err === 'object' ? (err as { code?: unknown; cause?: { code?: unknown } }) : null;
  const code = String(named?.code ?? named?.cause?.code ?? '');
  const message = err instanceof Error ? err.message : String(err || '');
  return UNCONFIRMED_SEND_RE.test(message) || UNCONFIRMED_SEND_CODE_RE.test(code);
}

/**
 * The request may have reached the messenger before the connection dropped (timeout, reset,
 * upstream gateway timeout). Connection-refused / DNS failures are NOT here: nothing was sent.
 */
const UNCONFIRMED_SEND_RE =
  /timed?\s*out|timeout|AbortError|TimeoutError|socket hang up|ECONNRESET|ECONNABORTED|EPIPE|other side closed|gateway time-?out|bad gateway/i;
const UNCONFIRMED_SEND_CODE_RE = /^(ETIMEDOUT|ECONNRESET|ECONNABORTED|EPIPE|UND_ERR_SOCKET|UND_ERR_BODY_TIMEOUT|UND_ERR_HEADERS_TIMEOUT)$/;
