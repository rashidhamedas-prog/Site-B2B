import { DisabledSmsProvider } from './disabled.provider';
import { MockSmsProvider } from './mock.provider';
import { resolveSmsSecrets } from './secrets';
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
): 'mock' | 'smsir' | 'disabled' {
  return resolveSmsSecrets(env).providerMode;
}

export function createSmsProvider(opts?: {
  env?: NodeJS.ProcessEnv;
  smsir?: SmsIrProviderConfig;
  mock?: MockSmsProvider;
  db?: {
    apiKey?: string;
    lineNumber?: string;
    otpTemplateId?: string | number;
    egressBaseUrl?: string;
    egressSecret?: string;
  } | null;
}): SmsProvider {
  const env = opts?.env || process.env;
  const db = opts?.db ?? {
    apiKey: opts?.smsir?.apiKey,
    lineNumber: opts?.smsir?.lineService || opts?.smsir?.linePromo,
    egressBaseUrl: opts?.smsir?.transport?.egressBaseUrl || undefined,
    egressSecret: opts?.smsir?.transport?.egressSecret || undefined,
  };
  const secrets = resolveSmsSecrets(env, db);

  if (secrets.providerMode === 'mock') {
    return opts?.mock || new MockSmsProvider();
  }
  if (secrets.providerMode === 'disabled' || !secrets.apiKey) {
    return new DisabledSmsProvider();
  }
  return new SmsIrProvider({
    apiKey: secrets.apiKey,
    linePromo: secrets.linePromo || opts?.smsir?.linePromo,
    lineService: secrets.lineService || opts?.smsir?.lineService,
    transport: {
      egressBaseUrl: secrets.egressBaseUrl,
      egressSecret: secrets.egressSecret,
    },
    fetchImpl: guardedFetch(opts?.smsir?.fetchImpl || fetch),
  });
}
