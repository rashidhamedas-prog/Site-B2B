import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettingEntity } from '../../settings/entities/app-setting.entity';
import { defaultSecretRefFor, OMNICHANNEL_PROVIDERS } from '../omnichannel.constants';
import {
  applyVaultOverlay,
  decryptToken,
  deriveVaultKey,
  encryptToken,
  envProviderRefs,
  OMNICHANNEL_VAULT_SETTING_KEY,
  parseStoredVault,
  publicSecretStatus,
  setVaultOverlayEntry,
  tokenFingerprint,
  vaultOverlayRefs,
  type SecretStatus,
  type StoredVault,
  type StoredVaultEntry,
  type VaultEntryPublic,
} from '../omnichannel-token-vault';

@Injectable()
export class OmnichannelTokenVaultService implements OnModuleInit {
  private readonly logger = new Logger(OmnichannelTokenVaultService.name);
  private lastHydratedAt = 0;

  constructor(
    @InjectRepository(AppSettingEntity)
    private readonly appSettings: Repository<AppSettingEntity>,
  ) {}

  async onModuleInit() {
    await this.hydrate();
  }

  async hydrate(): Promise<void> {
    let key: Buffer;
    try {
      key = deriveVaultKey();
    } catch {
      this.logger.warn('omnichannel vault key missing; admin-saved tokens stay unread until JWT_SECRET or OMNICHANNEL_VAULT_KEY is set');
      return;
    }
    const row = await this.appSettings.findOne({ where: { key: OMNICHANNEL_VAULT_SETTING_KEY } });
    const stored = parseStoredVault(row?.value);
    const plain: Record<string, string> = {};
    const meta: Record<string, VaultEntryPublic> = {};
    for (const [name, entry] of Object.entries(stored.entries)) {
      try {
        const token = decryptToken(entry, key);
        plain[name] = token;
        meta[name] = { fingerprint: entry.fingerprint || tokenFingerprint(token), updatedAt: entry.updatedAt };
      } catch {
        this.logger.warn(`omnichannel vault entry unreadable for ${name}`);
      }
    }
    applyVaultOverlay(plain, meta);
    this.lastHydratedAt = Date.now();
  }

  /** Worker re-reads at most every 15s so a token saved in the API process reaches this process. */
  async refreshIfStale(maxAgeMs = 15_000): Promise<void> {
    if (Date.now() - this.lastHydratedAt < maxAgeMs) return;
    await this.hydrate();
  }

  async put(secretRef: string, token: string): Promise<SecretStatus> {
    const key = deriveVaultKey();
    const stored = await this.loadStored();
    const updatedAt = new Date().toISOString();
    const entry: StoredVaultEntry = {
      ...encryptToken(token, key),
      fingerprint: tokenFingerprint(token),
      updatedAt,
    };
    stored.entries[secretRef] = entry;
    await this.persist(stored);
    setVaultOverlayEntry(secretRef, token, { fingerprint: entry.fingerprint, updatedAt });
    return publicSecretStatus(secretRef);
  }

  async clear(secretRef: string): Promise<SecretStatus> {
    const stored = await this.loadStored();
    delete stored.entries[secretRef];
    await this.persist(stored);
    setVaultOverlayEntry(secretRef, null);
    return publicSecretStatus(secretRef);
  }

  async statuses(extraRefs: string[] = []): Promise<SecretStatus[]> {
    const names = new Set<string>([
      ...OMNICHANNEL_PROVIDERS.map((provider) => defaultSecretRefFor(provider)),
      ...envProviderRefs(),
      ...vaultOverlayRefs(),
      ...extraRefs,
    ]);
    return [...names]
      .filter(Boolean)
      .sort()
      .map((secretRef) => publicSecretStatus(secretRef));
  }

  private async loadStored(): Promise<StoredVault> {
    const row = await this.appSettings.findOne({ where: { key: OMNICHANNEL_VAULT_SETTING_KEY } });
    return parseStoredVault(row?.value);
  }

  private async persist(stored: StoredVault): Promise<void> {
    await this.appSettings.save(
      this.appSettings.create({ key: OMNICHANNEL_VAULT_SETTING_KEY, value: stored }),
    );
  }
}
