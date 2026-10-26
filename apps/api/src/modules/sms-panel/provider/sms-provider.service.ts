import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { DisabledSmsProvider } from './disabled.provider';
import { createSmsProvider } from './factory';
import { MockSmsProvider } from './mock.provider';
import { resolveSmsSecrets } from './secrets';
import type { SmsProvider } from './types';

/**
 * Process-wide SMS provider.
 * - NODE_ENV=test → MockSmsProvider
 * - SMS_PROVIDER=mock → MockSmsProvider
 * - smsir without key → DisabledSmsProvider (never silent Mock)
 */
@Injectable()
export class SmsProviderService implements OnModuleInit {
  private readonly logger = new Logger(SmsProviderService.name);
  private provider: SmsProvider = new DisabledSmsProvider();
  private mock = new MockSmsProvider();
  private ready = false;

  constructor(private readonly settings: SettingsService) {}

  async onModuleInit() {
    await this.refresh();
  }

  get(): SmsProvider {
    return this.provider;
  }

  getMock(): MockSmsProvider {
    return this.mock;
  }

  isReady(): boolean {
    return this.ready;
  }

  async refresh(): Promise<SmsProvider> {
    const cfg = await this.settings.sms().catch(() => ({} as any));
    const secrets = resolveSmsSecrets(process.env, {
      apiKey: cfg?.apiKey,
      lineNumber: cfg?.lineNumber,
      otpTemplateId: cfg?.otpTemplateId,
      egressBaseUrl: cfg?.egressBaseUrl,
      egressSecret: cfg?.egressSecret,
    });
    this.provider = createSmsProvider({
      env: process.env,
      db: {
        apiKey: cfg?.apiKey,
        lineNumber: cfg?.lineNumber,
        otpTemplateId: cfg?.otpTemplateId,
        egressBaseUrl: cfg?.egressBaseUrl,
        egressSecret: cfg?.egressSecret,
      },
      smsir: {
        apiKey: secrets.apiKey,
        linePromo: secrets.linePromo,
        lineService: secrets.lineService,
        transport: {
          egressBaseUrl: secrets.egressBaseUrl,
          egressSecret: secrets.egressSecret,
        },
      },
      mock: this.mock,
    });
    this.ready = true;
    this.logger.log(`SMS provider=${this.provider.id}`);
    return this.provider;
  }

  /** Resolved secret presence for UI — never values. */
  async secretsStatus() {
    const cfg = await this.settings.sms().catch(() => ({} as any));
    const s = resolveSmsSecrets(process.env, {
      apiKey: cfg?.apiKey,
      lineNumber: cfg?.lineNumber,
      otpTemplateId: cfg?.otpTemplateId,
      egressBaseUrl: cfg?.egressBaseUrl,
      egressSecret: cfg?.egressSecret,
    });
    return {
      provider: s.providerMode,
      apiKey: Boolean(s.apiKey),
      egress: Boolean(s.egressBaseUrl),
      linePromo: Boolean(s.linePromo),
      lineService: Boolean(s.lineService),
      otpTemplate: Boolean(s.otpTemplateId),
    };
  }

  async resolvedSecrets() {
    const cfg = await this.settings.sms().catch(() => ({} as any));
    return resolveSmsSecrets(process.env, {
      apiKey: cfg?.apiKey,
      lineNumber: cfg?.lineNumber,
      otpTemplateId: cfg?.otpTemplateId,
      egressBaseUrl: cfg?.egressBaseUrl,
      egressSecret: cfg?.egressSecret,
    });
  }
}
