import { MockSmsProvider } from './mock.provider';
import { SmsIrProvider, type SmsIrProviderConfig } from './smsir.provider';
import type { SmsProvider } from './types';

export const SMS_REAL_HOST_RE = /(?:^|\.)api\.sms\.ir$/i;

export function assertTestBlocksRealSmsNetwork(url: string): void {
  if (process.env.NODE_ENV !== 'test') return;
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    host = url;
  }
  const egress = String(process.env.SMS_EGRESS_BASE_URL || '').trim();
  if (SMS_REAL_HOST_RE.test(host) || (egress && url.startsWith(egress))) {
    throw new Error(
      `SMS_NETWORK_FORBIDDEN_IN_TEST: refused request to ${host || url}`,
    );
  }
}

/** Wrap fetch so any attempt to hit sms.ir / egress in test fails hard. */
export function guardedFetch(fetchImpl: typeof fetch = fetch): typeof fetch {
  const wrapped: typeof fetch = async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : String(input?.url || input);
    assertTestBlocksRealSmsNetwork(url);
    return fetchImpl(input, init);
  };
  return wrapped;
}

export function resolveSmsProviderId(
  env: NodeJS.ProcessEnv = process.env,
): 'mock' | 'smsir' {
  if (env.NODE_ENV === 'test') return 'mock';
  const raw = String(env.SMS_PROVIDER || 'smsir').toLowerCase();
  if (raw === 'mock') return 'mock';
  return 'smsir';
}

export function createSmsProvider(opts?: {
  env?: NodeJS.ProcessEnv;
  smsir?: SmsIrProviderConfig;
  mock?: MockSmsProvider;
}): SmsProvider {
  const env = opts?.env || process.env;
  const id = resolveSmsProviderId(env);
  if (id === 'mock') {
    return opts?.mock || new MockSmsProvider();
  }
  if (!opts?.smsir?.apiKey) {
    // No key → mock that reports disabled-like failures via zero credit path
    return opts?.mock || new MockSmsProvider();
  }
  return new SmsIrProvider({
    ...opts.smsir,
    fetchImpl: guardedFetch(opts.smsir.fetchImpl || fetch),
  });
}
