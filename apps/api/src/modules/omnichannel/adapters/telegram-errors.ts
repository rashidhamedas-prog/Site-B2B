export type TelegramErrorCode =
  | 'invalid_credential'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'timeout'
  | 'duplicate'
  | 'validate_failed';

export function classifyTelegramHttpError(status: number, description = ''): TelegramErrorCode {
  const text = String(description || '').toLowerCase();
  if (status === 401 || status === 403) return 'invalid_credential';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'provider_unavailable';
  if (status === 409 || text.includes('message is not modified') || text.includes('already')) return 'duplicate';
  return 'validate_failed';
}

export function classifyTelegramThrow(err: unknown): TelegramErrorCode {
  if (!err || typeof err !== 'object') return 'validate_failed';
  const named = err as { name?: string; code?: string; status?: number; message?: string };
  if (named.name === 'TimeoutError' || named.name === 'AbortError' || named.code === 'ABORT_ERR') {
    return 'timeout';
  }
  return classifyTelegramHttpError(Number(named.status || 0), String(named.message || ''));
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
  return redactProviderError(err instanceof Error ? err.message : String(err));
}

export function assertNoSecretLeak(haystack: string, secret: string) {
  if (secret && haystack.includes(secret)) {
    throw new Error('token_leak');
  }
}
