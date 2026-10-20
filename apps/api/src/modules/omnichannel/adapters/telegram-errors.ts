export type TelegramErrorCode =
  | 'invalid_credential'
  | 'permission_denied'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'timeout'
  | 'duplicate'
  | 'validate_failed';

/** Bot token is fine but the bot is not allowed to act in that chat (not admin / cannot post). */
export function isPermissionDeniedDescription(description = ''): boolean {
  const text = String(description || '').toLowerCase();
  return (
    text.includes('permission_denied')
    || text.includes('not enough rights')
    || text.includes('chat_admin_required')
    || text.includes('need administrator')
    || text.includes('bot is not a member')
  );
}

export function classifyTelegramHttpError(status: number, description = ''): TelegramErrorCode {
  const text = String(description || '').toLowerCase();
  // Prefer chat-permission failures over treating HTTP 403 as a bad token.
  if (isPermissionDeniedDescription(text)) return 'permission_denied';
  if (status === 401 || status === 403) return 'invalid_credential';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'provider_unavailable';
  if (status === 409 || text.includes('message is not modified') || text.includes('already')) return 'duplicate';
  return 'validate_failed';
}

export function classifyTelegramThrow(err: unknown): TelegramErrorCode {
  if (!err || typeof err !== 'object') return 'validate_failed';
  const named = err as {
    name?: string;
    code?: string;
    status?: number;
    message?: string;
    description?: string;
    telegramCode?: string;
  };
  if (named.name === 'TimeoutError' || named.name === 'AbortError' || named.code === 'ABORT_ERR') {
    return 'timeout';
  }
  if (
    named.telegramCode === 'invalid_credential'
    || named.telegramCode === 'permission_denied'
    || named.telegramCode === 'rate_limited'
    || named.telegramCode === 'provider_unavailable'
    || named.telegramCode === 'timeout'
    || named.telegramCode === 'duplicate'
    || named.telegramCode === 'validate_failed'
  ) {
    return named.telegramCode;
  }
  const detail = String(named.description || named.message || '');
  return classifyTelegramHttpError(Number(named.status || 0), detail);
}

export function redactProviderError(message: string): string {
  return String(message || '')
    .replace(/\/bot[^/\s?#]+/gi, '/bot[redacted]')
    .replace(/\d{6,}:[A-Za-z0-9_-]{20,}/g, '[redacted-token]')
    .slice(0, 200);
}

export function safeWorkerError(err: unknown): string {
  const code = classifyTelegramThrow(err);
  if (code !== 'validate_failed') return code;
  const named = err && typeof err === 'object'
    ? (err as { description?: string; message?: string })
    : null;
  const detail = String(named?.description || named?.message || (err instanceof Error ? err.message : String(err)) || '');
  // Prefer the human Telegram description over the opaque code alone.
  if (detail && detail !== 'validate_failed') return redactProviderError(detail);
  return 'validate_failed';
}

export function assertNoSecretLeak(haystack: string, secret: string) {
  if (secret && haystack.includes(secret)) {
    throw new Error('token_leak');
  }
}
