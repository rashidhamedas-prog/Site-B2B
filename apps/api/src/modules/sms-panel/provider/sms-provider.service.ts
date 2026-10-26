import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { createSmsProvider, resolveSmsProviderId } from './factory';
import { MockSmsProvider } from './mock.provider';
import type { SmsProvider } from './types';

/**
 * Process-wide SMS provider. In NODE_ENV=test always MockSmsProvider.
 * Production uses SMS_PROVIDER + settings/env keys (never logged).
 */
@Injectable()
export class SmsProviderService implements OnModuleInit {
  private readonly logger = new Logger(SmsProviderService.name);
  private provider: SmsProvider = new MockSmsProvider();
  private mock = new MockSmsProvider();

  constructor(private readonly settings: SettingsService) {}

  onModuleInit() {
    void this.refresh();
  }

  get(): SmsProvider {
    return this.provider;
  }

  /** Test helpers */
  getMock(): MockSmsProvider {
    return this.mock;
  }

  async refresh(): Promise<SmsProvider> {
    const id = resolveSmsProviderId();
    if (id === 'mock') {
      this.provider = this.mock;
      this.logger.log('SMS provider=mock');
      return this.provider;
    }
    const cfg = await this.settings.sms();
    const apiKey =
      process.env.SMSIR_API_KEY ||
      cfg.apiKey ||
      process.env.SMS_API_KEY ||
      '';
    const lineService =
      process.env.SMSIR_LINE_SERVICE ||
      process.env.SMSIR_LINE_NUMBER ||
      cfg.lineNumber ||
      process.env.SMS_SENDER ||
      '';
    const linePromo = process.env.SMSIR_LINE_PROMO || lineService;
    this.provider = createSmsProvider({
      smsir: {
        apiKey,
        linePromo,
        lineService,
        transport: {
          egressBaseUrl: cfg.egressBaseUrl || process.env.SMS_EGRESS_BASE_URL || '',
          egressSecret: cfg.egressSecret || process.env.SMS_EGRESS_SECRET || '',
        },
      },
      mock: this.mock,
    });
    this.logger.log(`SMS provider=${this.provider.id}`);
    return this.provider;
  }
}
